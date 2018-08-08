/**
 * This class manages a state variable for whether we are online/offline, triggers events
 * when the state changes, and determines when to perform tests to validate our online status.
 *
 * It performs the following tasks:
 *
 * 1. Any time we go more than this.pingFrequency (100 seconds) without any data from the server, flag us as being offline.
 *    Rationale: The websocket manager is calling `getCounter` every 30 seconds; so it would have had to fail to get any response
 *    3 times before we give up.
 * 2. While we are offline, ping the server until we determine we are in fact able to connect to the server
 * 3. Any time there is a browser `online` or `offline` event, check to see if we can in fact reach the server.  Do not trust either event to be wholly accurate.
 *    We may be online, but still unable to reach any services.  And Chrome tabs in our tests have shown `navigator.onLine` to sometimes be `false` even while connected.
 * 4. Trigger events `connected` and `disconnected` to let the rest of the system know when we are/are not connected.
 *    NOTE: The Websocket manager will use that to reconnect its websocket, and resume its `getCounter` call every 30 seconds.
 *
 * NOTE: Apps that want to be notified of changes to online/offline state should see layer.Client's `online` event.
 *
 * NOTE: One iteration of this class treated navigator.onLine = false as fact.  If onLine is false, then we don't need to test
 * anything.  If its true, then this class verifies it can reach layer's servers.  However, https://code.google.com/p/chromium/issues/detail?id=277372 has replicated multiple times in chrome; this bug causes one tab of chrome to have navigator.onLine=false while all other tabs
 * correctly report navigator.onLine=true.  As a result, we can't rely on this value and this class must continue to poll the server while
 * offline and to ignore values from navigator.onLine.  Future Work: Allow non-chrome browsers to use navigator.onLine.
 *
 * ## Execution Paths
 *
 * Path A: Initialization Path
 *
 * 1. `start()` method calls `checkOnlineStatus()`
 * 2. `checkOnlineStatus()` does a Ping operation to the server
 * 3. `_connectionListener()` detects the result of the Ping in the form of an XHR success or failure to reach the server
 *   a. Success: Schedule `_onlineExpiring()` to be called in 100 seconds (rescheduled if any network traffic is received)
 *   b. Failure: Call `_onlineExpiring()` which does one verification Ping to the server to make sure it is unreachable (rather than CORS or other error)
 *     i. Ping fails: Calls `_onlineExpired()` which Changes to state to offline mode, and calls `_scheduleNextOnlineCheck()`
 *     ii. Ping succeedes: Handled by `_connectionListener()`; Go to #3 and #3a
 *
 *
 * NOTES: Any failure of `checkOnlineStatus` could be caused by CORS errors or server request timing out
 *    (should actually get a gateway timeout before that happens... which itself gets CORS header errors) rather than connection errors,
 *    therefore we must verify loss of connection via Ping
 *
 * PATH B: Client is Online Path:
 *
 * 1. Call to `_onlineExpiring()` is scheduled to be called in 100 seconds
 * 2. Websocket packets sent by the server and XHR responses from servers are intercepted by `_connectionListener()` which  reschedules `_onlineExpiring()` each time
 * 3. Websocket pings make it unlikely that `_onlineExpiring()` ever gets reached... but if the websocket connection is down then `_onlineExpiring()` is called, does one verification Ping to the server to make sure it is unreachable
 *   a. Ping fails: Calls `_onlineExpired()` which Changes to state to offline mode, and calls `_scheduleNextOnlineCheck()`
 *   b. Ping succeedes: ping response observed by `_connectionListener()`; Go to #2
 *
 * PATH C: Client goes offline
 *
 * 1. Ping fails: Calls `_onlineExpired()` which changes the state to offline mode, and calls `_scheduleNextOnlineCheck()`
 * 2. `_scheduleNextOnlineCheck()` schedules (using exponential backoff) calls to `checkOnlineStatus()`
 * 3. `checkOnlineStatus()` Pings the server
 *    a. `_connectionListener()` detects the result of the Ping in the form of an XHR success or failure to reach the server
 *      i. Success: Changes state to Online and schedules `_onlineExpiring()`
 *      ii. Failure: Go to #2 and increase the exponential backoff, repeat indefinitely until we have success
 *
 *
 * @class  layer.OnlineStateManager
 * @private
 * @extends layer.Root
 *
 */
const Root = require('./root');
const xhr = require('./xhr');
const logger = require('./logger');
const Utils = require('./client-utils');
const { ACCEPT } = require('./const');

