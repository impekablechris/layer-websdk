/**
 * The Layer Client; this is the top level component for any Layer based application.

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
      challenge: function(evt) {
        myAuthenticator({
          nonce: evt.nonce,
          onSuccess: evt.callback
        });
      },
      ready: function(client) {
        alert('I am Client; Server: Serve me!');
      }
    }).connect('Fred')
 *
 * You can also initialize this as

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff'
    });

    client.on('challenge', function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    });

    client.on('ready', function(client) {
      alert('I am Client; Server: Serve me!');
    });

    client.connect('Fred');
 *
 * ## API Synopsis:
 *
 * The following Properties, Methods and Events are the most commonly used ones.  See the full API below
 * for the rest of the API.
 *
 * ### Properties:
 *
 * * layer.Client.userId: User ID of the authenticated user
 * * layer.Client.appId: The ID for your application
 *
 *
 * ### Methods:
 *
 * * layer.Client.createConversation(): Create a new layer.Conversation.
 * * layer.Client.createQuery(): Create a new layer.Query.
 * * layer.Client.getMessage(): Input a Message ID, and output a layer.Message or layer.Announcement from cache.
 * * layer.Client.getConversation(): Input a Conversation ID, and output a layer.Conversation from cache.
 * * layer.Client.on() and layer.Conversation.off(): event listeners
 * * layer.Client.destroy(): Cleanup all resources used by this client, including all Messages and Conversations.
 *
 * ### Events:
 *
 * * `challenge`: Provides a nonce and a callback; you call the callback once you have an Identity Token.
 * * `ready`: Your application can now start using the Layer services
 * * `messages:notify`: Used to notify your application of new messages for which a local notification may be suitable.
 *
 * ## Logging:
 *
 * There are two ways to change the log level for Layer's logger:
 *
 *     layer.Client.prototype.logLevel = layer.Constants.LOG.INFO;
 *
 * or
 *
 *     var client = new layer.Client({
 *        appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
 *        logLevel: layer.Constants.LOG.INFO
 *     });
 *
 * @class  layer.Client
 * @extends layer.ClientAuthenticator
 * @mixin layer.mixins.ClientIdentities
 * //@ mixin layer.mixins.ClientMembership
 * @mixin layer.mixins.ClientConversations
 * //@ mixin layer.mixins.ClientChannels
 * @mixin layer.mixins.ClientMessages
 * @mixin layer.mixins.ClientQueries
 * @mixin layer.mixin.WebsocketOperations
 */

const ClientAuth = require('./client-authenticator');
const Conversation = require('./models/conversation');
const Channel = require('./models/channel');
const ErrorDictionary = require('./layer-error').dictionary;
const ConversationMessage = require('./models/conversation-message');
const ChannelMessage = require('./models/channel-message');
const Announcement = require('./models/announcement');
const Identity = require('./models/identity');
const Membership = require('./models/membership');
const TypingIndicatorListener = require('./typing-indicators/typing-indicator-listener');
const Util = require('./client-utils');
const Root = require('./root');
const ClientRegistry = require('./client-registry');
const logger = require('./logger');
const TypingListener = require('./typing-indicators/typing-listener');
const TypingPublisher = require('./typing-indicators/typing-publisher');
const TelemetryMonitor = require('./telemetry-monitor');

class Client extends ClientAuth {

  /*
   * Adds conversations, messages and websockets on top of the authentication client.
   * jsdocs on parent class constructor.
   */
  constructor(options) {
    super(options);
    ClientRegistry.register(this);
    this._models = {};
    this._runMixins('constructor', [options]);

    // Initialize Properties
    this._scheduleCheckAndPurgeCacheItems = [];

    this._initComponents();

    this.on('online', this._connectionRestored.bind(this));

    logger.info(Util.asciiInit(Client.version));
  }

  /* See parent method docs */
  _initComponents() {
    super._initComponents();

    this._typingIndicators = new TypingIndicatorListener({
      clientId: this.appId,
    });
    this.telemetryMonitor = new TelemetryMonitor({
      client: this,
      enabled: this.telemetryEnabled,
    });
  }

