/**
 * The Message Class represents Messages sent amongst participants
 * of of a Conversation.
 *
 * The simplest way to create and send a message is:
 *
 *      var m = conversation.createMessage('Hello there').send();
 *      var m = channel.createMessage('Hello there').send();
 *
 * For conversations that involve notifications (primarily for Android and IOS), the more common pattern is:
 *
 *      var m = conversation.createMessage('Hello there').send({text: "Message from Fred: Hello there"});
 *
 * Channels do not at this time support notifications.
 *
 * Typically, rendering would be done as follows:
 *
 *      // Create a layer.Query that loads Messages for the
 *      // specified Conversation.
 *      var query = client.createQuery({
 *        model: Query.Message,
 *        predicate: 'conversation = "' + conversation.id + '"'
 *      });
 *
 *      // Any time the Query's data changes the 'change'
 *      // event will fire.
 *      query.on('change', function(layerEvt) {
 *        renderNewMessages(query.data);
 *      });
 *
 *      // This will call will cause the above event handler to receive
 *      // a change event, and will update query.data.
 *      conversation.createMessage('Hello there').send();
 *
 * The above code will trigger the following events:
 *
 *  * Message Instance fires
 *    * messages:sending: An event that lets you modify the message prior to sending
 *    * messages:sent: The message was received by the server
 *  * Query Instance fires
 *    * change: The query has received a new Message
 *    * change:add: Same as the change event but does not receive other types of change events
 *
 * When creating a Message there are a number of ways to structure it.
 * All of these are valid and create the same exact Message:
 *
 *      // Full API style:
 *      var m = conversation.createMessage({
 *          parts: [new layer.MessagePart({
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          })]
 *      });
 *
 *      // Option 1: Pass in an Object instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: {
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }
 *      });
 *
 *      // Option 2: Pass in an array of Objects instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: [{
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }]
 *      });
 *
 *      // Option 3: Pass in a string (automatically assumes mimeType is text/plain)
 *      // instead of an array of objects.
 *      var m = conversation.createMessage({
 *          parts: 'Hello'
 *      });
 *
 *      // Option 4: Pass in an array of strings (automatically assumes mimeType is text/plain)
 *      var m = conversation.createMessage({
 *          parts: ['Hello']
 *      });
 *
 *      // Option 5: Pass in just a string and nothing else
 *      var m = conversation.createMessage('Hello');
 *
 *      // Option 6: Use addPart.
 *      var m = converseation.createMessage();
 *      m.addPart({body: "hello", mimeType: "text/plain"});
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Message.id: this property is worth being familiar with; it identifies the
 *   Message and can be used in `client.getMessage(id)` to retrieve it
 *   at any time.
 * * layer.Message.internalId: This property makes for a handy unique ID for use in dom nodes.
 *   It is gaurenteed not to change during this session.
 * * layer.Message.isRead: Indicates if the Message has been read yet; set `m.isRead = true`
 *   to tell the client and server that the message has been read.
 * * layer.Message.parts: An array of layer.MessagePart classes representing the contents of the Message.
 * * layer.Message.sentAt: Date the message was sent
 * * layer.Message.sender `userId`: Conversation participant who sent the Message. You may
 *   need to do a lookup on this id in your own servers to find a
 *   displayable name for it.
 *
 * Methods:
 *
 * * layer.Message.send(): Sends the message to the server and the other participants.
 * * layer.Message.on() and layer.Message.off(); event listeners built on top of the `backbone-events-standalone` npm project
 *
 * Events:
 *
 * * `messages:sent`: The message has been received by the server. Can also subscribe to
 *   this event from the layer.Client which is usually simpler.
 *
 * @class  layer.Message
 * @extends layer.Syncable
 */

const Root = require('../root');
const Syncable = require('./syncable');
const MessagePart = require('./message-part');
const LayerError = require('../layer-error');
const Constants = require('../const');
const Util = require('../client-utils');
const Identity = require('./identity');