class OnlineStateManager extends Root {
  /**
   * Creates a new OnlineStateManager.
   *
   * An Application is expected to only have one of these.
   *
   *      var onlineStateManager = new layer.OnlineStateManager({
   *          socketManager: socketManager,
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {layer.Websockets.SocketManager} options.socketManager - A websocket manager to monitor for messages
   */
  constructor(options) {
    super(options);

    // Listen to all xhr events and websocket messages for online-status info
    xhr.addConnectionListener(evt => this._connectionListener(evt));
    this.socketManager.on('message', () => this._connectionListener({ status: 'connection:success' }), this);

    // Any change in online status reported by the browser should result in
    // an immediate update to our online/offline state
    /* istanbul ignore else */
    if ((typeof window !== 'undefined') && window.addEventListener) {
      window.addEventListener('online', this._handleOnlineEvent.bind(this));
      window.addEventListener('offline', this._handleOnlineEvent.bind(this));
    } else {
      const OnlineEvents = global.getNativeSupport('OnlineEvents');
      if (OnlineEvents) {
        OnlineEvents.addEventListener('change', this._handleOnlineEvent.bind(this));
      }
    }
  }

  /**
   * We don't actually start managing our online state until after the client has authenticated.
   * Call start() when we are ready for the client to start managing our state.
   *
   * The client won't call start() without first validating that we have a valid session, so by definition,
   * calling start means we are online.
   *
   * Executes Path A Step 1
   *
   * @method start
   */
  start() {
    logger.info('OnlineStateManager: start');
    this.isClientReady = true;
    this.isOnline = true;
    this.checkOnlineStatus();
  }

  /**
   * If the client becomes unauthenticated, stop checking if we are online, and announce that we are offline.
   *
   * @method stop
   */
  stop() {
    logger.info('OnlineStateManager: stop');
    this.isClientReady = false;
    this._clearCheck();
    this._changeToOffline();
  }


  /**
   * Schedules pings to see when we come back online; uses exponential backoff to schedule pings.
   *
   * This is only called when our state appears to be offline.
   *
   * Each call to this cancels any previously scheduled event.
   *
   * @method _scheduleNextOnlineCheck
   * @private
   */
  _scheduleNextOnlineCheck() {
    if (this.isDestroyed || !this.isClientReady || this.isOnline) return;

    // Replace any scheduled calls with the newly scheduled call:
    this._clearCheck();
    const backoffCounter = Math.min(10, this.offlineCounter + 3);
    this.offlineCounter++;
    const duration = Utils.getExponentialBackoffSeconds(this.maxOfflineWait, backoffCounter);
    logger.info('OnlineStateManager: Scheduled checkOnlineStatus ' + duration + ' seconds');
    this.onlineCheckId = setTimeout(this.checkOnlineStatus.bind(this), Math.floor(duration * 1000));
  }

  /**
   * Cancels any upcoming calls to checkOnlineStatus or _onlineExpiring.
   *
   * @method _clearCheck
   * @private
   */
  _clearCheck() {
    if (this.onlineCheckId) {
      clearTimeout(this.onlineCheckId);
      this.onlineCheckId = 0;
    }
  }

  /**
   * Respond to the browser's online/offline events.
   *
   * Our response is not to trust them, but to use them as
   * a trigger to indicate we should immediately do our own
   * validation.
   *
   * @method _handleOnlineEvent
   * @private
   * @param  {Event} evt - Browser online/offline event object
   */
  _handleOnlineEvent(evt) {
    // Reset the counter; its likely our first request may fail as networking may not be
    // fully connected yet
    this.offlineCounter = 0;
    this.checkOnlineStatus();
  }

  /**
   * Last ditch attempt to prove we are online before setting us to offline.
   *
   * Note that under worst case conditions, a request could take until the browser gives up (2 minutes?)
   *
   * @method _onlineExpiring
   * @private
   */
  _onlineExpiring() {
    logger.info('OnlineStateManager: Online State Expiring; pinging to verify');
    this._isOnlineExpiring = true;
    this.checkOnlineStatus((result) => {
      if (!result && this._isOnlineExpiring) this._onlineExpired();
      this._isOnlineExpiring = false;
    });
  }

  /**
   * Our online state has expired; we are now offline.
   *
   * If this method gets called, it means that our connection has gone too long without any data
   * and is now considered to be disconnected.  Start scheduling tests to see when we are back online.
   *
   * @method _onlineExpired
   * @private
   */
  _onlineExpired() {
    logger.info('OnlineStateManager: Online State Expired');
    this._clearCheck();
    this._changeToOffline();
    this._scheduleNextOnlineCheck(); // Start pinging to see when we come back online
  }

  /**
   * Get a nonce to see if we can reach the server.
   *
   * We don't care about the result,
   * we just care about triggering a 'connection:success' or 'connection:error' event
   * which connectionListener will respond to.
   *
   *      client.onlineManager.checkOnlineStatus(function(result) {
   *          alert(result ? 'We're online!' : 'Doh!');
   *      });
   *
   * @method checkOnlineStatus
   * @param {Function} callback
   * @param {boolean} callback.isOnline - Callback is called with true if online, false if not
   */
  checkOnlineStatus(callback) {
    if (this.isDestroyed) return;
    this._clearCheck();
    const client = this.socketManager.client;

    logger.info('OnlineStateManager: Firing XHR for online check');
    this._lastCheckOnlineStatus = new Date();
    // Ping the server and see if we're connected.
    xhr({
      url: `${client.url}/ping?client=${client.constructor.version}`,
      method: 'HEAD',
      headers: {
        accept: ACCEPT,
      },
    }, ({ status }) => {
      // this.isOnline will be updated via _connectionListener prior to this line executing
      if (callback) callback(status !== 408);
    });
  }


