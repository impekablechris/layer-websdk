/**
 * This component manages
 *
 * 1. recieving websocket events
 * 2. Processing them
 * 3. Triggering events on completing them
 * 4. Sending them
 *
 * Applications typically do not interact with this component, but may subscribe
 * to the `message` event if they want richer event information than is available
 * through the layer.Client class.
 *
 * Backoff will retry the connection after:
 * * 1.6 seconds
 * * 3.2 seconds
 * * 12.8 seconds
 * * 25.6 seconds
 * * 51 seconds
 * * ….
 * * 8 minutes
 *
 * etc… each of those retries has randomized jitter between 0 and 50% of the delay (so 1.6 seconds delay is * actually anywhere between 1.6 - 2.4 seconds)
 *
 * Websocket reconnects are only performed after a REST API call that validates we are online and able to reach layer’s servers; this greatly reduces the likelihood of failure caused by networking issues.
 *
 * There is no time at which it simply gives up and stops retrying; however once ever 8 minutes (8-12 minutes due to 50% jitter) is slow enough that it shouldn’t contribute to rate limiting (unless there are a massive number of tabs involved)
 *
 * @class  layer.Websockets.SocketManager
 * @extends layer.Root
 * @private
 */
const Root = require('../root');
const Utils = require('../client-utils');
const logger = require('../logger');
const LayerError = require('../layer-error');
const { WEBSOCKET_PROTOCOL } = require('../const');

class SocketManager extends Root {
  /**
   * Create a new websocket manager
   *
   *      var socketManager = new layer.Websockets.SocketManager({
   *          client: client,
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @return {layer.Websockets.SocketManager}
   */
  constructor(options) {
    super(options);
    if (!this.client) throw new Error('SocketManager requires a client');

    // Insure that on/off methods don't need to call bind, therefore making it easy
    // to add/remove functions as event listeners.
    this._onMessage = this._onMessage.bind(this);
    this._onOpen = this._onOpen.bind(this);
    this._onSocketClose = this._onSocketClose.bind(this);
    this._onError = this._onError.bind(this);

    // If the client is authenticated, start it up.
    if (this.client.isAuthenticated && this.client.onlineManager.isOnline) {
      this.trigger('connecting', { from: 'constructor', why: 'initialization' });
      this.connect();
    }

    this.client.on('online', this._onlineStateChange, this);

    // Any time the Client triggers a ready event we need to reconnect.
    this.client.on('authenticated', () => {
      this.trigger('connecting', { from: 'constructor', why: 'authenticated' });
      this.connect();
    }, this);

    this._lastTimestamp = Date.now();
  }

  /**
   * Call this when we want to reset all websocket state; this would be done after a lengthy period
   * of being disconnected.  This prevents Event.replay from being called on reconnecting.
   *
   * @method _reset
   * @private
   */
  _reset() {
    this._lastTimestamp = 0;
    this._lastDataFromServerTimestamp = 0;
    this._hasZeroCounter = false;

    this._needsReplayFrom = null;
  }

  /**
   * Event handler is triggered any time the client's online state changes.
   * If going online we need to reconnect (i.e. will close any existing websocket connections and then open a new connection)
   * If going offline, close the websocket as its no longer useful/relevant.
   * @method _onlineStateChange
   * @private
   * @param {layer.LayerEvent} evt
   */
  _onlineStateChange(evt) {
    if (!this.client.isAuthenticated) return;
    if (evt.isOnline) {
      this.trigger('connecting', { from: '_onlineStateChange', why: 'detect change to online' });
      this._reconnect(evt.reset);
    } else {
      logger.info('Websocket closed due to ambigious connection state');
      this.trigger('disconnecting', { from: '_onlineStateChange', why: 'detect change to offline' });
      this.close();
    }
  }