class Message extends Syncable {
  /**
   * See layer.Conversation.createMessage()
   *
   * @method constructor
   * @return {layer.Message}
   */
  constructor(options = {}) {
    // Unless this is a server representation, this is a developer's shorthand;
    // fill in the missing properties around isRead/isUnread before initializing.
    if (!options.fromServer) {
      if ('isUnread' in options) {
        options.isRead = !options.isUnread && !options.is_unread;
        delete options.isUnread;
      } else {
        options.isRead = true;
      }
    } else {
      options.id = options.fromServer.id;
    }

    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error(LayerError.dictionary.clientMissing);

    // Insure __adjustParts is set AFTER clientId is set.
    const parts = options.parts;
    options.parts = null;

    super(options);
    this.parts = parts;

    const client = this.getClient();
    this.isInitializing = true;
    if (options && options.fromServer) {
      this._populateFromServer(options.fromServer);
      this.__updateParts(this.parts);
    } else {
      if (client) this.sender = client.user;
      this.sentAt = new Date();
    }

    if (!this.parts) this.parts = [];
    this._regenerateMimeAttributesMap();
  }


  __adjustUpdatedAt(date) {
    if (typeof date === 'string') return new Date(date);
  }

  /**
   * Turn input into valid layer.MessageParts.
   *
   * This method is automatically called any time the parts
   * property is set (including during intialization).  This
   * is where we convert strings into MessageParts, and instances
   * into arrays.
   *
   * @method __adjustParts
   * @private
   * @param  {Mixed} parts -- Could be a string, array, object or MessagePart instance
   * @return {layer.MessagePart[]}
   */
  __adjustParts(parts) {
    let adjustedParts;
    if (typeof parts === 'string') {
      adjustedParts = [new MessagePart({
        body: parts,
        mimeType: 'text/plain',
        clientId: this.clientId,
      })];
    } else if (Array.isArray(parts)) {
      adjustedParts = parts.map((part) => {
        let result;
        if (part instanceof MessagePart) {
          result = part;
        } else if (part.mime_type && !part.mimeType) {
          result = this.getClient()._createObject(part);
        } else {
          result = new MessagePart(part);
        }
        result.clientId = this.clientId;
        return result;
      });
    } else if (parts && typeof parts === 'object') {
      parts.clientId = this.clientId;
      adjustedParts = [new MessagePart(parts)];
    }
    this._setupPartIds(adjustedParts);
    if (adjustedParts) {
      const currentParts = this.parts || [];
      adjustedParts.filter(part => currentParts.indexOf(part) === -1).forEach((part) => {
        part.on('messageparts:change', this._onMessagePartChange, this);
      });
      const removedParts = currentParts.filter(part => adjustedParts.indexOf(part) === -1);
      removedParts.forEach(part => part.destroy());
    }
    return adjustedParts;
  }

  __updateParts(parts) {
    this._regenerateMimeAttributesMap();
  }
  _regenerateMimeAttributesMap() {
    this._mimeAttributeMap = {};
    if (this.parts) this.parts.forEach(part => this._addToMimeAttributesMap(part));
  }
  _addToMimeAttributesMap(part) {
    const map = this._mimeAttributeMap;
    Object.keys(part.mimeAttributes).forEach((name) => {
      if (!(name in map)) map[name] = [];
      map[name].push({ part, value: part.mimeAttributes[name] });
    });
  }

