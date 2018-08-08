/**
 * The Syncable abstract clas represents resources that are syncable with the server.
 * This is currently used for Messages and Conversations.
 * It represents the state of the object's sync, as one of:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @class layer.Syncable
 * @extends layer.Root
 * @abstract
 */

const Root = require('../root');
const { SYNC_STATE } = require('../const');
const LayerError = require('../layer-error');
const ClientRegistry = require('../client-registry');
const Constants = require('../const');

class Syncable extends Root {
  constructor(options = {}) {
    super(options);
    this.localCreatedAt = new Date();
  }

  /**
   * Get the client associated with this Object.
   *
   * @method getClient
   * @return {layer.Client}
   */
  getClient() {
    return ClientRegistry.get(this.clientId);
  }

  /**
   * Fire an XHR request using the URL for this resource.
   *
   * For more info on xhr method parameters see {@link layer.ClientAuthenticator#xhr}
   *
   * @method _xhr
   * @protected
   * @return {layer.Syncable} this
   */
  _xhr(options, callback) {
    // initialize
    if (!options.url) options.url = '';
    if (!options.method) options.method = 'GET';
    const client = this.getClient();

    // Validatation
    if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
    if (!client) throw new Error(LayerError.dictionary.clientMissing);
    if (!this.constructor.enableOpsIfNew &&
      options.method !== 'POST' && options.method !== 'GET' &&
      this.syncState === Constants.SYNC_STATE.NEW) return this;

    if (!options.url.match(/^https?:\/\//)) {
      if (options.url && !options.url.match(/^(\/|\?)/)) options.url = '/' + options.url;
      if (!options.sync) options.url = this.url + options.url;
    }

    // Setup sync structure
    options.sync = this._setupSyncObject(options.sync);

    if (options.method !== 'GET') {
      this._setSyncing();
    }

    client.xhr(options, (result) => {
      if (result.success && options.method !== 'GET' && !this.isDestroyed) {
        this._setSynced();
      }
      if (callback) callback(result);
    });
    return this;
  }

  /**
   * Setup an object to pass in the `sync` parameter for any sync requests.
   *
   * @method _setupSyncObject
   * @private
   * @param {Object} sync - Known parameters of the sync object to be returned; or null.
   * @return {Object} fleshed out sync object
   */
  _setupSyncObject(sync) {
    if (sync !== false) {
      if (!sync) sync = {};
      if (!sync.target) sync.target = this.id;
    }
    return sync;
  }

  /**
   * A websocket event has been received specifying that this resource
   * has been deleted.
   *
   * @method handleWebsocketDelete
   * @protected
   * @param {Object} data
   */
  _handleWebsocketDelete(data) {
    this._deleted();
    this.destroy();
  }

  /**
   * The Object has been deleted.
   *
   * Destroy must be called separately, and handles most cleanup.
   *
   * @method _deleted
   * @protected
   */
  _deleted() {
    this.trigger(this.constructor.eventPrefix + ':delete');
  }


  /**
   * Load the resource identified via a Layer ID.
   *
   * Will load the requested resource from persistence or server as needed,
   * and trigger `type-name:loaded` when its loaded.  Instance returned by this
   * method will have only ID and URL properties, all others are unset until
   * the `conversations:loaded`, `messages:loaded`, etc... event has fired.
   *
   * ```
   * var message = layer.Message.load(messageId, client);
   * message.once('messages:loaded', function(evt) {
   *    alert("Message loaded");
   * });
   * ```
   *
   * @method load
   * @static
   * @param {string} id - `layer:///messages/UUID`
   * @param {layer.Client} client
   * @return {layer.Syncable} - Returns an empty object that will be populated once data is loaded.
   */
  static load(id, client) {
    if (!client || !(client instanceof Root)) throw new Error(LayerError.dictionary.clientMissing);

    const obj = {
      id,
      url: client.url + id.substring(8),
      clientId: client.appId,
    };

    if (!Syncable.sortedSubclasses) {
      Syncable.sortedSubclasses = Syncable.subclasses.filter(item => item.prefixUUID)
        .sort((a, b) => a.prefixUUID.length - b.prefixUUID.length);
    }

    const ConstructorClass = Syncable.sortedSubclasses.filter((aClass) => {
      if (aClass.prefixUUID.indexOf('layer:///') === 0) {
        return obj.id.indexOf(aClass.prefixUUID) === 0;
      } else {
        return obj.id.indexOf(aClass.prefixUUID) !== -1;
      }
    })[0];
    const syncItem = new ConstructorClass(obj);
    const typeName = ConstructorClass.eventPrefix;

    if (typeName) {
      if (!client.dbManager) {
        syncItem.syncState = SYNC_STATE.LOADING;
        client.once('ready', () => syncItem._load());
      } else {
        client.dbManager.getObject(typeName, id, (item) => {
          if (syncItem.isDestroyed) return;
          if (item) {
            syncItem._populateFromServer(item);
            syncItem.trigger(typeName + ':loaded');
          } else if (!client.isReady) {
            syncItem.syncState = SYNC_STATE.LOADING;
            client.once('ready', () => syncItem._load());
          } else {
            syncItem._load();
          }
        });
      }
    } else {
      syncItem._load();
    }

    syncItem.syncState = SYNC_STATE.LOADING;
    return syncItem;
  }

  /**
   * Load this resource from the server.
   *
   * Called from the static layer.Syncable.load() method
   *
   * @method _load
   * @private
   */
  _load() {
    this.syncState = SYNC_STATE.LOADING;
    this._xhr({
      method: 'GET',
      sync: false,
    }, result => this._loadResult(result));
  }


  _loadResult(result) {
    if (this.isDestroyed) return;
    const prefix = this.constructor.eventPrefix;
    if (!result.success) {
      this.syncState = SYNC_STATE.NEW;
      this._triggerAsync(prefix + ':loaded-error', { error: result.data });
      setTimeout(() => {
        if (!this.isDestroyed) this.destroy();
      }, 100); // Insure destroyed AFTER loaded-error event has triggered
    } else {
      this._populateFromServer(result.data);
      this._loaded(result.data);
      this.trigger(prefix + ':loaded');
    }
  }

  /**
   * Processing the result of a _load() call.
   *
   * Typically used to register the object and cleanup any properties not handled by _populateFromServer.
   *
   * @method _loaded
   * @private
   * @param  {Object} data - Response data from server
   */
  _loaded(data) {

  }

  /**
   * Object is new, and is queued for syncing, but does not yet exist on the server.
   *
   * That means it is currently out of sync with the server.
   *
   * @method _setSyncing
   * @private
   */
  _setSyncing() {
    this._clearObject();
    switch (this.syncState) {
      case SYNC_STATE.SYNCED:
        this.syncState = SYNC_STATE.SYNCING;
        break;
      case SYNC_STATE.NEW:
        this.syncState = SYNC_STATE.SAVING;
        break;
    }
    this._syncCounter++;
  }

  /**
   * Object is synced with the server and up to date.
   *
   * @method _setSynced
   * @private
   */
  _setSynced() {
    this._clearObject();
    if (this._syncCounter > 0) this._syncCounter--;

    this.syncState = this._syncCounter === 0 ? SYNC_STATE.SYNCED :
                          SYNC_STATE.SYNCING;
    this.isSending = false;
  }

  /**
   * Any time the instance changes, we should clear the cached toObject value
   *
   * @method _clearObject
   * @private
   */
  _clearObject() {
    this._toObject = null;
  }

  /**
   * Returns a plain object.
   *
   * Object will have all the same public properties as this
   * Syncable instance.  New object is returned any time
   * any of this object's properties change.
   *
   * @method toObject
   * @return {Object} POJO version of this object.
   */
  toObject() {
    if (!this._toObject) {
      this._toObject = super.toObject();
      this._toObject.isNew = this.isNew();
      this._toObject.isSaving = this.isSaving();
      this._toObject.isSaved = this.isSaved();
      this._toObject.isSynced = this.isSynced();
    }
    return this._toObject;
  }

  /**
   * Object is new, and is not yet queued for syncing
   *
   * @method isNew
   * @returns {boolean}
   */
  isNew() {
    return this.syncState === SYNC_STATE.NEW;
  }

  /**
   * Object is new, and is queued for syncing
   *
   * @method isSaving
   * @returns {boolean}
   */
  isSaving() {
    return this.syncState === SYNC_STATE.SAVING;
  }

  /**
   * Object exists on server.
   *
   * @method isSaved
   * @returns {boolean}
   */
  isSaved() {
    return !(this.isNew() || this.isSaving());
  }

  /**
   * Object is fully synced.
   *
   * As best we know, server and client have the same values.
   *
   * @method isSynced
   * @returns {boolean}
   */
  isSynced() {
    return this.syncState === SYNC_STATE.SYNCED;
  }
}

/**
 * Unique identifier.
 *
 * @type {string}
 */
Syncable.prototype.id = '';

/**
 * URL to access the object on the server.
 *
 * @type {string}
 * @readonly
 * @protected
 */
Syncable.prototype.url = '';

/**
 * The time that this client created this instance.
 *
 * This value is not tied to when it was first created on the server.  Creating a new instance
 * based on server data will result in a new `localCreateAt` value.
 *
 * @type {Date}
 */
Syncable.prototype.localCreatedAt = null;


/**
 * layer.Client that the object belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @protected
 * @readonly
 */
Syncable.prototype.clientId = '';

/**
 * Temporary property indicating that the instance was loaded from local database rather than server.
 *
 * @type {boolean}
 * @private
 */
Syncable.prototype._fromDB = false;

/**
 * The current sync state of this object.
 *
 * Possible values are:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @type {string}
 */
Syncable.prototype.syncState = SYNC_STATE.NEW;

/**
 * Number of sync requests that have been requested.
 *
 * Counts down to zero; once it reaches zero, all sync
 * requests have been completed.
 *
 * @type {Number}
 * @private
 */
Syncable.prototype._syncCounter = 0;

/**
 * Prefix to use when triggering events
 * @private
 * @static
 */
Syncable.eventPrefix = '';

Syncable.enableOpsIfNew = false;

/**
 * Is the object loading from the server?
 *
 * @type {boolean}
 */
Object.defineProperty(Syncable.prototype, 'isLoading', {
  enumerable: true,
  get: function get() {
    return this.syncState === SYNC_STATE.LOADING;
  },
});

/**
 * Array of classes that are subclasses of Syncable.
 *
 * Used by Factory function.
 * @private
 */
Syncable.subclasses = [];

Syncable._supportedEvents = [].concat(Root._supportedEvents);
Syncable.inObjectIgnore = Root.inObjectIgnore;
module.exports = Syncable;