  /**
   * Cleanup all resources (Conversations, Messages, etc...) prior to destroy or reauthentication.
   *
   * @method _cleanup
   * @private
   */
  _cleanup() {
    if (this.isDestroyed) return;
    this._inCleanup = true;

    try {
      this._runMixins('cleanup', []);
    } catch (e) {
      logger.error(e);
    }

    if (this.socketManager) this.socketManager.close();
    this._inCleanup = false;
  }

  destroy() {
    // Cleanup all resources (Conversations, Messages, etc...)
    this._cleanup();

    this._destroyComponents();

    ClientRegistry.unregister(this);

    super.destroy();
    this._inCleanup = false;
  }

  __adjustAppId() {
    if (this.appId) throw new Error(ErrorDictionary.appIdImmutable);
  }

  /**
   * Takes an array of Identity instances, User IDs, Identity IDs, Identity objects,
   * or Server formatted Identity Objects and returns an array of Identity instances.
   *
   * @method _fixIdentities
   * @private
   * @param {Mixed[]} identities - Something that tells us what Identity to return
   * @return {layer.Identity[]}
   */
  _fixIdentities(identities) {
    return identities.map((identity) => {
      if (identity instanceof Identity) return identity;
      if (typeof identity === 'string') {
        return this.getIdentity(identity, true);
      } else if (identity && typeof identity === 'object') {
        if ('userId' in identity) {
          return this.getIdentity(identity.id || identity.userId);
        } else if ('user_id' in identity) {
          return this._createObject(identity);
        }
      }
      return null;
    });
  }


  /**
   * Takes as input an object id, and either calls getConversation() or getMessage() as needed.
   *
   * Will only get cached objects, will not get objects from the server.
   *
   * This is not a public method mostly so there's no ambiguity over using getXXX
   * or getObject.  getXXX typically has an option to load the resource, which this
   * does not.
   *
   * @method getObject
   * @param  {string} id - Message, Conversation or Query id
   * @param  {boolean} [canLoad=false] - Pass true to allow loading a object from
   *                                     the server if not found (not supported for all objects)
   * @return {layer.Message|layer.Conversation|layer.Query}
   */
  getObject(id, canLoad = false) {
    switch (Util.typeFromID(id)) {
      case 'messages':
      case 'announcements':
        return this.getMessage(id, canLoad);
      case 'conversations':
        return this.getConversation(id, canLoad);
      case 'channels':
        return this.getChannel(id, canLoad);
      case 'queries':
        return this.getQuery(id);
      case 'identities':
        return this.getIdentity(id, canLoad);
      case 'members':
        return this.getMember(id, canLoad);
    }
    return null;
  }


  /**
   * Takes an object description from the server and either updates it (if cached)
   * or creates and caches it .
   *
   * @method _createObject
   * @protected
   * @param  {Object} obj - Plain javascript object representing a Message or Conversation
   */
  _createObject(obj) {
    const item = this.getObject(obj.id);
    if (item) {
      item._populateFromServer(obj);
      return item;
    } else {
      switch (Util.typeFromID(obj.id)) {
        case 'messages':
          if (obj.conversation) {
            return ConversationMessage._createFromServer(obj, this);
          } else if (obj.channel) {
            return ChannelMessage._createFromServer(obj, this);
          }
          break;
        case 'announcements':
          return Announcement._createFromServer(obj, this);
        case 'conversations':
          return Conversation._createFromServer(obj, this);
        case 'channels':
          return Channel._createFromServer(obj, this);
        case 'identities':
          return Identity._createFromServer(obj, this);
        case 'members':
          return Membership._createFromServer(obj, this);
      }
    }
    return null;
  }

  /**
   * When a layer.Container's ID changes, we need to update
   * a variety of things and trigger events.
   *
   * @method _updateContainerId
   * @param {layer.Container} container
   * @param {String} oldId
   */
  _updateContainerId(container, oldId) {
    if (container instanceof Conversation) {
      this._updateConversationId(container, oldId);
    } else {
      this._updateChannelId(container, oldId);
    }
  }