  /**
   * Add a layer.MessagePart to this Message.
   *
   * Should only be called on an unsent Message.
   *
   * ```
   * message.addPart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'});
   *
   * // OR
   * message.addPart(new layer.MessagePart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'}));
   * ```
   *
   * @method addPart
   * @param  {layer.MessagePart/Object} part - A layer.MessagePart instance or a `{mimeType: 'text/plain', body: 'Hello'}` formatted Object.
   * @returns {layer.Message} this
   */
  addPart(part) {
    if (part) {
      const oldValue = this.parts ? [].concat(this.parts) : null;
      part.clientId = this.clientId;
      const mPart = (part instanceof MessagePart) ? part : new MessagePart(part);
      if (this.parts.indexOf(mPart) === -1) {
        this.parts.push(mPart);
      }
      const index = this.parts.length - 1;
      const thePart = this.parts[index];

      thePart.off('messageparts:change', this._onMessagePartChange, this); // if we already subscribed, don't create a redundant subscription
      thePart.on('messageparts:change', this._onMessagePartChange, this);
      if (!part.id) part.id = `${this.id}/parts/${part._tmpUUID || Util.generateUUID()}`;
      this._addToMimeAttributesMap(thePart);
      this.trigger('messages:change', {
        property: 'parts',
        oldValue,
        newValue: this.parts,
      });
      this.trigger('messages:part-added', { part: mPart });
    }
    return this;
  }

  /**
   * Any time a Part changes, the Message has changed; trigger the `messages:change` event.
   *
   * Currently, this only looks at changes to body or mimeType, and does not handle changes to url/rich content.
   *
   * @method _onMessagePartChange
   * @private
   * @param {layer.LayerEvent} evt
   */
  _onMessagePartChange(evt) {
    evt.changes.forEach((change) => {
      this._triggerAsync('messages:change', {
        property: 'parts.' + change.property,
        oldValue: change.oldValue,
        newValue: change.newValue,
        part: evt.target,
      });
    });
  }

  /**
   * Your unsent Message will show up in Query results and be rendered in Message Lists.
   *
   * This method is only needed for Messages that should show up in a Message List Widget that
   * is driven by Query data, but where the layer.Message.send method has not yet been called.
   *
   * Once you have called `presend` your message should show up in your Message List.  However,
   * typically you want to be able to edit and rerender that Message. After making changes to the Message,
   * you can trigger change events:
   *
   * ```
   * var message = conversation.createMessage({parts: [{mimeType: 'custom/card', body: null}]});
   * message.presend();
   *
   * message.parts[0].body = 'Frodo is a Dodo';
   * message.trigger('messages:change');
   * ```
   *
   * Note that if using Layer UI for Web, the `messages:change` event will trigger an `onRerender` call,
   * not an `onRender` call, so the capacity to handle editing of messages will require the ability to render
   * all possible edits within `onRerender`.
   *
   * It is assumed that at some point either `send()` or `destroy()` will be called on this message
   * to complete or cancel this process.
   *
   * @method presend
   * @return this
   */
  presend() {
    const client = this.getClient();
    if (!client) {
      throw new Error(LayerError.dictionary.clientMissing);
    }

    const conversation = this.getConversation(false);

    if (!conversation) {
      throw new Error(LayerError.dictionary.conversationMissing);
    }

    if (this.syncState !== Constants.SYNC_STATE.NEW) {
      throw new Error(LayerError.dictionary.alreadySent);
    }
    conversation._setupMessage(this);

    // Make sure all data is in the right format for being rendered
    this._readAllBlobs(() => {
      client._addMessage(this);
    });
    return this;
  }