  /**
   * Reconnect to the server, optionally resetting all data if needed.
   * @method _reconnect
   * @private
   * @param {boolean} reset
   */
  _reconnect(reset) {
    // The sync manager will reissue any requests once it receives a 'connect' event from the websocket manager.
    // There is no need to have an error callback at this time.
    // Note that calls that come from sources other than the sync manager may suffer from this.
    // Once the websocket implements retry rather than the sync manager, we may need to enable it
    // to trigger a callback after sufficient time.  Just delete all callbacks.
    this.close();
    if (reset) this._reset();
    this.connect();
  }

  /**
   * Connect to the websocket server
   *
   * Note that if you'd like to see how dead websockets are handled, you can try something like this:
   *
   * ```
   * var WS = function WebSocket(url) {
      this.url = url;
      this.close = function() {};
      this.send = function(msg) {console.log("SEND ", msg);};
      this.addEventListener = function(name, callback) {
        this["on" + name] = callback;
      };
      this.removeEventListener = function() {};
      this.readyState = 1;
      setTimeout(function() {this.onopen();}.bind(this), 100);
    };
    WS.CONNECTING = 0;
    WS.OPEN = 1;
    WS.CLOSING = 2;
    WS.CLOSED = 3;
    ```
   *
   * @method connect
   * @param  {layer.SyncEvent} evt - Ignored parameter
   */
  connect(evt) {
    if (this.client.isDestroyed || !this.client.isOnline || !this.client._wantsToBeConnected) return;
    if (this._socket) return this._reconnect();

    this._closing = false;

    // Get the URL and connect to it
    const url = `${this.client.websocketUrl}/?session_token=${this.client.sessionToken}&client-id=${this.client._tabId}` +
    `&layer-xdk-version=${this.client.constructor.version}`;

    logger.info('Websocket Connecting');

    // Load up our websocket component or shim
    /* istanbul ignore next */
    const WS = typeof WebSocket === 'undefined' ? require('websocket').w3cwebsocket : WebSocket;

    this._socket = new WS(url, WEBSOCKET_PROTOCOL);

     // If its the shim, set the event hanlers
    /* istanbul ignore if */
    if (typeof WebSocket === 'undefined') {
      this._socket.onmessage = this._onMessage;
      this._socket.onclose = this._onSocketClose;
      this._socket.onopen = this._onOpen;
      this._socket.onerror = this._onError;
    }

    // If its a real websocket, add the event handlers
    else {
      this._socket.addEventListener('message', this._onMessage);
      this._socket.addEventListener('close', this._onSocketClose);
      this._socket.addEventListener('open', this._onOpen);
      this._socket.addEventListener('error', this._onError);
    }

    // Trigger a failure if it takes >= 5 seconds to establish a connection
    this._connectionFailedId = setTimeout(this._connectionFailed.bind(this), 5000);
  }

  /**
   * Clears the scheduled call to _connectionFailed that is used to insure the websocket does not get stuck
   * in CONNECTING state. This call is used after the call has completed or failed.
   *
   * @method _clearConnectionFailed
   * @private
   */
  _clearConnectionFailed() {
    if (this._connectionFailedId) {
      clearTimeout(this._connectionFailedId);
      this._connectionFailedId = 0;
    }
  }

  /**
   * Called after 5 seconds of entering CONNECTING state without getting an error or a connection.
   * Calls _onError which will cause this attempt to be stopped and another connection attempt to be scheduled.
   *
   * @method _connectionFailed
   * @private
   */
  _connectionFailed() {
    this._connectionFailedId = 0;
    const msg = 'Websocket failed to connect to server';
    logger.warn(msg);

    // TODO: At this time there is little information on what happens when closing a websocket connection that is stuck in
    // readyState=CONNECTING.  Does it throw an error?  Does it call the onClose or onError event handlers?
    // Remove all event handlers so that calling close won't trigger any calls.
    try {
      this.isOpen = false;
      this._removeSocketEvents();
      if (this._socket) {
        this._socket.close();
        this._socket = null;
      }
    } catch (e) {
      // No-op
    }

    // Now we can call our error handler.
    this._onError(new Error(msg));
  }

