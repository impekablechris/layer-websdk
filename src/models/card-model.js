/**
 * Root class for all Card Models
 */
const Root = require('../root');
const Util = require('../client-utils');
const Message = require('../models/message');
const MessagePart = require('../models/message-part');


// FIXME: this doesn't really need to extend root probably
class CardModel extends Root {
  /**
   * Create a layer.Card.
   *
   * @method  constructor
   * @private
   * @return {layer.Card}
   */
  constructor(options = {}) {
    if (!options.action) options.action = {};

    // Card model UUID should always match the Message ID; there should never be more than one CardModel for a given Message
    super(options);
    //if (!this.constructor.isSupportedMessage(this.message)) throw new Error(LayerError.dictionary.unsupportedMessage);

    if (!this.customData) this.customData = {};
    this.currentCardRenderer = this.constructor.cardRenderer;
    this.childParts = [];

    if (this.message) {
      this._setupMessage();
    } else {

    }
  }

  generateMessage(conversation, callback) {
    this._generateParts((parts) => {
      this.childParts = parts;
      this.part.mimeAttributes.role = 'root';
      this.message = conversation.createMessage({
        id: Message.prefixUUID + this.id.replace(/^.*cardmodels\//, ''),
        parts: this.childParts,
      });
      this._setupMessage(true);
      callback(this.message);
    });
  }

  _addModel(model, role, callback) {
    model._generateParts((moreParts) => {
      moreParts[0].mimeAttributes.role = role;
      moreParts[0].mimeAttributes['parent-node-id'] = this.part.getNodeId();
      if (callback) callback(moreParts);
    });
  }


  _setupMessage(doNotParse) {
    this.message._regenerateMimeAttributesMap();
    if (this.part) {
      this.id = CardModel.prefixUUID + this.part.id.replace(/^.*messages\//, '');
      this.role = this.part.mimeAttributes.role;
      this.childParts = this.message.getPartsMatchingAttribute({
        'parent-node-id': this.part.getNodeId(),
      });

      // Call handlePartChanges any message edits that update a part.
      this.part.on('messageparts:change', this._handlePartChanges, this);
      this.childParts.forEach(part => part.on('messageparts:change', this._handlePartChanges, this));
    } else {
      this.childParts = [];
    }

    this.message.on('messages:part-added', this._handlePartAdded, this);
    this.message.on('messages:part-removed', this._handlePartRemoved, this);

    this.message.on('destroy', this.destroy, this);
    this.message.getClient()._addCardModel(this);
    if (!doNotParse && this.part) {
      if (!this.part.body) this.part.fetchContent();
      this._parseMessage(this.part.body ? JSON.parse(this.part.body) : {});
    }
  }

  _initBodyWithMetadata(fields) {
    const body = { };
    const newFields = ['action', 'purpose', 'customData'].concat(fields);
    newFields.forEach((fieldName) => {
      if (this._propertyHasValue(fieldName)) {
        body[Util.hyphenate(fieldName, '_')] = this[fieldName];
      }
    });
    return body;
  }

  _propertyHasValue(fieldName) {
    if (fieldName === 'action' && Util.isEmpty(this.action)) return false;
    if (fieldName === 'customData' && Util.isEmpty(this.customData)) return false;
    if (this[fieldName] === this.constructor.prototype[fieldName]) return false;
    return true;
  }

  /**
   * This method parses the message property to extract the information managed by the model.
   *
   * @method
   */
  _parseMessage(payload) {
    const responses = this.childParts.filter(part => part.mimeAttributes.role === 'response_summary')[0];
    if (responses) {
      const responseData = JSON.parse(responses.body);
      if (responseData.participant_data) {
        responseData.participantData = responseData.participant_data;
        delete responseData.participant_data;
      }
      if (!Util.doesObjectMatch(this.responses, responseData)) {
        this.responses = responseData;
      }
    }

    Object.keys(payload).forEach((propertyName) => {
      this[Util.camelCase(propertyName)] = payload[propertyName];
    });
  }

  _handlePartChanges(evt) {
    if (this.part) {
      this._parseMessage(this.part.body ? JSON.parse(this.part.body) : {});
    }
    //this._triggerAsync('change');
  }

  _handlePartRemoved(removed) {
    // const removedPart = this.childParts.filter(part => part.id === removed.part.id);
    this.childParts = this.childParts.filter(part => part.id !== removed.part.id);
    this._handlePartChanges(evt);
  }

  _handlePartAdded(evt) {
    const part = evt.part;
    const message = this.message;
    this.childParts = this.childParts.filter(childPart => message.parts.indexOf(childPart) !== -1);
    if (part.mimeAttributes['parent-node-id'] && part.mimeAttributes['parent-node-id'] === Util.uuid(this.id)) {
      this.childParts.push(part);
      part.on('messageparts:change', this._handlePartChanges, this);
      if (!this.part.body) this.part.fetchContent();
      this._parseMessage(this.part.body ? JSON.parse(this.part.body) : {});
      this._triggerAsync('change');
    } else if (this.part && part.getNodeId() === this.part.getNodeId()) {
      this.part = part;
    }
    this._handlePartChanges(evt);
  }

/*
  getChildPartById(id) {
    return this.childParts.filter(part => part.mimeAttributes['node-id'] === id)[0];
  }

  getChildModelById(id) {
    const childPart = this.getChildPartById(id);
    if (childPart) {
      return this.getClient().getCardModel(childPart.id);
    }
  }
  generateResponseMessageText() {
    return this.getClient().user.displayName + ' has responded' + (this.title ? ' to ' + this.title : '');
  }
*/

  getModelFromPart(role) {
    const part = this.childParts.filter(aPart => aPart.mimeAttributes.role === role)[0];
    if (part) {
      return this.getClient().createCardModel(this.message, part);
    } else {
      return null;
    }
  }

  getModelsFromPart(role) {
    const parts = this.childParts.filter(part => part.mimeAttributes.role === role);
    return parts.map(part => this.getClient().createCardModel(this.message, part));
  }
/*
  hasNoContainerData() {
    const title = this.getTitle && this.getTitle();
    const description = this.getDescription && this.getDescription();
    const footer = this.getFooter && this.getFooter();
    return !title && !description && !footer;
  }

  send(conversation, notification) {
    if (!this.message) {
      const parts = [this.part].concat(this.childParts);
      this.message = conversation.createMessage({ parts });
    }
    this.message.send(notification);
    return this;
  }
*/
  getClient() {
    if (this.part) return this.part._getClient();
    if (this.message) return this.message.getClient();
    return null;
  }

  destroy() {
    this.getClient()._removeCardModel(this);
    delete this.message;
    super.destroy();
  }

  /* MANAGE METADATA */

  getTitle() {
    return this.title || '';
  }
  getDescription() {
    return '';
  }
  getFooter() {
    return '';
  }

  /* MANAGE LAST MESSAGE REPRESENTATION */
  getOneLineSummary() {
    return this.getTitle() || this.constructor.Label;
  }

  mergeAction(newValue) {
    if (!this.action.event) this.action.event = newValue.event;
    const newData = newValue.data || {};
    let currentData;
    if (this.action.data) {
      currentData = this.action.data;
    } else {
      this.action.data = currentData = {};
    }

    Object.keys(newData).forEach((propertyName) => {
      if (!(propertyName in currentData)) currentData[propertyName] = newData[propertyName];
    });
  }

  // If triggered by a message change, trigger('change') is called above
  __updateResponses(newResponse, oldResponse) {
    if (!this.responses) this.__responses = {};
    this._processNewResponses();
  }

  _processNewResponses() { }

  __getActionEvent() {
    return this.action.event || this.constructor.defaultAction;
  }

  __getActionData() {
    return this.action.data || {};
  }

  __getParentId() {
    return this.part ? this.part.parentId : '';
  }

  __getNodeId() {
    return this.part ? this.part.mimeAttributes['node-id'] : '';
  }

  getParentPart() {
    const parentId = this.parentId;
    if (parentId) {
      return this.message.getPartsMatchingAttribute({ 'node-id': parentId })[0];
    } else {
      return null;
    }
  }

  _processDelayedTriggers() {
    if (this.isDestroyed) return;
    const changes = this._delayedTriggers.filter(evt => evt[0] === 'change');
    if (changes.length > 1) {
      let hasOne = false;
      this._delayedTriggers = this._delayedTriggers.filter(evt => {
        if (evt[0] === 'change' && !hasOne) {
          hasOne = true;
          return true;
        } else if (evt[0] === 'change') {
          return false;
        } else {
          return true;
        }
      });
    }
    super._processDelayedTriggers();
  }

  /**
   * Determine if the given Message is valid for this Card type.
   *
   *
   * @method isSupportedMessage
   * @static
   * @protected
   * @param  {layer.MessagePart} messagePart
   * @return {boolean}
   */
  static isSupportedMessage(message, cardRenderer) {
    if (cardRenderer || this.cardRenderer) return cardRenderer === this.cardRenderer;
    const pollPart = message.getPartWithMimeType(this.MIMEType);
    return Boolean(pollPart);
  }
}

/**
 * If a model is created without a Part, it may still need to know what its parent part is.
 *
 * @protected
 * @type {String}
 */
CardModel.prototype.parentNodeId = null;
CardModel.prototype.parentId = null;
CardModel.prototype.nodeId = null;
CardModel.prototype.id = '';

/**
 * Message for this Card Model
 *
 * @type {layer.Message}
 */
CardModel.prototype.message = null;

/**
 * Message Parts that are directly used by this model.
 *
 * @type {layer.MessagePart[]}
 */
CardModel.prototype.childParts = null;

/**
 * Custom string used to describe the purpose of this Card to Integration Services.
 *
 * @type {String}
 */
CardModel.prototype.purpose = '';

/**
 * Custom data for your card.
 *
 * Typically this data is not used for rendering, but rather for understanding and tracking what data means.
 * For example, you might stick Product IDs into your Product Card so that when you receive a Product Card
 * you have all the info needed to lookup the full details.
 *
 * @type {Object}
 */
CardModel.prototype.customData = null;

/**
 * Action object contains actionEvent and actionData
 *
 * @private
 * @type {Object}
 */
CardModel.prototype.action = null;

/**
 * Action to trigger when user selects this Card/Primitive
 *
 * Actions are strings that are put into events and which are intercepted and
 * interpreted either by parent cards or by the app.
 *
 * @type {String}
 */
CardModel.prototype.actionEvent = '';

/**
 * Data to share when triggering an Action.
 *
 * Action Data is an arbitrary hash, and typically would be null.
 * Most actions can directly work with the properties of the model
 * being operated upon (open-url uses the url property).
 * A Buy button however may get stuck on something that lacks
 * a price or product number (an Image Card).
 *
 * @type {Object}
 */
CardModel.prototype.actionData = null;

/**
 * Root Part defining this Model
 *
 * @type {layer.MessagePart}
 */
CardModel.prototype.part = null;

/**
 * The role value for the MessagePart.
 * @type {String}
 */
CardModel.prototype.role = null;

/**
 * Are responses enabled for this Card?
 *
 * @type {Boolean}
 */
CardModel.prototype.locked = false;

/**
 * Stores all user responses indexed by Identity ID
 *
 * @type {Object}
 */
CardModel.prototype.responses = null;

CardModel.prototype.currentCardRenderer = '';

CardModel.prefixUUID = 'layer:///cardmodels/';
CardModel._supportedEvents = ['change'].concat(Root._supportedEvents);
Root.initClass.apply(CardModel, [CardModel, 'CardModel']);
module.exports = CardModel;