  /**
   * Send the message to all participants of the Conversation.
   *
   * Message must have parts and a valid conversation to send successfully.
   *
   * The send method takes a `notification` object. In normal use, it provides the same notification to ALL
   * recipients, but you can customize notifications on a per recipient basis, as well as embed actions into the notification.
   * For the Full API, see https://developer.layer.com/docs/platform/messages#notification-customization.
   *
   * For the Full API, see [Server Docs](https://developer.layer.com/docs/platform/messages#notification-customization).
   *
   * ```
   * message.send({
   *    title: "New Hobbit Message",
   *    text: "Frodo-the-Dodo: Hello Sam, what say we waltz into Mordor like we own the place?",
   *    sound: "whinyhobbit.aiff"
   * });
   * ```
   *
   * @method send
   * @param {Object} [notification] - Parameters for controling how the phones manage notifications of the new Message.
   *                          See IOS and Android docs for details.
   * @param {string} [notification.title] - Title to show on lock screen and notification bar
   * @param {string} [notification.text] - Text of your notification
   * @param {string} [notification.sound] - Name of an audio file or other sound-related hint
   * @return {layer.Message} this
   */
  send(notification) {
    const client = this.getClient();
    if (!client) {
      throw new Error(LayerError.dictionary.clientMissing);
    }

    const conversation = this.getConversation(true);

    if (!conversation) {
      throw new Error(LayerError.dictionary.conversationMissing);
    }

    if (this.syncState !== Constants.SYNC_STATE.NEW) {
      throw new Error(LayerError.dictionary.alreadySent);
    }


    if (conversation.isLoading) {
      conversation.once(conversation.constructor.eventPrefix + ':loaded', () => this.send(notification));
      conversation._setupMessage(this);
      return this;
    }

    if (!this.parts || !this.parts.length) {
      throw new Error(LayerError.dictionary.partsMissing);
    }

    this._setSyncing();

    // Make sure that the Conversation has been created on the server
    // and update the lastMessage property
    conversation.send(this);

    // If we are sending any File/Blob objects, and their Mime Types match our test,
    // wait until the body is updated to be a string rather than File before calling _addMessage
    // which will add it to the Query Results and pass this on to a renderer that expects "text/plain" to be a string
    // rather than a blob.
    this._readAllBlobs(() => {
      // Calling this will add this to any listening Queries... so position needs to have been set first;
      // handled in conversation.send(this)
      client._addMessage(this);

      // allow for modification of message before sending
      this.trigger('messages:sending');

      const data = {
        parts: new Array(this.parts.length),
        id: this.id,
      };
      if (notification && this.conversationId) data.notification = notification;

      this._preparePartsForSending(data);
    });
    return this;
  }

  /**
   * Any MessagePart that contains a textual blob should contain a string before we send.
   *
   * If a MessagePart with a Blob or File as its body were to be added to the Client,
   * The Query would receive this, deliver it to apps and the app would crash.
   * Most rendering code expecting text/plain would expect a string not a File.
   *
   * When this user is sending a file, and that file is textual, make sure
   * its actual text delivered to the UI.
   *
   * @method _readAllBlobs
   * @private
   */
  _readAllBlobs(callback) {
    let count = 0;
    const parts = this.parts.filter(part => Util.isBlob(part.body) && part.isTextualMimeType());
    parts.forEach((part) => {
      Util.fetchTextFromFile(part.body, (text) => {
        part.body = text;
        count++;
        if (count === parts.length) callback();
      });
    });
    if (!parts.length) callback();
  }

  /**
   * Insures that each part is ready to send before actually sending the Message.
   *
   * @method _preparePartsForSending
   * @private
   * @param  {Object} structure to be sent to the server
   */
  _preparePartsForSending(data) {
    const client = this.getClient();
    let count = 0;
    this.parts.forEach((part, index) => {
      part.once('parts:send', (evt) => {
        data.parts[index] = {
          mime_type: evt.mime_type,
          id: evt.id,
        };
        if (evt.content) data.parts[index].content = evt.content;
        if (evt.body) data.parts[index].body = evt.body;
        if (evt.encoding) data.parts[index].encoding = evt.encoding;

        count++;
        if (count === this.parts.length) {
          this._send(data);
        }
      }, this);
      part._send(client);
    });
  }

  /**
   * Handle the actual sending.
   *
   * layer.Message.send has some potentially asynchronous
   * preprocessing to do before sending (Rich Content); actual sending
   * is done here.
   *
   * @method _send
   * @private
   */
  _send(data) {
    const client = this.getClient();
    const conversation = this.getConversation(false);

    this.getClient()._triggerAsync('state-change', {
      started: true,
      type: 'send_' + Util.typeFromID(this.id),
      telemetryId: 'send_' + Util.typeFromID(this.id) + '_time',
      id: this.id,
    });
    this.sentAt = new Date();
    client.sendSocketRequest({
      method: 'POST',
      body: {
        method: 'Message.create',
        object_id: conversation.id,
        data,
      },
      sync: {
        depends: [this.conversationId, this.id],
        target: this.id,
      },
    }, (success, socketData) => this._sendResult(success, socketData));
  }