  /**
   * The websocket connection is reporting that its now open.
   *
   * @method _onOpen
   * @private
   */
  _onOpen() {
    this._clearConnectionFailed();
    if (this._isOpen()) {
      this._lostConnectionCount = 0;
      this._lastSkippedCounter = 0;
      this.isOpen = true;
      this.trigger('connected');
      logger.debug('Websocket Connected');
      if (this._hasZeroCounter && this._lastTimestamp) {
        this.trigger('replaying-events', { from: 'resync', why: 'reconnected' });
        this.resync(this._lastTimestamp);
      } else {
        this._enablePresence();
        this._reschedulePing();
      }
    }
  }

  /**
   * Tests to see if the websocket connection is open.  Use the isOpen property
   * for external tests.
   * @method _isOpen
   * @private
   * @returns {Boolean}
   */
  _isOpen() {
    if (!this._socket) return false;
    /* istanbul ignore if */
    if (typeof WebSocket === 'undefined') return true;
    return this._socket && this._socket.readyState === WebSocket.OPEN;
  }

  /**
   * If not isOpen, presumably failed to connect
   * Any other error can be ignored... if the connection has
   * failed, onClose will handle it.
   *
   * @method _onError
   * @private
   * @param  {Error} err - Websocket error
   */
  _onError(err) {
    if (this._closing) return;
    this._clearConnectionFailed();
    logger.debug('Websocket Error causing websocket to close', err);
    if (!this.isOpen) {
      this._removeSocketEvents();
      this._lostConnectionCount++;
      this.trigger('schedule-reconnect', { from: '_onError', why: 'websocket failed to open' });
      this._scheduleReconnect();
    } else {
      this._onSocketClose();
      this._socket.close();
      this._socket = null;
    }
  }

  /**
   * Shortcut method for sending a signal
   *
   *    manager.sendSignal({
          'type': 'typing_indicator',
          'object': {
            'id': this.conversation.id
          },
          'data': {
            'action': state
          }
        });
   *
   * @method sendSignal
   * @param  {Object} body - Signal body
   */
  sendSignal(body) {
    if (this._isOpen()) {
      this._socket.send(JSON.stringify({
        type: 'signal',
        body,
      }));
    }
  }

  /**
   * Shortcut to sending a Counter.read request
   *
   * @method getCounter
   * @param  {Function} callback
   * @param {boolean} callback.success
   * @param {number} callback.lastCounter
   * @param {number} callback.newCounter
   */
  getCounter(callback) {
    const tooSoon = Date.now() - this._lastGetCounterRequest < 1000;
    if (tooSoon) {
      if (!this._lastGetCounterId) {
        this._lastGetCounterId = setTimeout(() => {
          this._lastGetCounterId = 0;
          this.getCounter(callback);
        }, Date.now() - this._lastGetCounterRequest - 1000);
      }
      return;
    }
    this._lastGetCounterRequest = Date.now();
    if (this._lastGetCounterId) {
      clearTimeout(this._lastGetCounterId);
      this._lastGetCounterId = 0;
    }

    logger.debug('Websocket request: getCounter');
    this.client.socketRequestManager.sendRequest({
      data: {
        method: 'Counter.read',
      },
      callback: (result) => {
        logger.debug('Websocket response: getCounter ' + result.data.counter);
        if (callback) {
          if (result.success) {
            callback(true, result.data.counter, result.fullData.counter);
          } else {
            callback(false);
          }
        }
      },
      isChangesArray: false,
    });
  }

  /**
   * Replays all missed change packets since the specified timestamp
   *
   * @method resync
   * @param  {string|number}   timestamp - Iso formatted date string; if number will be transformed into formatted date string.
   * @param  {Function} [callback] - Optional callback for completion
   */
  resync(timestamp, callback) {
    if (!timestamp) throw new Error(LayerError.dictionary.valueNotSupported);
    if (typeof timestamp === 'number') timestamp = new Date(timestamp).toISOString();

    // Cancel any prior operation; presumably we lost connection and they're dead anyways,
    // but the callback triggering on these could be disruptive.
    this.client.socketRequestManager.cancelOperation('Event.replay');
    this.client.socketRequestManager.cancelOperation('Presence.sync');
    this._replayEvents(timestamp, () => {
      this._enablePresence(timestamp, () => {
        this.trigger('synced');
        if (callback) callback();
      });
    });
  }