  /**
   * Merge events into smaller numbers of more complete events.
   *
   * Before any delayed triggers are fired, fold together all of the conversations:add
   * and conversations:remove events so that 100 conversations:add events can be fired as
   * a single event.
   *
   * @method _processDelayedTriggers
   * @private
   */
  _processDelayedTriggers() {
    if (this.isDestroyed) return;

    const addConversations = this._delayedTriggers.filter(evt => evt[0] === 'conversations:add');
    const removeConversations = this._delayedTriggers.filter(evt => evt[0] === 'conversations:remove');
    this._foldEvents(addConversations, 'conversations', this);
    this._foldEvents(removeConversations, 'conversations', this);

    const addMessages = this._delayedTriggers.filter(evt => evt[0] === 'messages:add');
    const removeMessages = this._delayedTriggers.filter(evt => evt[0] === 'messages:remove');

    this._foldEvents(addMessages, 'messages', this);
    this._foldEvents(removeMessages, 'messages', this);

    const addIdentities = this._delayedTriggers.filter(evt => evt[0] === 'identities:add');
    const removeIdentities = this._delayedTriggers.filter(evt => evt[0] === 'identities:remove');

    this._foldEvents(addIdentities, 'identities', this);
    this._foldEvents(removeIdentities, 'identities', this);

    super._processDelayedTriggers();
  }

  trigger(eventName, evt) {
    this._triggerLogger(eventName, evt);
    super.trigger(eventName, evt);
  }

  /**
   * Does logging on all triggered events.
   *
   * All logging is done at `debug` or `info` levels.
   *
   * @method _triggerLogger
   * @private
   */
  _triggerLogger(eventName, evt) {
    const infoEvents = [
      'conversations:add', 'conversations:remove', 'conversations:change',
      'messages:add', 'messages:remove', 'messages:change',
      'identities:add', 'identities:remove', 'identities:change',
      'challenge', 'ready',
    ];
    if (infoEvents.indexOf(eventName) !== -1) {
      if (evt && evt.isChange) {
        logger.info(`Client Event: ${eventName} ${evt.changes.map(change => change.property).join(', ')}`);
      } else {
        let text = '';
        if (evt) {
          // If the triggered event has these messages, use a simpler way of rendering info about them
          if (evt.message) text = evt.message.id;
          if (evt.messages) text = evt.messages.length + ' messages';
          if (evt.conversation) text = evt.conversation.id;
          if (evt.conversations) text = evt.conversations.length + ' conversations';
          if (evt.channel) text = evt.channel.id;
          if (evt.channels) text = evt.channels.length + ' channels';
        }
        logger.info(`Client Event: ${eventName} ${text}`);
      }
      if (evt) logger.debug(evt);
    } else {
      logger.debug(eventName, evt);
    }
  }

  /**
   * If the session has been reset, dump all data.
   *
   * @method _resetSession
   * @private
   */
  _resetSession() {
    this._cleanup();
    this._runMixins('reset', []);
    return super._resetSession();
  }


  /**
   * Check to see if the specified objects can safely be removed from cache.
   *
   * Removes from cache if an object is not part of any Query's result set.
   *
   * @method _checkAndPurgeCache
   * @private
   * @param  {layer.Root[]} objects - Array of Messages or Conversations
   */
  _checkAndPurgeCache(objects) {
    this._inCheckAndPurgeCache = true;
    objects.forEach((obj) => {
      if (!obj.isDestroyed && !this._isCachedObject(obj)) {
        if (obj instanceof Root === false) obj = this.getObject(obj.id);
        if (obj) obj.destroy();
      }
    });
    this._inCheckAndPurgeCache = false;
  }

  /**
   * Schedules _runScheduledCheckAndPurgeCache if needed, and adds this object
   * to the list of objects it will validate for uncaching.
   *
   * Note that any object that does not exist on the server (!isSaved()) is an object that the
   * app created and can only be purged by the app and not by the SDK.  Once its been
   * saved, and can be reloaded from the server when needed, its subject to standard caching.
   *
   * @method _scheduleCheckAndPurgeCache
   * @private
   * @param {layer.Root} object
   */
  _scheduleCheckAndPurgeCache(object) {
    if (object.isSaved()) {
      if (this._scheduleCheckAndPurgeCacheAt < Date.now()) {
        this._scheduleCheckAndPurgeCacheAt = Date.now() + Client.CACHE_PURGE_INTERVAL;
        setTimeout(() => this._runScheduledCheckAndPurgeCache(), Client.CACHE_PURGE_INTERVAL);
      }
      this._scheduleCheckAndPurgeCacheItems.push(object);
    }
  }