  _getSendData(data) {
    data.object_id = this.conversationId;
    return data;
  }

  /**
    * layer.Message.send() Success Callback.
    *
    * If successfully sending the message; triggers a 'sent' event,
    * and updates the message.id/url
    *
    * @method _sendResult
    * @private
    * @param {Object} messageData - Server description of the message
    */
  _sendResult({ success, data }) {
    this.getClient()._triggerAsync('state-change', {
      ended: true,
      type: 'send_' + Util.typeFromID(this.id),
      telemetryId: 'send_' + Util.typeFromID(this.id) + '_time',
      result: success,
      id: this.id,
    });
    if (this.isDestroyed) return;

    if (success) {
      this._populateFromServer(data);
      this._triggerAsync('messages:sent');
      this._triggerAsync('messages:change', {
        property: 'syncState',
        oldValue: Constants.SYNC_STATE.SAVING,
        newValue: Constants.SYNC_STATE.SYNCED,
      });
    } else {
      this.trigger('messages:sent-error', { error: data });
      this.destroy();
    }
    this._setSynced();
  }

  /* NOT FOR JSDUCK
   * Standard `on()` provided by layer.Root.
   *
   * Adds some special handling of 'messages:loaded' so that calls such as
   *
   *      var m = client.getMessage('layer:///messages/123', true)
   *      .on('messages:loaded', function() {
   *          myrerender(m);
   *      });
   *      myrender(m); // render a placeholder for m until the details of m have loaded
   *
   * can fire their callback regardless of whether the client loads or has
   * already loaded the Message.
   *
   * @method on
   * @param  {string} eventName
   * @param  {Function} eventHandler
   * @param  {Object} context
   * @return {layer.Message} this
   */
  on(name, callback, context) {
    const hasLoadedEvt = name === 'messages:loaded' ||
      (name && typeof name === 'object' && name['messages:loaded']);

    if (hasLoadedEvt && !this.isLoading) {
      const callNow = name === 'messages:loaded' ? callback : name['messages:loaded'];
      Util.defer(() => callNow.apply(context));
    }
    super.on(name, callback, context);
    return this;
  }

  /**
   * Remove this Message from the system.
   *
   * This will deregister the Message, remove all events
   * and allow garbage collection.
   *
   * @method destroy
   */
  destroy() {
    const client = this.getClient();
    if (client) client._removeMessage(this);
    this.parts.forEach(part => part.destroy());
    this.__parts = null;

    super.destroy();
  }

  /**
   * Setup message-part ids for parts that lack that id; for locally created parts.
   *
   * @private
   * @method
   * @param {layer.MessagePart[]} parts
   */
  _setupPartIds(parts) {
    // Assign IDs to preexisting Parts so that we can call getPartById()
    if (parts) {
      parts.forEach((part, index) => {
        if (!part.id) part.id = `${this.id}/parts/${part._tmpUUID || Util.generateUUID()}`;
      });
    }
  }

  /**
   * Populates this instance with the description from the server.
   *
   * Can be used for creating or for updating the instance.
   *
   * @method _populateFromServer
   * @protected
   * @param  {Object} m - Server description of the message
   */
  _populateFromServer(message) {
    this._inPopulateFromServer = true;
    const client = this.getClient();

    this.id = message.id;
    this.url = message.url;
    const oldPosition = this.position;
    this.position = message.position;
    this._setupPartIds(message.parts);
    const parts = message.parts.map((part) => {
      const existingPart = this.getPartById(part.id);
      if (existingPart) {
        existingPart._populateFromServer(part);
        return existingPart;
      } else {
        return MessagePart._createFromServer(part);
      }
    });
    this.parts = parts;

    this.recipientStatus = message.recipient_status || {};

    this.isRead = 'is_unread' in message ? !message.is_unread : true;

    this.sentAt = new Date(message.sent_at);
    this.receivedAt = message.received_at ? new Date(message.received_at) : undefined;
    if (!this.updatedAt || this.updatedAt.toISOString() !== message.updated_at) {
      this.updatedAt = message.updated_at ? new Date(message.updated_at) : null;
    }

    let sender;
    if (message.sender.id) {
      sender = client.getIdentity(message.sender.id);
    }

    // Because there may be no ID, we have to bypass client._createObject and its switch statement.
    if (!sender) {
      sender = Identity._createFromServer(message.sender, client);
    }
    this.sender = sender;

    this._setSynced();

    if (oldPosition && oldPosition !== this.position) {
      this._triggerAsync('messages:change', {
        oldValue: oldPosition,
        newValue: this.position,
        property: 'position',
      });
    }
    this._inPopulateFromServer = false;
  }