  /**
   * Replays all missed change packets since the specified timestamp
   *
   * @method _replayEvents
   * @private
   * @param  {string|number}   timestamp - Iso formatted date string; if number will be transformed into formatted date string.
   * @param  {Function} [callback] - Optional callback for completion
   */
  _replayEvents(timestamp, callback) {
    // If we are simply unable to replay because we're disconnected, capture the _needsReplayFrom
    if (!this._isOpen() && !this._needsReplayFrom) {
      logger.debug('Websocket request: _replayEvents updating _needsReplayFrom');
      this._needsReplayFrom = timestamp;
    } else {
      logger.info('Websocket request: _replayEvents');
      this.client.socketRequestManager.sendRequest({
        data: {
          method: 'Event.replay',
          data: {
            from_timestamp: timestamp,
          },
        },
        callback: result => this._replayEventsComplete(timestamp, callback, result.success),
        isChangesArray: false,
      });
    }
  }

  /**
   * Callback for handling completion of replay.
   *
   * @method _replayEventsComplete
   * @private
   * @param  {Date}     timestamp
   * @param  {Function} callback
   * @param  {Boolean}   success
   */
  _replayEventsComplete(timestamp, callback, success) {
    if (SocketManager.ENABLE_REPLAY_RETRIES) {
      this._replayEventsCompleteWithRetries(timestamp, callback, success);
    } else {
      this._replayEventsCompleteWithoutRetries(timestamp, callback, success);
    }
  }


  _replayEventsCompleteWithoutRetries(timestamp, callback, success) {
    if (success) {
      this._replayRetryCount = 0;
      this._needsReplayFrom = null;
      logger.info('Websocket replay complete');
      if (callback) callback();
    } else {
      this._needsReplayFrom = null;
      logger.warn('Websocket Event.replay has failed');
    }
  }

  _replayEventsCompleteWithRetries(timestamp, callback, success) {
    if (success) {
      this._replayRetryCount = 0;

      // If replay was completed, and no other requests for replay, then we're done.
      if (!this._needsReplayFrom) {
        logger.info('Websocket replay complete');
        if (callback) callback();
      }

      // If replayEvents was called during a replay, then replay
      // from the given timestamp.  If request failed, then we need to retry from _lastTimestamp
      else if (this._needsReplayFrom) {
        logger.info('Websocket replay partially complete');
        const t = this._needsReplayFrom;
        this._needsReplayFrom = null;
        this.trigger('replaying-events', { from: '_replayEventsComplete', why: '_needsReplayFrom: ' + t });
        this._replayEvents(t);
      }
    }

    // We never got a done event; but either got an error from the server or the request timed out.
    // Use exponential backoff incremented integers that getExponentialBackoffSeconds mapping to roughly
    // 0.4 seconds - 12.8 seconds, and then stops retrying.
    else if (this._replayRetryCount < 8) {
      const maxDelay = 20;
      const backoffCounter = Math.min(this._replayRetryCount + 4, 11);
      const delay = Utils.getExponentialBackoffSeconds(maxDelay, backoffCounter);
      logger.info('Websocket replay retry in ' + delay + ' ms');
      setTimeout(() => {
        this.trigger('replaying-events', { from: '_replayEventsComplete', why: '_replayRetryCount: ' + this._replayRetryCount });
        this._replayEvents(timestamp);
      }, delay * 1000);
      this._replayRetryCount++;
    } else {
      this._needsReplayFrom = null;
      logger.error('Websocket Event.replay has failed');
    }
  }