  /**
   * Calls _checkAndPurgeCache on accumulated objects and resets its state.
   *
   * @method _runScheduledCheckAndPurgeCache
   * @private
   */
  _runScheduledCheckAndPurgeCache() {
    const list = this._scheduleCheckAndPurgeCacheItems;
    this._scheduleCheckAndPurgeCacheItems = [];
    this._checkAndPurgeCache(list);
    this._scheduleCheckAndPurgeCacheAt = 0;
  }

  /**
   * Returns true if the specified object should continue to be part of the cache.
   *
   * Result is based on whether the object is part of the data for a Query.
   *
   * @method _isCachedObject
   * @private
   * @param  {layer.Root} obj - A Message or Conversation Instance
   * @return {Boolean}
   */
  _isCachedObject(obj) {
    const list = Object.keys(this._models.queries);
    for (let i = 0; i < list.length; i++) {
      const query = this._models.queries[list[i]];
      if (query._getItem(obj.id)) return true;
    }
    return false;
  }

  /**
   * On restoring a connection, determine what steps need to be taken to update our data.
   *
   * A reset boolean property is passed; set based on  layer.ClientAuthenticator.ResetAfterOfflineDuration.
   *
   * Note it is possible for an application to have logic that causes queries to be created/destroyed
   * as a side-effect of layer.Query.reset destroying all data. So we must test to see if queries exist.
   *
   * @method _connectionRestored
   * @private
   * @param {boolean} reset - Should the session reset/reload all data or attempt to resume where it left off?
   */
  _connectionRestored(evt) {
    if (evt.reset) {
      logger.debug('Client Connection Restored; Resetting all Queries');
      this.dbManager.deleteTables(() => {
        this.dbManager._open();
        Object.keys(this._models.queries).forEach((id) => {
          const query = this._models.queries[id];
          if (query) query.reset();
        });
      });
    }
  }

  /**
   * Creates a layer.TypingIndicators.TypingListener instance
   * bound to the specified dom node.
   *
   *      var typingListener = client.createTypingListener(document.getElementById('myTextBox'));
   *      typingListener.setConversation(mySelectedConversation);
   *
   * Use this method to instantiate a listener, and call
   * layer.TypingIndicators.TypingListener.setConversation every time you want to change which Conversation
   * it reports your user is typing into.
   *
   * @method createTypingListener
   * @param  {HTMLElement} inputNode - Text input to watch for keystrokes
   * @return {layer.TypingIndicators.TypingListener}
   */
  createTypingListener(inputNode) {
    return new TypingListener({
      clientId: this.appId,
      input: inputNode,
    });
  }

  /**
   * Creates a layer.TypingIndicators.TypingPublisher.
   *
   * The TypingPublisher lets you manage your Typing Indicators without using
   * the layer.TypingIndicators.TypingListener.
   *
   *      var typingPublisher = client.createTypingPublisher();
   *      typingPublisher.setConversation(mySelectedConversation);
   *      typingPublisher.setState(layer.TypingIndicators.STARTED);
   *
   * Use this method to instantiate a listener, and call
   * layer.TypingIndicators.TypingPublisher.setConversation every time you want to change which Conversation
   * it reports your user is typing into.
   *
   * Use layer.TypingIndicators.TypingPublisher.setState to inform other users of your current state.
   * Note that the `STARTED` state only lasts for 2.5 seconds, so you
   * must repeatedly call setState for as long as this state should continue.
   * This is typically done by simply calling it every time a user hits
   * a key.
   *
   * @method createTypingPublisher
   * @return {layer.TypingIndicators.TypingPublisher}
   */
  createTypingPublisher() {
    return new TypingPublisher({
      clientId: this.appId,
    });
  }

  /**
   * Get the current typing indicator state of a specified Conversation.
   *
   * Typically used to see if anyone is currently typing when first opening a Conversation.
   *
   * @method getTypingState
   * @param {String} conversationId
   */
  getTypingState(conversationId) {
    return this._typingIndicators.getState(conversationId);
  }