  /**
   * Returns the Message's layer.MessagePart with the specified the part ID.
   *
   * ```
   * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
   * ```
   *
   * @method getPartById
   * @param {string} partId
   * @return {layer.MessagePart}
   */
  getPartById(partId) {
    const part = this.parts ? this.parts.filter(aPart => aPart.id === partId)[0] : null;
    return part || null;
  }

  getPartWithMimeType(mimeType) {
    for (let i = 0; i < this.parts.length; i++) {
      if (this.parts[i].mimeType === mimeType) return this.parts[i];
    }
    return null;
  }

  /**
   * Returns array of layer.MessagePart that have the specified MIME Type attribute.
   *
   * ```
   * // get all parts where mime type has "lang=en-us" in it
   * var enUsParts = message.getPartsMatchingAttribute({'lang': 'en-us'});
   *
   * // Get all parts with the specified role AND parent-node-id
   * var sourcePart = message.getPartsMatchingAttribute({'parent-node-id': 'image1', 'role': 'source'});
   * ```
   *
   * @method
   * @param {Object} matches
   * @returns {layer.MessagePart[]}
   */
  getPartsMatchingAttribute(matches) {
    let first = true;
    let results = [];
    Object.keys(matches).forEach((attributeName) => {
      const attributeValue = matches[attributeName];
      const tmpResults = (this._mimeAttributeMap[attributeName] || []).filter(item => item.value === attributeValue).map(item => item.part);
      if (first) {
        results = tmpResults;
        first = false;
      } else {
        results = results.filter(item => tmpResults.indexOf(item) !== -1);
      }
    });
    return results;
  }

  /**
   * If there is a single message part that has the named attribute, return its value.
   *
   * If there are 0 or more than one message parts with this attribute, returns `null` instead.
   *
   * @method
   * @param {String} name
   * @returns {String}
   */
  getAttributeValue(name) {
    if (!this._mimeAttributeMap[name] || this._mimeAttributeMap[name].length > 1) return null;
    return this._mimeAttributeMap[name][0].value;
  }

  /**
   * Accepts json-patch operations for modifying recipientStatus.
   *
   * @method _handlePatchEvent
   * @private
   * @param  {Object[]} data - Array of operations
   */
  _handlePatchEvent(newValue, oldValue, paths) {
    this._inLayerParser = false;
    if (paths[0].indexOf('recipient_status') === 0) {
      this.__updateRecipientStatus(this.recipientStatus, oldValue);
    } else if (paths[0] === 'parts') {
      const oldValueParts = oldValue.map(part => this.getClient().getMessagePart(part.id)).filter(part => part);
      const removedParts = oldValue.filter(part => !this.getClient().getMessagePart(part.id));
      const addedParts = newValue.filter(part => oldValueParts.indexOf(part) === -1);
      addedParts.forEach(part => this.addPart(part));

      // TODO: Should fire "messages:change" event
      removedParts.forEach(partObj => this.trigger('messages:part-removed', { part: partObj }));
    }
    this._inLayerParser = true;
  }

  /**
   * Returns absolute URL for this resource.
   * Used by sync manager because the url may not be known
   * at the time the sync request is enqueued.
   *
   * @method _getUrl
   * @param {String} url - relative url and query string parameters
   * @return {String} full url
   * @private
   */
  _getUrl(url) {
    return this.url + (url || '');
  }