  /**
   * Resubscribe to presence and replay missed presence changes.
   *
   * @method _enablePresence
   * @private
   * @param  {Date}     timestamp
   * @param  {Function} callback
   */
  _enablePresence(timestamp, callback) {
    this.client.socketRequestManager.sendRequest({
      data: {
        method: 'Presence.subscribe',
      },
      callback: null,
      isChangesArray: false,
    });

    if (this.client.isPresenceEnabled) {
      this.client.socketRequestManager.sendRequest({
        data: {
          method: 'Presence.update',
          data: [
            { operation: 'set', property: 'status', value: 'auto' },
          ],
        },
        callback: null,
        isChangesArray: false,
      });
    }

    if (timestamp) {
      this.syncPresence(timestamp, callback);
    } else if (callback) {
      callback({ success: true });
    }
  }

  /**
   * Synchronize all presence data or catch up on missed presence data.
   *
   * Typically this is called by layer.Websockets.SocketManager._enablePresence automatically,
   * but there may be occasions where an app wants to directly trigger this action.
   *
   * @method syncPresence
   * @param {String} timestamp    `Date.toISOString()` formatted string, returns all presence changes since that timestamp.  Returns all followed presence
   *       if no timestamp is provided.
   * @param {Function} [callback]   Function to call when sync is completed.
   */
  syncPresence(timestamp, callback) {
    if (timestamp) {
      // Return value for use in unit tests
      return this.client.socketRequestManager.sendRequest({
        data: {
          method: 'Presence.sync',
          data: {
            since: timestamp,
          },
        },
        isChangesArray: true,
        callback,
      });
    }
  }

  /**
   * Handles a new websocket packet from the server
   *
   * @method _onMessage
   * @private
   * @param  {Object} evt - Message from the server
   */
  _onMessage(evt) {
    this._lostConnectionCount = 0;
    try {
      const msg = JSON.parse(evt.data);
      const hasZero = msg.counter === 0;
      const isNewConnection = !this._hasZeroCounter && hasZero;
      this._hasZeroCounter = this._hasZeroCounter || hasZero;
      this._lastDataFromServerTimestamp = Date.now();

      // If we're seeing counter of 0 for the second time, our connection has been reset
      if (hasZero && !isNewConnection) {
        this.trigger('replaying-events', { from: '_onMessage', why: 'Zero Counter' });
        this.resync(this._lastTimestamp);
      } else {
        this._lastTimestamp = new Date(msg.timestamp).getTime();
      }

      this.trigger('message', {
        data: msg,
      });

      this._reschedulePing();
    } catch (err) {
      logger.error('Layer-Websocket: Failed to handle websocket message: ' + err + '\n', evt.data);
    }
  }

  /**
   * Reschedule a ping request which helps us verify that the connection is still alive,
   * and that we haven't missed any events.
   *
   * @method _reschedulePing
   * @private
   */
  _reschedulePing() {
    if (this._nextPingId) {
      clearTimeout(this._nextPingId);
    }
    this._nextPingId = setTimeout(this._ping.bind(this), this.pingFrequency);
  }

  /**
   * Send a counter request to the server to verify that we are still connected and
   * have not missed any events.
   *
   * @method _ping
   * @private
   */
  _ping() {
    logger.debug('Websocket ping');
    this._nextPingId = 0;
    if (this._isOpen()) {
      // NOTE: onMessage will already have called reschedulePing, but if there was no response, then the error handler would NOT have called it.
      this.getCounter(this._reschedulePing.bind(this));
    }
  }


  /**
   * Close the websocket.
   *
   * @method close
   */
  close() {
    logger.debug('Websocket close requested');
    this._closing = true;
    this.isOpen = false;
    if (this._socket) {
      // Close all event handlers and set socket to null
      // without waiting for browser event to call
      // _onSocketClose as the next command after close
      // might require creating a new socket
      this._onSocketClose();
      this._socket.close();
      this._socket = null;
    }
  }

  /**
   * Send a packet across the websocket
   * @method send
   * @param {Object} obj
   */
  send(obj) {
    this._socket.send(JSON.stringify(obj));
  }

  destroy() {
    this.trigger('disconnecting', { from: 'destroy', why: 'client is being destroyed' });
    this.close();
    if (this._nextPingId) clearTimeout(this._nextPingId);
    super.destroy();
  }