  /**
   * Accessor for getting a Client by appId.
   *
   * Most apps will only have one client,
   * and will not need this method.
   *
   * @method getClient
   * @static
   * @param  {string} appId
   * @return {layer.Client}
   */
  static getClient(appId) {
    return ClientRegistry.get(appId);
  }

  static destroyAllClients() {
    ClientRegistry.getAll().forEach(client => client.destroy());
  }

  /**
   * Listen for a new Client to be registered.
   *
   * If your code needs a client, and it doesn't yet exist, you
   * can use this to get called when the client exists.
   *
   * ```
   * layer.Client.addListenerForNewClient(function(client) {
   *    mycomponent.setClient(client);
   * });
   * ```
   *
   * @method addListenerForNewClient
   * @static
   * @param {Function} listener
   * @param {layer.Client} listener.client
   */
  static addListenerForNewClient(listener) {
    ClientRegistry.addListener(listener);
  }

  /**
   * Remove listener for a new Client.
   *
   *
   * ```
   * var f = function(client) {
   *    mycomponent.setClient(client);
   *    layer.Client.removeListenerForNewClient(f);
   * };
   *
   * layer.Client.addListenerForNewClient(f);
   * ```
   *
   * Calling with null will remove all listeners.
   *
   * @method removeListenerForNewClient
   * @static
   * @param {Function} listener
   */
  static removeListenerForNewClient(listener) {
    ClientRegistry.removeListener(listener);
  }
}

/**
 * Array of items to be checked to see if they can be uncached.
 *
 * @private
 * @type {layer.Root[]}
 */
Client.prototype._scheduleCheckAndPurgeCacheItems = null;

/**
 * Time that the next call to _runCheckAndPurgeCache() is scheduled for in ms since 1970.
 *
 * @private
 * @type {number}
 */
Client.prototype._scheduleCheckAndPurgeCacheAt = 0;


/**
 * Set to false to disable telemetry gathering.
 *
 * No content nor identifiable information is gathered, only
 * usage and performance metrics.
 *
 * @type {Boolean}
 */
Client.prototype.telemetryEnabled = true;

/**
 * Gather usage and responsiveness statistics
 *
 * @private
 */
Client.prototype.telemetryMonitor = null;

Client.prototype._tabId = Util.generateUUID();

/**
 * Get the version of the Client library.
 *
 * @static
 * @type {String}
 */
Client.version = '3.4.16';

/**
 * Any  Message that is part of a Query's results are kept in memory for as long as it
 * remains in that Query.  However, when a websocket event delivers new Messages  that
 * are NOT part of a Query, how long should they stick around in memory?  Why have them stick around?
 * Perhaps an app wants to post a notification of a new Message or Conversation... and wants to keep
 * the object local for a little while.  Default is 2 hours before checking to see if
 * the object is part of a Query or can be uncached.  Value is in miliseconds.
 * @static
 * @type {number}
 */
Client.CACHE_PURGE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours * 60 minutes per hour * 60 seconds per minute * 1000 miliseconds/second

Client._ignoredEvents = [
  'conversations:loaded',
  'conversations:loaded-error',
];

Client._supportedEvents = [
  /**
   * A Typing Indicator state has changed.
   *
   * Either a change has been received
   * from the server, or a typing indicator state has expired.
   *
   *      client.on('typing-indicator-change', function(evt) {
   *          if (evt.conversationId === myConversationId) {
   *              alert(evt.typing.join(', ') + ' are typing');
   *              alert(evt.paused.join(', ') + ' are paused');
   *          }
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {string} conversationId - ID of the Conversation users are typing into
   * @param {string[]} typing - Array of user IDs who are currently typing
   * @param {string[]} paused - Array of user IDs who are currently paused;
   *                            A paused user still has text in their text box.
   */
  'typing-indicator-change',

].concat(ClientAuth._supportedEvents);

Client.mixins = [
  require('./mixins/client-queries'),
  require('./mixins/client-identities'),
  require('./mixins/client-members'),
  require('./mixins/client-conversations'),
  require('./mixins/client-channels'),
  require('./mixins/client-messages'),
  require('./mixins/websocket-operations'),
];
Root.initClass.apply(Client, [Client, 'Client']);
module.exports = Client;