  /**
   * On determining that we are offline, handles the state transition and logging.
   *
   * @method _changeToOffline
   * @private
   */
  _changeToOffline() {
    if (this.isOnline) {
      logger.info('OnlineStateManager: Connection lost');
      this.isOnline = false;
      this.trigger('disconnected');
    }
  }

  /**
   * Called whenever a websocket event arrives, or an xhr call completes; updates our isOnline state.
   *
   * Any call to this method will reschedule our next is-online test
   *
   * @method _connectionListener
   * @private
   * @param  {string} evt - Name of the event; either 'connection:success' or 'connection:error'
   */
  _connectionListener(evt) {
    // If event is a success, change us to online
    const success = evt.status === 'connection:success';
    if (success) {
      this._isOnlineExpiring = false;
      const lastTime = this.lastMessageTime;
      this.lastMessageTime = new Date();
      if (!this.isOnline) {
        this.isOnline = true;
        this.offlineCounter = 0;
        this.trigger('connected', { offlineDuration: lastTime ? Date.now() - lastTime : 0 });
        if (this.connectedCounter === undefined) this.connectedCounter = 0;
        this.connectedCounter++;
        logger.info('OnlineStateManager: Connected restored');
      }
      this._clearCheck();
      this.onlineCheckId = setTimeout(this._onlineExpiring.bind(this), this.pingFrequency);
    }

    // Request failed to get through and our state is online, do a verifying ping and set us to offline
    else if (this.isOnline) {
      this._onlineExpiring();
    }

    // We were offline anyways, didn't expect it to work, Start scheduled pinging to see when we come back online
    else {
      this._scheduleNextOnlineCheck();
    }
  }

  /**
   * Cleanup/shutdown
   *
   * @method destroy
   */
  destroy() {
    this._clearCheck();
    this.socketManager = null;
    super.destroy();
  }
}

OnlineStateManager.prototype.isClientReady = false;

/**
 * A Websocket manager whose 'message' event we will listen to
 * in order to know that we are still online.
 * @type {layer.Websockets.SocketManager}
 */
OnlineStateManager.prototype.socketManager = null;

/**
 * Number of test requests we've been offline for.
 *
 * Will stop growing once the number is suitably large (10-20).
 * @type {Number}
 */
OnlineStateManager.prototype.offlineCounter = 0;

/**
 * Maximum wait during exponential backoff while offline.
 *
 * While offline, exponential backoff is used to calculate how long to wait between checking with the server
 * to see if we are online again. This value determines the maximum wait; any higher value returned by exponential backoff
 * are ignored and this value used instead.
 * Value is measured in seconds.
 * @type {Number}
 */
OnlineStateManager.prototype.maxOfflineWait = 60;

/**
 * Minimum wait between tries in ms.
 * @type {Number}
 */
OnlineStateManager.prototype.minBackoffWait = 100;

/**
 * Time that the last successful message was observed.
 * @type {Date}
 */
OnlineStateManager.prototype.lastMessageTime = null;

/**
 * For debugging, tracks the last time we checked if we are online.
 * @type {Date}
 */
OnlineStateManager.prototype._lastCheckOnlineStatus = null;

/**
 * Are we currently online?
 * @type {Boolean}
 */
OnlineStateManager.prototype.isOnline = false;

/**
 * setTimeoutId for the next checkOnlineStatus() call.
 * @type {Number}
 */
OnlineStateManager.prototype.onlineCheckId = 0;

/**
 * True if current state is that we are probably offline, and just firing one last request to verify that fact.
 *
 * Set to false to cancel the verification (well, ignore the verification response)
 *
 * @property {Boolean} _isOnlineExpiring
 * @private
 */
OnlineStateManager.prototype._isOnlineExpiring = false;

/**
 * If we are online, how often do we need to ping to verify we are still online.
 *
 * Value is reset any time we observe any messages from the server.
 * Measured in miliseconds. NOTE: Websocket has a separate ping which mostly makes
 * this one unnecessary.  May end up removing this one... though we'd keep the
 * ping for when our state is offline.
 * @type {Number}
 */
OnlineStateManager.prototype.pingFrequency = 100 * 1000;

OnlineStateManager._supportedEvents = [
  /**
   * We appear to be online and able to send and receive
   * @event connected
   * @param {number} onlineDuration - Number of miliseconds since we were last known to be online
   */
  'connected',

  /**
   * We appear to be offline and unable to send or receive
   * @event disconnected
   */
  'disconnected',
].concat(Root._supportedEvents);
Root.initClass.apply(OnlineStateManager, [OnlineStateManager, 'OnlineStateManager']);
module.exports = OnlineStateManager;