  /**
   * If the socket has closed (or if the close method forces it closed)
   * Remove all event handlers and if appropriate, schedule a retry.
   *
   * @method _onSocketClose
   * @private
   */
  _onSocketClose() {
    logger.debug('Websocket closed');
    this.isOpen = false;
    if (!this._closing) {
      this.trigger('schedule-reconnect', { from: '_onSocketClose', why: 'Socket closed' });
      this._scheduleReconnect();
    }

    this._removeSocketEvents();
    this.trigger('disconnected');
  }

  /**
   * Removes all event handlers on the current socket.
   *
   * @method _removeSocketEvents
   * @private
   */
  _removeSocketEvents() {
    /* istanbul ignore if */
    if (typeof WebSocket !== 'undefined' && this._socket) {
      this._socket.removeEventListener('message', this._onMessage);
      this._socket.removeEventListener('close', this._onSocketClose);
      this._socket.removeEventListener('open', this._onOpen);
      this._socket.removeEventListener('error', this._onError);
    } else if (this._socket) {
      this._socket.onmessage = null;
      this._socket.onclose = null;
      this._socket.onopen = null;
      this._socket.onerror = null;
    }
    this._clearConnectionFailed();
  }

  /**
   * Schedule an attempt to reconnect to the server.  If the onlineManager
   * declares us to be offline, don't bother reconnecting.  A reconnect
   * attempt will be triggered as soon as the online manager reports we are online again.
   *
   * Note that the duration of our delay can not excede the onlineManager's ping frequency
   * or it will declare us to be offline while we attempt a reconnect.
   *
   * @method _scheduleReconnect
   * @private
   */
  _scheduleReconnect() {
    if (this.isDestroyed || !this.client.isOnline || !this.client.isAuthenticated) return;

    const backoffCounter = Math.min(this._lostConnectionCount + 4, 13);
    const delay = Utils.getExponentialBackoffSeconds(this.maxDelaySecondsBetweenReconnect, backoffCounter);
    this.trigger('scheduling-reconnect', { counter: backoffCounter, delay });
    logger.warn('Websocket Reconnect in ' + delay + ' seconds');
    if (!this._reconnectId) {
      this._reconnectId = setTimeout(() => {
        this._reconnectId = 0;
        this._validateSessionBeforeReconnect();
      }, delay * 1000);
    }
  }

  /**
   * Before the scheduled reconnect can call `connect()` validate that we didn't lose the websocket
   * due to loss of authentication.
   *
   * @method _validateSessionBeforeReconnect
   * @private
   */
  _validateSessionBeforeReconnect() {
    if (this.isDestroyed || !this.client.isOnline || !this.client.isAuthenticated) return;

    this.client.xhr({
      url: '/?action=validateConnectionForWebsocket&client=' + this.client.constructor.version,
      method: 'GET',
      sync: false,
    }, (result) => {
      if (result.success) {
        this.trigger('connecting', { from: '_validateSessionBeforeReconnect', why: 'has valid session token' });
        this.connect();
      } else if (result.status === 401) {
        // client-authenticator.js captures this state and handles it; `connect()` will be called once reauthentication completes
      } else {
        this.trigger('schedule-reconnect', { from: '_validateSessionBeforeReconnect', why: 'Unexpected error: ' + result.status });
        this._scheduleReconnect();
      }
    });
  }
}

/**
 * Is the websocket connection currently open?
 * @type {Boolean}
 */
SocketManager.prototype.isOpen = false;

/**
 * setTimeout ID for calling connect()
 * @private
 * @type {Number}
 */
SocketManager.prototype._reconnectId = 0;

/**
 * setTimeout ID for calling _connectionFailed()
 * @private
 * @type {Number}
 */
SocketManager.prototype._connectionFailedId = 0;

SocketManager.prototype._lastTimestamp = 0;
SocketManager.prototype._lastDataFromServerTimestamp = 0;
SocketManager.prototype._hasZeroCounter = false;

SocketManager.prototype._needsReplayFrom = null;