  _setupSyncObject(sync) {
    if (sync !== false) {
      sync = super._setupSyncObject(sync);
      if (!sync.depends) {
        sync.depends = [this.conversationId];
      } else if (sync.depends.indexOf(this.id) === -1) {
        sync.depends.push(this.conversationId);
      }
    }
    return sync;
  }


  /**
   * Get all text parts of the Message.
   *
   * Utility method for extracting all of the text/plain parts
   * and concatenating all of their bodys together into a single string.
   *
   * @method getText
   * @param {string} [joinStr='.  '] If multiple message parts of type text/plain, how do you want them joined together?
   * @return {string}
   */
  getText(joinStr = '. ') {
    let textArray = this.parts
      .filter(part => part.mimeType === 'text/plain')
      .map(part => part.body);
    textArray = textArray.filter(data => data);
    return textArray.join(joinStr);
  }

  /**
   * Returns a plain object.
   *
   * Object will have all the same public properties as this
   * Message instance.  New object is returned any time
   * any of this object's properties change.
   *
   * @method toObject
   * @return {Object} POJO version of this object.
   */
  toObject() {
    if (!this._toObject) {
      this._toObject = super.toObject();
    }
    return this._toObject;
  }

  _triggerAsync(evtName, args) {
    this._clearObject();
    super._triggerAsync(evtName, args);
  }

  trigger(evtName, args) {
    this._clearObject();
    super.trigger(evtName, args);
  }

  /**
   * Identifies whether a Message receiving the specified patch data should be loaded from the server.
   *
   * Applies only to Messages that aren't already loaded; used to indicate if a change event is
   * significant enough to load the Message and trigger change events on that Message.
   *
   * At this time there are no properties that are patched on Messages via websockets
   * that would justify loading the Message from the server so as to notify the app.
   *
   * Only recipient status changes and maybe is_unread changes are sent;
   * neither of which are relevant to an app that isn't rendering that message.
   *
   * @method _loadResourceForPatch
   * @static
   * @private
   */
  static _loadResourceForPatch(patchData) {
    return false;
  }
}

/**
 * Client that the Message belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @readonly
 */
Message.prototype.clientId = '';

/**
 * Conversation ID or Channel ID that this Message belongs to.
 *
 * @type {string}
 * @readonly
 */
Message.prototype.conversationId = '';

/**
 * Array of layer.MessagePart objects.
 *
 * Use layer.Message.addPart to modify this array.
 *
 * @type {layer.MessagePart[]}
 * @readonly
 */
Message.prototype.parts = null;

/**
 * Time that the message was sent.
 *
 *  Note that a locally created layer.Message will have a `sentAt` value even
 * though its not yet sent; this is so that any rendering code doesn't need
 * to account for `null` values.  Sending the Message may cause a slight change
 * in the `sentAt` value.
 *
 * @type {Date}
 * @readonly
 */
Message.prototype.sentAt = null;

/**
 * Time that the first delivery receipt was sent by your
 * user acknowledging receipt of the message.
 * @type {Date}
 * @readonly
 */
Message.prototype.receivedAt = null;

/**
 * Identity object representing the sender of the Message.
 *
 * Most commonly used properties of Identity are:
 * * displayName: A name for your UI
 * * userId: Name for the user as represented on your system
 * * name: Represents the name of a service if the sender was an automated system.
 *
 *      <span class='sent-by'>
 *        {message.sender.displayName || message.sender.name}
 *      </span>
 *
 * @type {layer.Identity}
 * @readonly
 */
Message.prototype.sender = null;

/**
 * Position of this message within the conversation.
 *
 * NOTES:
 *
 * 1. Deleting a message does not affect position of other Messages.
 * 2. A position is not gaurenteed to be unique (multiple messages sent at the same time could
 * all claim the same position)
 * 3. Each successive message within a conversation should expect a higher position.
 *
 * @type {Number}
 * @readonly
 */