SocketManager.prototype._replayRetryCount = 0;

SocketManager.prototype._lastGetCounterRequest = 0;
SocketManager.prototype._lastGetCounterId = 0;

/**
 * Frequency with which the websocket checks to see if any websocket notifications
 * have been missed.  This test is done by calling `getCounter`
 *
 * @type {Number}
 */
SocketManager.prototype.pingFrequency = 30000;

/**
 * Delay between reconnect attempts
 *
 * @type {Number}
 */
SocketManager.prototype.maxDelaySecondsBetweenReconnect = 8 * 60;

/**
 * The Client that owns this.
 * @type {layer.Client}
 */
SocketManager.prototype.client = null;

/**
 * The Socket Connection instance
 * @type {Websocket}
 */
SocketManager.prototype._socket = null;

/**
 * Is the websocket connection being closed by a call to close()?
 * If so, we can ignore any errors that signal the socket as closing.
 * @type {Boolean}
 */
SocketManager.prototype._closing = false;

/**
 * Number of failed attempts to reconnect.
 * @type {Number}
 */
SocketManager.prototype._lostConnectionCount = 0;

SocketManager.IGNORE_SKIPPED_COUNTER_INTERVAL = 60000; // 60 seconds

/**
 * If enabled, a failure in replaying missed events will be retried. Otherwise,
 * a failure to replay missed events will accept that some data may have been lost this session,
 * but will be available next time queries refire.
 *
 * @static
 * @property {Boolean} [ENABLE_REPLAY_RETRIES=false]
 */
SocketManager.ENABLE_REPLAY_RETRIES = false;

SocketManager._supportedEvents = [
  /**
   * A data packet has been received from the server.
   * @event message
   * @param {layer.LayerEvent} layerEvent
   * @param {Object} layerEvent.data - The data that was received from the server
   */
  'message',

  /**
   * The websocket is now connected.
   * @event connected
   * @protected
   */
  'connected',

  /**
   * The websocket is no longer connected
   * @event disconnected
   * @protected
   */
  'disconnected',

  /**
   * Websocket events were missed; we are resyncing with the server
   * @event replay-begun
   */
  'syncing',

  /**
   * Websocket events were missed; we resynced with the server and are now done
   * @event replay-begun
   */
  'synced',

  /**
   * Websocket connection request is about to be made
   * @event connecting
   */
  'connecting',

   /**
   * Websocket is being closed
   *
   * @event disconnecting
   * @param {Layer.Core.Event} evt
   * @param {String} evt.from  Describes where the call to scheduleReconnect originated from
   * @param {String} evt.why   Provides detail on why the call was made from there
   */
  'disconnecting',

  /**
   * Websocket Event.replay is about to be issued
   * @event replaying-events
   * @param {Layer.Core.Event} evt
   * @param {String} evt.from  Describes where the call to Event.replay originated from
   * @param {String} evt.why   Provides detail on why the call was made from there
   */
  'replaying-events',

  /**
   * scheduleReconnect has been called
   *
   * @event scheduling-reconnect
   * @param {Layer.Core.Event} evt
   * @param {Number} evt.counter
   * @param {Number} evt.delay
   */
  'scheduling-reconnect',

  /**
   * Websocket reconnect has been scheduled
   *
   * @event schedule-reconnect
   * @param {Layer.Core.Event} evt
   * @param {String} evt.from  Describes where the call to scheduleReconnect originated from
   * @param {String} evt.why   Provides detail on why the call was made from there
   */
  'schedule-reconnect',

  /**
   * Websocket ignored skipped counters without checking for missed websocket data
   *
   * @event ignore-skipped-counter
   * @param {Layer.Core.Event} evt
   * @param {String} evt.from  Describes where the call to scheduleReconnect originated from
   * @param {String} evt.why   Provides detail on why the call was made from there
   */
  'ignore-skipped-counter',

].concat(Root._supportedEvents);
Root.initClass.apply(SocketManager, [SocketManager, 'SocketManager']);
module.exports = SocketManager;