Message.prototype.position = 0;

/**
 * Hint used by layer.Client on whether to trigger a messages:notify event.
 *
 * @type {boolean}
 * @private
 */
Message.prototype._notify = false;

/**
 * This property is here for convenience only; it will always be the opposite of isRead.
 * @type {Boolean}
 * @readonly
 */
Object.defineProperty(Message.prototype, 'isUnread', {
  enumerable: true,
  get: function get() {
    return !this.isRead;
  },
});

/**
 * A map of every Message Part attribute.
 *
 * Structure is:
 *
 * ```
 * {
 *    attributeName: [
 *      {
 *        part: partWithThisValue,
 *        value: theValue
 *      },
 *      {
 *        part: partWithThisValue,
 *        value: theValue
 *      }
 *    ],
 *    attributeName2: [...]
 * }
 * ```
 * @type {Object}
 * @private
 */
Message.prototype._mimeAttributeMap = null;

/**
 * Time that the part was last updated.
 *
 * If the part was created after the message was sent, or the part was updated after the
 * part was sent then this will have a value.
 *
 * @type {Date}
 */
Message.prototype.updatedAt = null;

Message.prototype._toObject = null;

Message.prototype._inPopulateFromServer = false;

Message.eventPrefix = 'messages';

Message.eventPrefix = 'messages';

Message.prefixUUID = 'layer:///messages/';

Message.inObjectIgnore = Syncable.inObjectIgnore;

Message.bubbleEventParent = 'getClient';

Message.imageTypes = [
  'image/gif',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

Message._supportedEvents = [

  /**
   * Message has been loaded from the server.
   *
   * Note that this is only used in response to the layer.Message.load() method.
   *
   * ```
   * var m = client.getMessage('layer:///messages/123', true)
   *    .on('messages:loaded', function() {
   *        myrerender(m);
   *    });
   * myrender(m); // render a placeholder for m until the details of m have loaded
   * ```
   *
   * @event
   * @param {layer.LayerEvent} evt
   */
  'messages:loaded',

  /**
   * The load method failed to load the message from the server.
   *
   * Note that this is only used in response to the layer.Message.load() method.
   * @event
   * @param {layer.LayerEvent} evt
   */
  'messages:loaded-error',

  /**
   * Message deleted from the server.
   *
   * Caused by a call to layer.Message.delete() or a websocket event.
   * @param {layer.LayerEvent} evt
   * @event
   */
  'messages:delete',

  /**
   * Message is about to be sent.
   *
   * Last chance to modify or validate the message prior to sending.
   *
   *     message.on('messages:sending', function(evt) {
   *        message.addPart({mimeType: 'application/location', body: JSON.stringify(getGPSLocation())});
   *     });
   *
   * Typically, you would listen to this event more broadly using `client.on('messages:sending')`
   * which would trigger before sending ANY Messages.
   *
   * @event
   * @param {layer.LayerEvent} evt
   */
  'messages:sending',

  /**
   * Message has been received by the server.
   *
   * It does NOT indicate delivery to other users.
   *
   * It does NOT indicate messages sent by other users.
   *
   * @event
   * @param {layer.LayerEvent} evt
   */
  'messages:sent',

  /**
   * Server failed to receive the Message.
   *
   * Message will be deleted immediately after firing this event.
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.LayerError} evt.error
   */
  'messages:sent-error',

  /**
   * The recipientStatus property has changed.
   *
   * This happens in response to an update
   * from the server... but is also caused by marking the current user as having read
   * or received the message.
   * @event
   * @param {layer.LayerEvent} evt
   */
  'messages:change',

  /**
   * A new Message Part has been added
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.MessagePart} evt.part
   */
  'messages:part-added',

  /**
   * A new Message Part has been removed
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {layer.MessagePart} evt.part
   */
  'messages:part-removed',
].concat(Syncable._supportedEvents);

Root.initClass.apply(Message, [Message, 'Message']);
Syncable.subclasses.push(Message);
module.exports = Message;

