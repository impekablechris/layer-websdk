/*eslint-disable */
var dbIt = it;
(function() {
  // Override the it methods with something that will pick whether to run the test or skip it based on
  // whether IndexedDB is supported for this platform
  var dbIsTestable = undefined;
  var it = function(name, fn) {
    var innerFunc = function(done) {
      if (dbIsTestable) {
        fn.apply(this, [done]);
        if (!fn.length) done();
      } else {
        expect(true).toBe(true);
        done();
      }
    };
    dbIt(name, innerFunc);
  };



  describe("The DbManager Class", function() {
      var appId = "Fred's App";

      var client,
          conversation,
          channel,
          message,
          announcement,
          identity,
          userIdentity,
          basicIdentity,
          dbManager;

          var MAX_SAFE_INTEGER = 9007199254740991;

      function deleteTables(done) {
        client.dbManager._loadAll('messages', function(results) {
          client.dbManager.deleteObjects('messages', results, function() {
            client.dbManager._loadAll('identities', function(results) {
              client.dbManager.deleteObjects('identities', results, function() {
                client.dbManager._loadAll('conversations', function(results) {
                  client.dbManager.deleteObjects('conversations', results, function() {
                    client.dbManager._loadAll('channels', function(results) {
                      client.dbManager.deleteObjects('channels', results, function() {
                        setTimeout(done, 50);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      }

      beforeAll(function(done) {
        testDbEnabled(function(result) {
            dbIsTestable = result;
            done();
        });
      });

      // NOTE: beforeEach finishes by deleting everything from the database. You must insert before you can query.
      beforeEach(function(done) {
          client = new layer.Client({
              appId: appId,
              url: "http://localhost:9753",
              isTrustedDevice: true,
              isPersistenceEnabled: dbIsTestable
          });
          client.sessionToken = "sessionToken";

          identity = new layer.Identity({
            clientId: client.appId,
            userId: "Frodo",
            id: "layer:///identities/" + "Frodo",
            firstName: "first",
            lastName: "last",
            phoneNumber: "phone",
            emailAddress: "email",
            metadata: {},
            publicKey: "public",
            avatarUrl: "avatar",
            displayName: "display",
            syncState: layer.Constants.SYNC_STATE.SYNCED,
            isFullIdentity: true,
            presence: {
              status: 'away',
              lastSeenAt: new Date()
            }
          });
          client.user = identity;

          client.on('ready', function() {
            dbManager = client.dbManager;
            setTimeout(function() {
              client.syncManager.queue = [];
              conversation = client._createObject(responses.conversation1);
              channel = client._createObject(responses.channel1);
              message = conversation.lastMessage;
              announcement = client._createObject(responses.announcement);
              userIdentity = client._createObject(responses.useridentity);
              basicIdentity = new layer.Identity({
                clientId: client.appId,
                userId: client.userId,
                id: "layer:///identities/" + client.userId,
                isFullIdentity: false
              });

              deleteTables(function() {
                done();
              });
            }, 10);
          });

          client._clientAuthenticated();
      });

      afterEach(function() {
          //client.destroy();
      });

      describe("The constructor() method", function() {
        it("Should listen for conversations:add events", function() {
          spyOn(dbManager, "writeConversations");
          client.trigger('conversations:add', { conversations: [conversation] });
          expect(dbManager.writeConversations).toHaveBeenCalledWith([conversation]);
        });

        it("Should listen for conversations:change events", function() {
          spyOn(dbManager, "_updateConversation");
          var change = {
            target: conversation,
            oldValue: 1,
            newValue: 2,
            property: 'unreadCount'
          };
          client.trigger('conversations:change', change);
          expect(dbManager._updateConversation).toHaveBeenCalledWith(conversation, [{
            oldValue: 1,
            newValue: 2,
            property: 'unreadCount'
          }]);
        });

        it("Should listen for conversations:delete events", function() {
          spyOn(dbManager, "deleteObjects");
          client.trigger('conversations:delete', { target: conversation });
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('conversations', [conversation]);
        });

        it("Should listen for conversations:sent-error events", function() {
          spyOn(dbManager, "deleteObjects");
          conversation.trigger('conversations:sent-error');
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('conversations', [conversation]);
        });

        it("Should listen for channels:add events", function() {
          spyOn(dbManager, "writeChannels");
          client.trigger('channels:add', { channels: [channel] });
          expect(dbManager.writeChannels).toHaveBeenCalledWith([channel]);
        });

        it("Should listen for channels:change events", function() {
          spyOn(dbManager, "_updateChannel");
          var change = {
            target: channel,
            oldValue: 1,
            newValue: 2,
            property: 'unreadCount'
          };
          client.trigger('channels:change', change);
          expect(dbManager._updateChannel).toHaveBeenCalledWith(channel, [{
            oldValue: 1,
            newValue: 2,
            property: 'unreadCount'
          }]);
        });

        it("Should listen for channels:delete events", function() {
          spyOn(dbManager, "deleteObjects");
          client.trigger('channels:delete', { target: channel });
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('channels', [channel]);
        });

        it("Should listen for channels:sent-error events", function() {
          spyOn(dbManager, "deleteObjects");
          channel.trigger('channels:sent-error');
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('channels', [channel]);
        });

        it("Should listen for messages:add events", function() {
          spyOn(dbManager, "writeMessages");
          client.trigger('messages:add', { messages: [message] });
          expect(dbManager.writeMessages).toHaveBeenCalledWith([message]);
        });

        it("Should listen for messages:change events", function() {
          spyOn(dbManager, "writeMessages");
          client.trigger('messages:change', {
            target: message,
            oldValue: 1,
            newValue: 2,
            property: 'unreadCount'
          });
          expect(dbManager.writeMessages).toHaveBeenCalledWith([message]);
        });

        it("Should listen for messages:delete events", function() {
          spyOn(dbManager, "deleteObjects");
          client.trigger('messages:delete', { target: message });
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('messages', [message]);
        });

        it("Should listen for messages:sent-error events", function() {
          spyOn(dbManager, "deleteObjects");
          message.trigger('messages:sent-error');
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('messages', [message]);
        });

        it("Should listen for identities:add events", function() {
          spyOn(dbManager, "writeIdentities");
          client.trigger('identities:add', { identities: [identity] });
          expect(dbManager.writeIdentities).toHaveBeenCalledWith([identity]);
        });

        it("Should listen for identities:change events", function() {
          spyOn(dbManager, "writeIdentities");
          client.trigger('identities:change', {
            target: identity,
            oldValue: 1,
            newValue: 2,
            property: 'displayName'
          });
          expect(dbManager.writeIdentities).toHaveBeenCalledWith([identity]);
        });

        it("Should listen for identities:unfollow events", function() {
          spyOn(dbManager, "deleteObjects");
          client.trigger('identities:unfollow', { target: identity });
          expect(dbManager.deleteObjects).toHaveBeenCalledWith('identities', [identity]);
        });

        it("Should call _open", function() {
          var _open = layer.DbManager.prototype._open;
          spyOn(layer.DbManager.prototype, "_open");
          var dbManager = new layer.DbManager({
            enabled: true,
            client: client,
            tables: {conversations: true}
          });

          // Posttest
          expect(layer.DbManager.prototype._open).toHaveBeenCalledWith(false);

          // Cleanup
          layer.DbManager.prototype._open = _open;
        });

        it("Should accept a tables property", function() {
          var dbManager = new layer.DbManager({
            enabled: true,
            client: client,
            tables: {
              conversations: true,
              channels: true,
              messages: true,
              identities: false,
              syncQueue: true
            }
          });
          expect(dbManager._permission_conversations).toBe(true);
          expect(dbManager._permission_messages).toBe(true);
          expect(dbManager._permission_identities).toBe(false);
          expect(dbManager._permission_syncQueue).toBe(true);
        });

        it("Should set syncQueue to false if either conversations or messages are false", function() {
          var dbManager = new layer.DbManager({
            enabled: true,
            client: client,
            tables: {
              conversations: true,
              channels: true,
              messages: false,
              identities: false,
              syncQueue: true
            }
          });
          expect(dbManager._permission_conversations).toBe(true);
          expect(dbManager._permission_messages).toBe(false);
          expect(dbManager._permission_identities).toBe(false);
          expect(dbManager._permission_syncQueue).toBe(false);

        });
      });

      describe("The _open() method", function() {
        it("Should callback immediately if no tables enabled", function() {
          var dbManager = new layer.DbManager({
            client: client,
            tables: {
              conversations: false,
              messages: false,
              identities: false,
              syncQueue: false
            }
          });
          var done = false;
          dbManager.onOpen(function() {
            done = true;
          });
          expect(done).toBe(true);
        });
        it("Should trigger open event", function(done) {
          var dbManager = new layer.DbManager({
            enabled: true,
            client: client,
            tables: {conversations: true}
          });
          dbManager.on('open', function() {
            expect(dbManager.isOpen).toBe(true);
            expect(dbManager.db).not.toEqual(null);
            done();
          });
        });

        xit("Should call _onUpgradeNeeded", function() {

        });
      });

      describe("The onOpen() method", function() {
        it("Should callback when open", function(done) {
          var dbManager = new layer.DbManager({
            enabled: true,
            client: client,
            tables: {conversations: true}
          });
          dbManager.onOpen(function() {
            expect(dbManager.isOpen).toBe(true);
            done();
          });
        });

        it("Should callback immediately if open", function() {
          var spy = jasmine.createSpy('opOpen');
          var dbManager = new layer.DbManager({
            enabled: true,
            client: client,
            tables: {conversations: true}
          });
          dbManager.isOpen = true;
          dbManager.onOpen(spy);
          expect(spy).toHaveBeenCalledWith();
        });
      });

      xdescribe("The _onUpgradeNeeded() method", function() {

      });

      describe("The _getConversationData() method", function() {
        it("Should ignore anything that just came out of the database and clear _fromDB", function() {
          conversation._fromDB = true;
          expect(dbManager._getConversationData([conversation])).toEqual([]);
          expect(conversation._fromDB).toBe(false);
        });

        it("Should ignore loading Conversations", function() {
          conversation.syncState = layer.Constants.SYNC_STATE.LOADING;
          expect(dbManager._getConversationData([conversation])).toEqual([]);
        });

        it("Should ignore SYNC-NEW Conversations", function() {
          conversation.syncState = layer.Constants.SYNC_STATE.NEW;
          expect(dbManager._getConversationData([conversation])).toEqual([]);
        });

        it("Should generate a proper object", function() {
          expect(dbManager._getConversationData([conversation])).toEqual([{
            id: conversation.id,
            url: conversation.url,
            participants: client.dbManager._getIdentityData(conversation.participants, true),
            distinct: conversation.distinct,
            created_at: conversation.createdAt.toISOString(),
            metadata: conversation.metadata,
            unread_message_count: conversation.unreadCount,
            last_message: conversation.lastMessage.id,
            last_message_sent: conversation.lastMessage.sentAt.toISOString(),
            sync_state: conversation.syncState
          }]);
        });
      });

      describe("The _updateConversation() method", function() {
        it ("Should delete the conversation if the id changed, and then write the conversation", function(done) {
          var oldId = conversation.id;
          var newId = conversation.id + 'a';
          // Setup
          dbManager.writeConversations([conversation], function() {
            dbManager.getObjects('conversations', [oldId], function(results) {
              expect(results.length).toEqual(1);
              conversation.id = newId;
              conversation.trigger('conversations:change', {
                property: 'id',
                oldValue: oldId,
                newValue: newId
              });
              setTimeout(function() {
                dbManager.getObjects('conversations', [oldId], function(results) {
                  expect(results.length).toEqual(0);
                  dbManager.getObjects('conversations', [newId], function(results) {
                    expect(results.length).toEqual(1);
                    done();
                  });
                });
              }, 200);
            });
          });
        });

        it ("Should not delete the conversation if the id changed, but still write the conversation", function() {
          spyOn(dbManager, "deleteObjects");
          spyOn(dbManager, "writeConversations");

          // Run
          conversation.trigger('conversations:change', {
            property: 'unreadCount',
            oldValue: 5,
            newValue: 6
          });

          // Posttest
          expect(dbManager.deleteObjects).not.toHaveBeenCalled();
          expect(dbManager.writeConversations).toHaveBeenCalledWith([conversation]);
        });
      });

      describe("The writeConversations() method", function() {
        it("Should forward isUpdate true to writeMessages", function() {
          spyOn(dbManager, "_writeObjects");
          spyOn(dbManager, "_getConversationData").and.returnValue([{id: 'fred'}]);
          dbManager.writeConversations([conversation]);
          expect(dbManager._writeObjects).toHaveBeenCalledWith('conversations', [jasmine.any(Object)], undefined);
        });

        it("Should forward isUpdate true to writeMessages", function() {
          spyOn(dbManager, "_writeObjects");
          spyOn(dbManager, "_getConversationData").and.returnValue([{id: 'fred'}]);
          dbManager.writeConversations([conversation]);
          expect(dbManager._writeObjects).toHaveBeenCalledWith('conversations', [jasmine.any(Object)], undefined);
        });

        it("Should feed data from _getConversationData to _writeObjects", function() {
          spyOn(dbManager, "_writeObjects");
          spyOn(dbManager, "_getConversationData").and.returnValue([{id: 'fred'}]);
          dbManager.writeConversations([conversation]);
          expect(dbManager._writeObjects).toHaveBeenCalledWith('conversations', [{id: 'fred'}], undefined);
        });
      });



      describe("The _getChannelData() method", function() {
        it("Should ignore anything that just came out of the database and clear _fromDB", function() {
          channel._fromDB = true;
          expect(dbManager._getChannelData([channel])).toEqual([]);
          expect(channel._fromDB).toBe(false);
        });

        it("Should ignore loading Channels", function() {
          channel.syncState = layer.Constants.SYNC_STATE.LOADING;
          expect(dbManager._getChannelData([channel])).toEqual([]);
        });

        it("Should ignore SYNC-NEW Channels", function() {
          channel.syncState = layer.Constants.SYNC_STATE.NEW;
          expect(dbManager._getChannelData([channel])).toEqual([]);
        });

        it("Should generate a proper object", function() {
          expect(dbManager._getChannelData([channel])).toEqual([{
            id: channel.id,
            url: channel.url,
            name: channel.name,
            created_at: channel.createdAt.toISOString(),
            metadata: channel.metadata,
            membership: null,
            /* TODO: Enable this after spec is complete
            membership: {
              is_member: channel.membership.isMember,
            },*/
            sync_state: channel.syncState
          }]);
        });
      });

      describe("The _updateChannel() method", function() {
        it ("Should delete the channel if the id changed, and then write the channel", function(done) {
          var oldId = channel.id;
          var newId = channel.id + 'a';
          // Setup
          dbManager.writeChannels([channel], function() {
            dbManager.getObjects('channels', [oldId], function(results) {
              expect(results.length).toEqual(1);
              channel.id = newId;
              channel.trigger('channels:change', {
                property: 'id',
                oldValue: oldId,
                newValue: newId
              });
              setTimeout(function() {
                dbManager.getObjects('channels', [oldId], function(results) {
                  expect(results.length).toEqual(0);
                  dbManager.getObjects('channels', [newId], function(results) {
                    expect(results.length).toEqual(1);
                    done();
                  });
                });
              }, 200);
            });
          });
        });

        it ("Should not delete the channel if the id changed, but still write the channel", function() {
          spyOn(dbManager, "deleteObjects");
          spyOn(dbManager, "writeChannels");

          // Run
          channel.trigger('channels:change', {
            property: 'unreadCount',
            oldValue: 5,
            newValue: 6
          });

          // Posttest
          expect(dbManager.deleteObjects).not.toHaveBeenCalled();
          expect(dbManager.writeChannels).toHaveBeenCalledWith([channel]);
        });
      });

      describe("The writeChannels() method", function() {
        it("Should forward isUpdate true to writeMessages", function() {
          spyOn(dbManager, "_writeObjects");
          spyOn(dbManager, "_getChannelData").and.returnValue([{id: 'fred'}]);
          dbManager.writeChannels([channel]);
          expect(dbManager._writeObjects).toHaveBeenCalledWith('channels', [jasmine.any(Object)], undefined);
        });

        it("Should forward isUpdate true to writeMessages", function() {
          spyOn(dbManager, "_writeObjects");
          spyOn(dbManager, "_getChannelData").and.returnValue([{id: 'fred'}]);
          dbManager.writeChannels([channel]);
          expect(dbManager._writeObjects).toHaveBeenCalledWith('channels', [jasmine.any(Object)], undefined);
        });

        it("Should feed data from _getChannelData to _writeObjects", function() {
          spyOn(dbManager, "_writeObjects");
          spyOn(dbManager, "_getChannelData").and.returnValue([{id: 'fred'}]);
          dbManager.writeChannels([channel]);
          expect(dbManager._writeObjects).toHaveBeenCalledWith('channels', [{id: 'fred'}], undefined);
        });
      });





      describe("The _getMessageData() method", function() {
        it("Should ignore anything that just came out of the database and clear _fromDB", function() {
          message._fromDB = true;
          var isDone = false;
          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([]);
            expect(message._fromDB).toBe(false);
            isDone = true;
          });
          expect(isDone).toBe(true);
        });

        it("Should ignore loading messages", function() {
          message.syncState = layer.Constants.SYNC_STATE.LOADING;
          var isDone = false;

          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([]);
            isDone = true;
          });
          expect(isDone).toBe(true);
        });

        it("Should generate a proper Message object", function() {
          message = conversation.createMessage("hey ho");
          message.receivedAt = new Date();
          var isDone = false;
          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([{
              id: message.id,
              url: message.url,
              position: message.position,
              recipient_status: message.recipientStatus,
              sent_at: message.sentAt.toISOString(),
              received_at: message.receivedAt.toISOString(),
              conversationId: message.conversationId,
              is_unread: false,
              sender: {
                id: "layer:///identities/Frodo",
                url: "http://localhost:9753/identities/Frodo",
                user_id: message.sender.userId || '',
                display_name: message.sender.displayName,
                avatar_url: message.sender.avatarUrl
              },
              sync_state: message.syncState,
              parts: [{
                id: message.parts[0].id,
                body: message.parts[0].body,
                encoding: message.parts[0].encoding,
                mime_type: message.parts[0].mimeType,
                content: null
              }]
            }]);
            expect(message.sender.displayName.length > 0).toBe(true);
            expect(message.sender.avatarUrl.length > 0).toBe(true);
            isDone = true;
          });
          expect(isDone).toBe(true);
        });

        it("Should generate a proper Announcement object", function() {
          message = client._createObject(JSON.parse(JSON.stringify(responses.announcement)));
          message.receivedAt = new Date();
          message.sender = new layer.Identity({
            fromServer: {
              id: null,
              user_id: null,
              url: null,
              display_name: 'Hey ho',
              avatar_url: null,
            },
            client: client
          });
          var isDone = false;

          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([{
              id: message.id,
              url: message.url,
              position: message.position,
              recipient_status: message.recipientStatus,
              sent_at: message.sentAt.toISOString(),
              received_at: message.receivedAt.toISOString(),
              is_unread: true,
              conversationId: 'announcement',
              sender: {
                user_id: '',
                id: '',
                url: '',
                display_name: 'Hey ho',
                avatar_url: ''
              },
              sync_state: message.syncState,
              parts: [{
                id: message.parts[0].id,
                body: message.parts[0].body,
                encoding: message.parts[0].encoding,
                mime_type: message.parts[0].mimeType,
                content: null
              }]
            }]);
            isDone = true;
          });
          expect(isDone).toBe(true);
        });

        // Tests won't run on server due to no Blob support
        it("Should write small Blobs as base64 data", function(done) {
          // Setup
          var text = new Array(1000).join('a');
          var blob = new Blob([text], {type : 'unknown/unhandlable'});
          var message = conversation.createMessage({
            parts: [new layer.MessagePart(blob), new layer.MessagePart(blob)]
          });
          message.receivedAt = new Date();

          // Run
          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([{
              id: message.id,
              url: message.url,
              position: message.position,
              recipient_status: message.recipientStatus,
              sent_at: message.sentAt.toISOString(),
              received_at: message.receivedAt.toISOString(),
              conversationId: message.conversationId,
              is_unread: false,
              sender: {
                id: "layer:///identities/Frodo",
                url: "http://localhost:9753/identities/Frodo",
                user_id: message.sender.userId || '',
                display_name: message.sender.displayName,
                avatar_url: message.sender.avatarUrl
              },
              sync_state: message.syncState,
              parts: [{
                id: message.parts[0].id,
                body: jasmine.any(String),
                encoding: message.parts[0].encoding,
                mime_type: message.parts[0].mimeType,
                useBlob: true,
                content: null
              },
              {
                id: message.parts[1].id,
                body: jasmine.any(String),
                encoding: message.parts[1].encoding,
                mime_type: message.parts[1].mimeType,
                useBlob: true,
                content: null
              }]
            }]);

            expect(result[0].parts[0].body.length > 500).toBe(true);
            expect(result[0].parts[1].body.length > 500).toBe(true);
            done();
          });
        });

        it("Should not write large Blobs", function() {
          // Setup
          var text = new Array(layer.DbManager.MaxPartSize + 10).join('a');
          var blob = new Blob([text], {type : 'unknown/unhandlable'});
          var message = conversation.createMessage({
            parts: [new layer.MessagePart(blob)]
          });
          message.receivedAt = new Date();
          var isDone = false;

          // Run
          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([{
              id: message.id,
              url: message.url,
              position: message.position,
              recipient_status: message.recipientStatus,
              sent_at: message.sentAt.toISOString(),
              received_at: message.receivedAt.toISOString(),
              conversationId: message.conversationId,
              is_unread: false,
              sender: {
                id: "layer:///identities/Frodo",
                url: "http://localhost:9753/identities/Frodo",
                user_id: message.sender.userId || '',
                display_name: message.sender.displayName,
                avatar_url: message.sender.avatarUrl
              },
              sync_state: message.syncState,
              parts: [{
                id: message.parts[0].id,
                body: null,
                encoding: message.parts[0].encoding,
                mime_type: message.parts[0].mimeType,
                content: null
              }]
            }]);
            isDone = true;
          });
          expect(isDone).toBe(true);
        });

        it("Should generate a proper Announcement object", function() {
          var data = JSON.parse(JSON.stringify(responses.announcement));
          delete client._models.identities[data.sender.id];
          message = client._createObject(data);
          message.receivedAt = new Date();
          var isDone = false;

          dbManager._getMessageData([message], function(result) {
            expect(result).toEqual([{
              id: message.id,
              url: message.url,
              position: message.position,
              recipient_status: message.recipientStatus,
              sent_at: message.sentAt.toISOString(),
              received_at: message.receivedAt.toISOString(),
              conversationId: 'announcement',
              is_unread: message.isUnread,
              sender: {
                user_id: 'admin',
                id: 'layer:///identities/admin',
                url: client.url + '/identities/admin',
                display_name: 'Lord Master the Admin',
                avatar_url: ''
              },
              sync_state: message.syncState,
              parts: [{
                id: message.parts[0].id,
                body: message.parts[0].body,
                encoding: message.parts[0].encoding,
                mime_type: message.parts[0].mimeType,
                content: null
              }]
            }]);
            isDone = true;
          });
          expect(isDone).toBe(true);
        });

        it("Should generate a proper Content object", function() {
          var isDone = false;
          dbManager._getMessageData([message], function(result) {
            expect(result[0]).toEqual(jasmine.objectContaining({
              parts: [{
                id: message.parts[0].id,
                body: message.parts[0].body,
                encoding: message.parts[0].encoding,
                mime_type: message.parts[0].mimeType,
                content: null
              }, {
                id: message.parts[1].id,
                body: message.parts[1].body,
                encoding: message.parts[1].encoding,
                mime_type: message.parts[1].mimeType,
                content: {
                  download_url: message.parts[1]._content.downloadUrl,
                  expiration:   message.parts[1]._content.expiration,
                  id:  message.parts[1]._content.id,
                  refresh_url:  message.parts[1]._content.refreshUrl,
                  size:  message.parts[1]._content.size
                }
              }]
            }));
            isDone = true;
        });
        expect(isDone).toBe(true);
      });
    });

    describe("The writeMessages() method", function() {
      it("Should forward isUpdate true to writeMessages", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getMessageData").and.callFake(function(data, callback) {callback([{id: 'fred'}])});
        dbManager.writeMessages([message]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('messages', jasmine.any(Object), undefined);
      });

      it("Should forward isUpdate true to writeMessages", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getMessageData").and.callFake(function(data, callback) {callback([{id: 'fred'}])});
        dbManager.writeMessages([message]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('messages', jasmine.any(Object), undefined);
      });

      it("Should feed data from _getMessageData to _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getMessageData").and.callFake(function(data, callback) {callback([{id: 'fred'}])});
        dbManager.writeMessages([message]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('messages', [{id: 'fred'}], undefined);
      });
    });


    describe("The _getIdentityData() method", function() {
      it("Should ignore anything that just came out of the database and clear _fromDB", function() {
        identity._fromDB = true;
        expect(dbManager._getIdentityData([identity])).toEqual([]);
        expect(identity._fromDB).toBe(false);
      });

      it("Should ignore Basic Identities", function() {
        expect(dbManager._getIdentityData([identity, basicIdentity])).toEqual(dbManager._getIdentityData([identity]));
      });

      it("Should write Basic Identities", function() {
        expect(dbManager._getIdentityData([identity, basicIdentity], true)).toEqual([dbManager._getIdentityData([identity], true)[0], {
          id: basicIdentity.id,
          url: client.url + "/identities/" + basicIdentity.userId,
          user_id: basicIdentity.userId,
          display_name: basicIdentity.displayName,
          avatar_url: basicIdentity.avatarUrl
        }]);
      });

      it("Should ignore Loading Identities", function() {
        identity.syncState = layer.Constants.SYNC_STATE.LOADING;
        expect(dbManager._getIdentityData([identity, basicIdentity])).toEqual([]);
      });


      it("Should generate a proper Identity object", function() {
        expect(dbManager._getIdentityData([identity])).toEqual([{
          id: identity.id,
          url: identity.url,
          user_id: identity.userId,
          first_name: identity.firstName,
          last_name: identity.lastName,
          display_name: identity.displayName,
          email_address: identity.emailAddress,
          avatar_url: identity.avatarUrl,
          metadata: identity.metadata,
          public_key: identity.publicKey,
          phone_number: identity.phoneNumber,
          sync_state: identity.syncState,
          type: layer.Identity.UserType,
        }]);
      });
    });

    describe("The writeIdentities() method", function() {
      it("Should forward isUpdate true to writeIdentities", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getIdentityData").and.returnValue([{id: 'fred'}]);
        dbManager.writeIdentities([identity]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('identities', jasmine.any(Object), undefined);
      });

      it("Should forward isUpdate true to writeIdentities", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getIdentityData").and.returnValue([{id: 'fred'}]);
        dbManager.writeIdentities([message]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('identities', jasmine.any(Object), undefined);
      });

      it("Should feed data from _getIdentityData to _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getIdentityData").and.returnValue([{id: 'fred'}]);
        dbManager.writeIdentities([message]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('identities', [{id: 'fred'}], undefined);
      });
    });

    describe("The _getSyncEventData() method", function() {
      var syncEvent;
      beforeEach(function() {
        syncEvent = new layer.XHRSyncEvent({
          target: "fred",
          depends: ["joe", "fred"],
          operation: "brain removal",
          data: {
            zombieCount: "cant count without brains"
          },
          url: "sue",
          headers: {'content-type': 'mountain/text'},
          method: 'POST',
          createdAt: Date.now()
        });
      });

      it("Should ignore anything that just came out of the database and clear fromDB", function() {
        syncEvent.fromDB = true;
        expect(dbManager._getSyncEventData([syncEvent])).toEqual([]);
        expect(syncEvent.fromDB).toBe(false);
      });

      it("Should generate a proper object", function() {
        expect(dbManager._getSyncEventData([syncEvent])).toEqual([{
          id: syncEvent.id,
          url: syncEvent.url,
          target: syncEvent.target,
          depends: syncEvent.depends,
          data: syncEvent.data,
          isWebsocket: false,
          created_at: syncEvent.createdAt,
          method: syncEvent.method,
          headers: syncEvent.headers,
          operation: syncEvent.operation
        }]);
      });

      it("Should generate a proper object", function() {
        var syncEvent = new layer.WebsocketSyncEvent({
          target: "fred",
          depends: ["joe", "fred"],
          operation: "brain removal",
          data: {
            zombieCount: "cant count without brains"
          },
          method: 'POST',
          createdAt: Date.now()
        });
        expect(dbManager._getSyncEventData([syncEvent])).toEqual([{
          id: syncEvent.id,
          url: '',
          target: syncEvent.target,
          depends: syncEvent.depends,
          data: syncEvent.data,
          isWebsocket: true,
          created_at: syncEvent.createdAt,
          method: null,
          headers: null,
          operation: syncEvent.operation
        }]);
      });
    });

    describe("The writeSyncEvents() method", function () {
      var syncEvent;
      beforeEach(function() {
        var syncEvent = new layer.XHRSyncEvent({
          target: "fred",
          depends: ["joe", "fred"],
          operation: "brain removal",
          data: {
            zombieCount: "cant count without brains"
          },
          url: "sue",
          headers: {'content-type': 'mountain/text'},
          method: 'POST',
          createdAt: new Date("2010-10-10")
        });
      });

      it("Should call _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getSyncEventData").and.returnValue([{id: 'fred'}]);
        dbManager.writeSyncEvents([syncEvent]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('syncQueue', jasmine.any(Object), undefined);
      });

      it("Should feed data from _getSyncEventData to _writeObjects", function() {
        spyOn(dbManager, "_writeObjects");
        spyOn(dbManager, "_getSyncEventData").and.returnValue([{id: 'fred'}]);
        dbManager.writeSyncEvents([syncEvent]);
        expect(dbManager._writeObjects).toHaveBeenCalledWith('syncQueue', [{id: 'fred'}], undefined);
      });
    });


    describe("The _writeObjects() method", function() {
      it("Should do nothing if no data", function() {
        var spy = jasmine.createSpy('spy');
        spyOn(dbManager, "onOpen");
        dbManager._writeObjects('conversations', [], spy);
        expect(spy).toHaveBeenCalledWith();
        expect(dbManager.onOpen).not.toHaveBeenCalled();
      });

      it("Should work through onOpen", function() {
        spyOn(dbManager, "onOpen");
        dbManager._writeObjects('conversations', [conversation], null);
        expect(dbManager.onOpen).toHaveBeenCalledWith(jasmine.any(Function));
      });

      it("Should write a conversation object", function(done) {
        dbManager._writeObjects('conversations', [{
          id: "frodo got no mojo",
          mojo: 5
        }], function() {
          dbManager.getObjects('conversations', ['frodo got no mojo'], function(result) {
            expect(result).toEqual([{
              id: 'frodo got no mojo',
              mojo: 5
            }]);
            done();
          });
        });
      });

      it("Should update a conversation object if called with isUpdate", function(done) {
        dbManager._writeObjects('conversations', [{
          id: "frodo got no mojo",
          mojo: 5
        }], function() {
          dbManager._writeObjects('conversations', [{
            id: "frodo got no mojo",
            mojo: 7
          }], function() {
            dbManager.getObjects('conversations', ['frodo got no mojo'], function(result) {
              expect(result).toEqual([{
                id: 'frodo got no mojo',
                mojo: 7
              }]);
              done();
            });
          });
        });
      });

      it("Should update a conversation object if called without isUpdate", function(done) {
        dbManager._writeObjects('conversations', [{
          id: "frodo got no mojo",
          mojo: 5
        }], function() {
          dbManager._writeObjects('conversations', [{
            id: "frodo got no mojo",
            mojo: 7
          }], function() {
            dbManager.getObjects('conversations', ['frodo got no mojo'], function(result) {
              expect(result).toEqual([{
                id: 'frodo got no mojo',
                mojo: 7
              }]);
              done();
            });
          });
        });
      });
    });

    describe("The loadConversations() method", function() {
      it("Should handle case where lastMessage is already loaded", function() {
        conversation.lastMessage = message;
        client._models.messages[message.id] = message;
        client._models.conversations = {};
        spyOn(dbManager, "_loadByIndex").and.callFake(function(tableName, sortIndex, range, isFromId, pageSize, callback) {
          callback(dbManager._getConversationData([conversation]));
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          callback([]);
        });
        spyOn(dbManager, "_loadConversationsResult");

        // Run
        var f = function() {};
        dbManager.loadConversations('last_message', null, null, f);

        // Posttest
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'last_message_sent', null, false, null, jasmine.any(Function));
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [], jasmine.any(Function));
        expect(dbManager._loadConversationsResult).toHaveBeenCalledWith(
          dbManager._getConversationData([conversation]),
          [],
          f
        );
      });

      it("Should handle case where lastMessage is empty", function() {
        conversation.lastMessage = null;
        client._models.messages = {};
        spyOn(dbManager, "_loadByIndex").and.callFake(function(tableName, sortIndex, range, isFromId, pageSize, callback) {
          callback(dbManager._getConversationData([conversation]));
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          callback([]);
        });
        spyOn(dbManager, "_loadConversationsResult");

        // Run
        var f = function() {};
        dbManager.loadConversations('created_at', null, null, f);

        // Posttest
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'created_at', null, false, null, jasmine.any(Function));
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [], jasmine.any(Function));
        expect(dbManager._loadConversationsResult).toHaveBeenCalledWith(
          dbManager._getConversationData([conversation]),
          [],
          f
        );
      });

      it("Should handle case where lastMessage is not already loaded", function() {
        conversation.lastMessage = message;
        delete client._models.messages[message.id];
        spyOn(dbManager, "_loadByIndex").and.callFake(function(tableName, sortIndex, range, isFromId, pageSize, callback) {
          callback(dbManager._getConversationData([conversation]));
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          dbManager._getMessageData([message], function(result) {
            callback(result);
          });
        });
        spyOn(dbManager, "_loadConversationsResult");


        // Run
        var f = function() {};
        dbManager.loadConversations('created_at', null, null, f);

        // Posttest
        var getMessageData;
        dbManager._getMessageData([message], function(result) {getMessageData = result;});
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'created_at', null, false, null, jasmine.any(Function));
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [message.id], jasmine.any(Function));
        expect(dbManager._loadConversationsResult).toHaveBeenCalledWith(
          dbManager._getConversationData([conversation]),
          getMessageData,
          f
        );
      });

      it("Should use the fromId and pageSize properties for created_at sort", function() {
        spyOn(dbManager, "_loadByIndex")
        dbManager.loadConversations('created_at', conversation.id, 5);

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'created_at', jasmine.any(IDBKeyRange), true, 5, jasmine.any(Function));
        expect(range.upper).toEqual([conversation.createdAt.toISOString()]);
        expect(range.lower).toEqual(undefined);
      });

      it("Should use the fromId and pageSize properties for last_message sort", function() {
        spyOn(dbManager, "_loadByIndex")
        dbManager.loadConversations('last_message', conversation.id, 5);

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('conversations', 'last_message_sent', jasmine.any(IDBKeyRange), true, 5, jasmine.any(Function));
        expect(range.upper).toEqual([conversation.lastMessage.sentAt.toISOString()]);
        expect(range.lower).toEqual(undefined);
      });
    });


    describe("The _loadConversationsResult() method", function() {
      it("Should call _createMessage for each Message", function() {
        spyOn(dbManager, "_createMessage");
        var m1 = conversation.createMessage("m1").send();
        var m2 = conversation.createMessage("m2").send();
        var m1Data, m2Data;
        dbManager._getMessageData([m1, m2], function(result) {
          m1Data = result[0];
          m2Data = result[1];
        });

        // Run
        dbManager._getMessageData([m1, m2], function(result) {
          dbManager._loadConversationsResult([], result);
        });

        // Posttest
        expect(dbManager._createMessage).toHaveBeenCalledWith(m1Data);
        expect(dbManager._createMessage).toHaveBeenCalledWith(m2Data);
      });

      it("Should call _createConversation for each Conversation", function() {
        spyOn(dbManager, "_createConversation");
        var c1 = client.createConversation({participants: ["c1"]});
        var c2 = client.createConversation({participants: ["c2"]});
        c1.syncState = c2.syncState = layer.Constants.SYNC_STATE.SYNCED;

        // Run
        dbManager._loadConversationsResult(dbManager._getConversationData([c1, c2]), []);

        // Posttest
        expect(dbManager._createConversation).toHaveBeenCalledWith(dbManager._getConversationData([c1])[0]);
        expect(dbManager._createConversation).toHaveBeenCalledWith(dbManager._getConversationData([c2])[0]);
      });

      it("Should filter out any Conversation that was already loaded", function() {
        var callback = jasmine.createSpy('callback');
        var c1 = client.createConversation({participants: ["c1"]});
        var c2 = client.createConversation({participants: ["c2"]});
        c1.syncState = c2.syncState = layer.Constants.SYNC_STATE.SYNCED;
        client._models.conversations = {};
        client._models.conversations[c2.id] = c2;

        // Run
        dbManager._loadConversationsResult(dbManager._getConversationData([c1, c2]), [], callback);

        // Posttest
        expect(callback).toHaveBeenCalledWith([jasmine.objectContaining({id: c1.id}), jasmine.objectContaining({id: c2.id})]);
      });
    });

    describe("The loadChannels() method", function() {

      it("Should use the fromId and pageSize properties", function() {
        spyOn(dbManager, "_loadByIndex")
        dbManager.loadChannels(channel.id, 5);

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('channels', 'created_at', jasmine.any(IDBKeyRange), true, 5, jasmine.any(Function));
        expect(range.upper).toEqual([channel.createdAt.toISOString()]);
        expect(range.lower).toEqual(undefined);
      });
    });


    describe("The _loadChannelsResult() method", function() {
      it("Should call _createChannel for each Channel", function() {
        spyOn(dbManager, "_createChannel");
        var c1 = client.createChannel({name: 'a1'});
        var c2 = client.createChannel({name: 'a2'});
        c1.syncState = c2.syncState = layer.Constants.SYNC_STATE.SYNCED;

        // Run
        dbManager._loadChannelsResult(dbManager._getChannelData([c1, c2]));

        // Posttest
        expect(dbManager._createChannel).toHaveBeenCalledWith(dbManager._getChannelData([c1])[0]);
        expect(dbManager._createChannel).toHaveBeenCalledWith(dbManager._getChannelData([c2])[0]);
      });

      it("Should filter out any Channel that was already loaded", function() {
        var callback = jasmine.createSpy('callback');
        var c1 = client.createChannel({name: 'a1'});
        var c2 = client.createChannel({name: 'a2'});
        c1.syncState = c2.syncState = layer.Constants.SYNC_STATE.SYNCED;
        client._models.channels = {};
        client._models.channels[c2.id] = c2;

        // Run
        dbManager._loadChannelsResult(dbManager._getChannelData([c1, c2]), callback);

        // Posttest
        expect(callback).toHaveBeenCalledWith([jasmine.objectContaining({id: c1.id}), jasmine.objectContaining({id: c2.id})]);
      });
    });



    describe("The loadMessages() method", function() {
      it("Should call _loadByIndex", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadMessages(conversation.id);


        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversationId', jasmine.any(IDBKeyRange), false, undefined, jasmine.any(Function));
        expect(range.lower).toEqual([conversation.id, 0]);
        expect(range.upper).toEqual([conversation.id, MAX_SAFE_INTEGER]);
      });

      it("Should call _loadByIndex with fromId and pageSize", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadMessages(conversation.id, message.id, 12);

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversationId', jasmine.any(IDBKeyRange), true, 12, jasmine.any(Function));
        expect(range.lower).toEqual([conversation.id, 0]);
        expect(range.upper).toEqual([conversation.id, message.position]);
      });

      it("Should call _loadMessagesResult", function() {
        spyOn(dbManager, "_loadMessagesResult");
        spyOn(dbManager, "_loadByIndex").and.callFake(function(table, index, range, isFromId, pageSize, callback) {
          callback([message]);
        });
        var spy = jasmine.createSpy('spy');
        dbManager.loadMessages(conversation.id, null, null, spy);
        expect(dbManager._loadMessagesResult).toHaveBeenCalledWith([message], spy);
      });
    });

    describe("The loadAnnouncements() method", function() {
      it("Should call _loadByIndex", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadAnnouncements();

        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversationId', jasmine.any(IDBKeyRange), false, undefined, jasmine.any(Function));
        expect(range.lower).toEqual(['announcement', 0]);
        expect(range.upper).toEqual(['announcement', MAX_SAFE_INTEGER]);
      });

      it("Should call _loadByIndex with fromId", function() {
        spyOn(dbManager, "_loadByIndex");
        dbManager.loadAnnouncements(announcement.id, 12);
        var range = dbManager._loadByIndex.calls.allArgs()[0][2];
        expect(dbManager._loadByIndex).toHaveBeenCalledWith('messages', 'conversationId', jasmine.any(IDBKeyRange), true, 12, jasmine.any(Function));
        expect(range.lower).toEqual(['announcement', 0]);
        expect(range.upper).toEqual(['announcement', announcement.position]);
      });

      it("Should call _loadMessagesResult", function() {
        spyOn(dbManager, "_loadMessagesResult");
        spyOn(dbManager, "_loadByIndex").and.callFake(function(table, index, query, isFromId, pageSize, callback) {
          callback([message]);
        });
        var spy = jasmine.createSpy('spy');
        dbManager.loadAnnouncements(null, null, spy);
        expect(dbManager._loadMessagesResult).toHaveBeenCalledWith([message], spy);
      });
    });

    describe("The _loadMessagesResult() method", function() {
      it("Calls createMessage on each message", function() {
        var m1 = conversation.createMessage("m1").send();
        var m2 = conversation.createMessage("m2").send();
        var m1Data, m2Data;
        dbManager._getMessageData([m1, m2], function(result) {
          m1Data = result[0];
          m2Data = result[1];
        });
        spyOn(dbManager, "_createMessage");

        // Run
        dbManager._getMessageData([m1, m2], function(result) {
          dbManager._loadMessagesResult(result);
        });

        // Posttest
        expect(dbManager._createMessage).toHaveBeenCalledWith(m1Data);
        expect(dbManager._createMessage).toHaveBeenCalledWith(m2Data);
      });

      it("Returns new and existing messages", function() {
        var m1 = conversation.createMessage("m1").send();
        var m2 = conversation.createMessage("m2");
        client._models.messages = {}
        client._models.messages[m2.id] = m2;

        var spy = jasmine.createSpy('spy');

        // Run
        dbManager._getMessageData([m1, m2], function(result) {
          dbManager._loadMessagesResult(result, spy);
        });

        // Posttest
        expect(spy).toHaveBeenCalledWith([jasmine.objectContaining({id: m1.id}), m2]);
      });
    });

    describe("The loadIdentities() method", function() {
      it("Should call _loadAll", function() {
        spyOn(dbManager, "_loadAll");
        dbManager.loadIdentities(function() {});
        expect(dbManager._loadAll).toHaveBeenCalledWith('identities', jasmine.any(Function));
      });

      it("Should call _loadIdentitiesResult", function() {
        spyOn(dbManager, "_loadIdentitiesResult");
        spyOn(dbManager, "_loadAll").and.callFake(function(table, callback) {
          callback([identity]);
        });
        var spy = jasmine.createSpy('spy');
        dbManager.loadIdentities(spy);
        expect(dbManager._loadIdentitiesResult).toHaveBeenCalledWith([identity], spy);
      });
    });

    describe("The _loadIdentitiesResult() method", function() {
      it("Calls _createIdentity on each identity", function() {
        spyOn(dbManager, "_createIdentity");
        basicIdentity.isFullIdentity = true;

        // Run
        dbManager._loadIdentitiesResult(dbManager._getIdentityData([identity, basicIdentity]));

        // Posttest
        expect(dbManager._createIdentity).toHaveBeenCalledWith(dbManager._getIdentityData([identity])[0]);
        expect(dbManager._createIdentity).toHaveBeenCalledWith(dbManager._getIdentityData([basicIdentity])[0]);
      });

      it("Only returns new identities", function() {
        client._models.identities = {}
        client._models.identities[identity.id] = identity;
        basicIdentity.isFullIdentity = true;
        var spy = jasmine.createSpy('spy');

        // Run
        dbManager._loadIdentitiesResult(dbManager._getIdentityData([identity, basicIdentity]), spy);

        // Posttest
        expect(spy).toHaveBeenCalledWith([identity, jasmine.objectContaining({id: basicIdentity.id})]);
      });
    });

    describe("The _createConversation() method", function() {
      it("Should return a Conversation", function() {
        delete client._models.conversations[conversation.id];
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0])).toEqual(jasmine.any(layer.Conversation));
      });

      it("Should flag Conversation with _fromDB property", function() {
        delete client._models.conversations[conversation.id];
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0])._fromDB).toBe(true);
      });

      it("Should set lastMessage if the id is found", function() {
        delete client._models.conversations[conversation.id];
        var message = conversation.lastMessage;
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0]).lastMessage).toBe(message);
      });

      it("Should do nothing if the Conversation already is instantiated", function() {
        expect(dbManager._createConversation(dbManager._getConversationData([conversation])[0])).toBe(undefined);
      });
    });

    describe("The _createChannel() method", function() {
      it("Should return a Channel", function() {
        delete client._models.channels[channel.id];
        expect(dbManager._createChannel(dbManager._getChannelData([channel])[0])).toEqual(jasmine.any(layer.Channel));
      });

      it("Should flag Channel with _fromDB property", function() {
        delete client._models.channels[channel.id];
        expect(dbManager._createChannel(dbManager._getChannelData([channel])[0])._fromDB).toBe(true);
      });

      it("Should set lastMessage if the id is found", function() {
        delete client._models.channels[channel.id];
        var message = channel.lastMessage;
        expect(dbManager._createChannel(dbManager._getChannelData([channel])[0]).lastMessage).toBe(message);
      });

      it("Should do nothing if the Channel already is instantiated", function() {
        expect(dbManager._createChannel(dbManager._getChannelData([channel])[0])).toBe(undefined);
      });
    });


    describe("The _createMessage() method", function() {
      it("Should return a Message", function() {
        delete client._models.messages[message.id];
        isDone = false;
        dbManager._getMessageData([message], function(result) {
          var m = dbManager._createMessage(result[0]);
          expect(m).toEqual(jasmine.any(layer.Message));
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should flag Message with _fromDB property", function() {
        delete client._models.messages[message.id];
        isDone = false;
        dbManager._getMessageData([message], function(result) {
          var m = dbManager._createMessage(result[0]);
          expect(m._fromDB).toBe(true);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });

      it("Should do nothing if the Message already is instantiated", function() {
        client._models.messages[message.id] = message;
        isDone = false;
        dbManager._getMessageData([message], function(result) {
          var m = dbManager._createMessage(result[0]);
          expect(m).toBe(undefined);
          isDone = true;
        });
        expect(isDone).toBe(true);
      });
    });

    describe("The _createIdentity() method", function() {
      it("Should return an Identity", function() {
        delete client._models.identities[identity.id];
        expect(dbManager._createIdentity(dbManager._getIdentityData([identity])[0])).toEqual(jasmine.any(layer.Identity));
      });

      it("Should flag Identity with _fromDB property", function() {
        delete client._models.identities[identity.id];
        expect(dbManager._createIdentity(dbManager._getIdentityData([identity])[0])._fromDB).toBe(true);
      });

      it("Should do nothing if the Identity already is instantiated", function() {
        client._models.identities[identity.id] = identity;
        expect(dbManager._createIdentity(dbManager._getIdentityData([identity])[0])).toBe(undefined);
      });
    });

    describe("The loadSyncQueue() method", function() {
      it("Should call _loadAll", function() {
        spyOn(dbManager, "_loadAll");
        dbManager.loadSyncQueue();
        expect(dbManager._loadAll).toHaveBeenCalledWith('syncQueue', jasmine.any(Function));
      });

      it("Should call _loadSyncEventRelatedData with results", function() {
        spyOn(dbManager, "_loadSyncEventRelatedData");
        var spy = jasmine.createSpy('callback');
        var syncEvent = new layer.XHRSyncEvent({});
        var syncEventRaw = dbManager._getSyncEventData([syncEvent])[0];
        spyOn(dbManager, "_loadAll").and.callFake(function(tableName, callback) {
          callback([syncEventRaw]);
        });

        dbManager.loadSyncQueue(spy);
        expect(dbManager._loadSyncEventRelatedData).toHaveBeenCalledWith([syncEventRaw], spy);
      });
    });

    describe("The _loadSyncEventRelatedData() method", function() {
      var rawSyncEvents;
      beforeEach(function() {
        rawSyncEvents = dbManager._getSyncEventData([
            new layer.XHRSyncEvent({
              target: conversation.id
            }),
            new layer.XHRSyncEvent({
              target: message.id
            }),
            new layer.XHRSyncEvent({
              target: identity.id
            })
        ]);
      });

      it("Should call getObjects for all messageIds", function() {
        spyOn(dbManager, "getObjects");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager.getObjects).toHaveBeenCalledWith('messages', [message.id], jasmine.any(Function));
      });

      it("Should call _createMessage for all messageIds", function() {
        var rawMessage;
        dbManager._getMessageData([message], function(result) {
            rawMessage = result[0];
        });
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'messages') {
            callback([rawMessage]);
          } else {
            callback([]);
          }
        });
        spyOn(dbManager, "_createMessage");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createMessage).toHaveBeenCalledWith(rawMessage);
      });

      it("Should call getObjects for all conversationIds", function() {
        var rawConversation = dbManager._getConversationData([conversation])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'conversations') {
            callback([rawConversation]);
          } else {
            callback([]);
          }
        });
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager.getObjects).toHaveBeenCalledWith('conversations', [conversation.id], jasmine.any(Function));
      });

      it("Should call _createConversation for all conversationIds", function() {
        var rawConversation = dbManager._getConversationData([conversation])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'conversations') {
            callback([rawConversation]);
          } else {
            callback([]);
          }
        });
        spyOn(dbManager, "_createConversation");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createConversation).toHaveBeenCalledWith(rawConversation);
      });

      it("Should not call _createConversation for deleted conversationIds", function() {
        var rawConversation = dbManager._getConversationData([conversation])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'conversations') {
            expect(ids.indexOf(rawSyncEvents[0].target) === -1).toBe(true);
          }
          callback([]);
        });
        spyOn(dbManager, "_createConversation");
        rawSyncEvents[0].operation = "DELETE";
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createConversation).not.toHaveBeenCalledWith(rawConversation);
      });

      it("Should call getObjects for all identityIds", function() {
        spyOn(dbManager, "getObjects");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager.getObjects).toHaveBeenCalledWith('identities', [identity.id], jasmine.any(Function));
      });

      it("Should call _createIdentity for all identityIds", function() {
        var rawIdentity = dbManager._getIdentityData([identity])[0];
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          if (tableName === 'identities') {
            callback([rawIdentity]);
          } else {
            callback([]);
          }
        });
        spyOn(dbManager, "_createIdentity");
        dbManager._loadSyncEventRelatedData(rawSyncEvents, function() {});
        expect(dbManager._createIdentity).toHaveBeenCalledWith(rawIdentity);
      });

      it("Should call _loadSyncEventResults", function() {
        spyOn(dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
          callback([]);
        });
        spyOn(dbManager, "_loadSyncEventResults");
        var spy = jasmine.createSpy('callback');
        dbManager._loadSyncEventRelatedData(rawSyncEvents, spy);
        expect(dbManager._loadSyncEventResults).toHaveBeenCalledWith(rawSyncEvents, spy);
        expect(dbManager.getObjects.calls.count()).toEqual(3);
      });
    });

    describe("The _loadSyncEventResults() method", function() {
      var syncEvents, now;
      beforeEach(function() {
        now = Date.now();
        syncEvents = [
          new layer.WebsocketSyncEvent({
            target: message.id,
            depends: [conversation.id],
            operation: "POST",
            id: "fred",
            data: {hey: "ho"},
            createdAt: now,
            fromDB: false
          }),
          new layer.XHRSyncEvent({
            target: conversation.id,
            depends: [],
            operation: "update",
            id: "derf",
            data: {ho: "hey"},
            headers: {accept: 'ho'},
            method: "PATCH",
            url: "howdy",
            createdAt: now,
            fromDB: false
          }),
          new layer.XHRSyncEvent({
            target: conversation.id + 'a',
            depends: [],
            operation: "update",
            id: "derf",
            data: {ho: "hey"},
            headers: {accept: 'ho'},
            method: "PATCH",
            url: "howdy",
            createdAt: now,
            fromDB: false
          }),
          new layer.XHRSyncEvent({
            target: conversation.id + 'b',
            depends: [],
            operation: "DELETE",
            id: "derf",
            data: {ho: "hey"},
            headers: {accept: 'ho'},
            method: "DELETE",
            url: "howdy",
            createdAt: now,
            fromDB: false
          })
        ];
        client._models.messages[message.id] = message;
      });
      it("Should return XHRSyncEvents", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });
        expect(result[1].fromDB).toBe(true);
        result[1].fromDB = false;
        expect(result[1]).toEqual(syncEvents[1]);
      });

      it("Should return WebsocketSyncEvents", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });
        expect(result[0].fromDB).toBe(true);
        result[0].fromDB = false;
        expect(result[0]).toEqual(syncEvents[0]);
      });

      it("Should filter out SyncEvents whose target cant be found", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });
        expect(result.filter(function(item) {
          return item.target == conversation.id + 'a';
        })).toEqual([]);
      });

      it("Should not filter out SyncEvents whose target cant be found if its a DELETE operation", function() {
        var result;
        dbManager._loadSyncEventResults(dbManager._getSyncEventData(syncEvents), function(events) {
          result = events;
        });

        expect(result.filter(function(item) {
          return item.target == conversation.id + 'b';
        })[0].id).toEqual(syncEvents[2].id);
      });
    });

    describe("The _loadAll() method", function() {
      var m1, m2, m3, m4;
      var writtenData;
      beforeEach(function(done) {
        deleteTables(function() {

          m1 = conversation.createMessage("m1").send();
          m2 = conversation.createMessage("m2").send();
          m3 = conversation.createMessage("m3").send();
          m4 = conversation.createMessage("m4").send();
          dbManager._getMessageData([message, m4, m2, m3, m1], function(result) {
            writtenData = result;
            dbManager._writeObjects('messages', result, done);
          });
        });
      });

      it("Should load everything in the table", function(done) {
        dbManager._loadAll('messages', function(result) {
          var sortedExpect = layer.Util.sortBy(writtenData, function(item) {return item.id});
          expect(result).toEqual(sortedExpect);
          done();
        });
      });

      it("Should load nothing if table is", function(done) {
        var dbManager = new layer.DbManager({
          enabled: true,
          client: client,
          tables: {conversations: true}
        });
        dbManager._loadAll('messages', function(result) {
          expect(result).toEqual([]);
          done();
        });
      });
    });

    describe("The _loadByIndex() method", function() {
      var m1, m2, m3, m4;
      var writtenData;
      beforeEach(function(done) {
        var c2 = client.createConversation({participants: ["c2"]});
        message = conversation.createMessage("first message").send();
        m1 = conversation.createMessage("m1").send();
        m2 = conversation.createMessage("m2").send();
        m3 = c2.createMessage("m3").send();
        m4 = c2.createMessage("m4").send();
        setTimeout(function() {
          deleteTables(function() {
            dbManager._getMessageData([m1, m2, m3, m4], function(result) {
              writtenData = result;
              dbManager._writeObjects('messages', result, function() {
                setTimeout(done, 50);
              });
            });
          });
        }, 50);
      });

      it("Should get only items matching the index", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m1], function(result) { expectedResult = result; });
        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversationId', query, false, null, function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.position}).reverse();
          expect(result).toEqual(sortedExpect);
          done();
        });
      });

      it("Should apply pageSize", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m1, message], function(result) { expectedResult = result; });

        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversationId', query, false, 2, function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.position}).reverse();

          expect(result).toEqual([sortedExpect[0], sortedExpect[1]]);
          done();
        });
      });

      it("Should skip first result if isFromId", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m1], function(result) { expectedResult = result; });

        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversationId', query, true, null, function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.position}).reverse();

          expect(result).toEqual([sortedExpect[1]]);
          done();
        });
      });


      it("Should get nothing if disabled", function(done) {
        var dbManager = new layer.DbManager({
          enabled: true,
          client: client,
          tables: {messages: false}
          });
        const query = window.IDBKeyRange.bound([conversation.id, 0], [conversation.id, MAX_SAFE_INTEGER]);
        dbManager._loadByIndex('messages', 'conversationId', query, false, null, function(result) {
          expect(result).toEqual([]);
          done();
        });
      });
    });


    describe("The deleteObjects() method", function() {

      var m1, m2, m3, m4;
      var writtenData;
      beforeEach(function(done) {
        deleteTables(function() {
          m1 = conversation.createMessage("m1").send();
          m2 = conversation.createMessage("m2").send();
          m3 = conversation.createMessage("m3").send();
          m4 = conversation.createMessage("m4").send();
          dbManager._getMessageData([m1, m2, m3, m4], function(result) {
            writtenData = result;
            dbManager._writeObjects('messages', result, function() {
              setTimeout(done, 200);
            });
          });
        });
      });

      it("Should delete all of the specified items", function(done) {
        var expectedResult;
        dbManager._getMessageData([m4, m2], function(result) {expectedResult = result;});
        dbManager.deleteObjects('messages', [m1, m3], function() {
          dbManager._loadAll('messages', function(result) {
            var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.id});
            expect(result).toEqual(sortedExpect);
            done();
          });
        });
      });
    });

    describe("The getObjects() method", function() {
      var m1, m2, m3, m4;
      beforeEach(function(done) {
        m1 = conversation.createMessage("m1").send();
        m2 = conversation.createMessage("m2").send();
        m3 = conversation.createMessage("m3").send();
        m4 = conversation.createMessage("m4").send();
        dbManager._getMessageData([m1, m2, m3, m4], function(result) {
          dbManager._writeObjects('messages', result, done);
        });
      });
      it("Should get the specified objects", function(done) {
        var expectedResult;
        dbManager._getMessageData([m2, m4, m1], function(result) {expectedResult = result;});
        dbManager.getObjects('messages', [m2.id, m4.id, m1.id], function(result) {
          var sortedExpect =  layer.Util.sortBy(expectedResult, function(item) {return item.id});
          expect(result).toEqual(sortedExpect);
          done();
        });
      });
    });

    describe("The getObject() method", function() {
      var m1;
      beforeEach(function(done) {
        m1 = conversation.createMessage({
          parts: [
            {mimeType: 'text/plain', body: 'm1'},
            {mimeType: 'he/ho', body: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAECElEQVR4Xu2ZO44TURREa0SAWBASKST8xCdDQMAq+OyAzw4ISfmLDBASISERi2ADEICEWrKlkYWny6+77fuqalJfz0zVOXNfv/ER8mXdwJF1+oRHBDCXIAJEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8wbM42cDRADzBszjZwNEAPMGzONnA0QA8waWjX8OwHcAv5f9Me3fPRugvbuxd14C8B7AVwA3q0oQAcYwtr2+hn969faPVSWIAG2AT3rXJvz17CcAN6ptgggwrwDb4JeVIALMJ8AY/JISRIB5BGDhr3/aZwDXKxwHEWC6AJcBvAOwfuBjvuNfABcBfGGGl5yJANPabYV/B8DLaT96nndHgPYeu4c/RI8AbQJIwO9FgDMAfrVxWuRdMvB7EOA+gHsALgD4uQjO3b6pFPzqAjwA8HTF5weA8weWQA5+ZQGOw1//jR5SAkn4VQV4CODJls18CAmuAHjbcM8vc9U76ZSrdgt4BODxyLG8Twla4P8BcLfKPX/sEaeSAAz8fR4H8vArHQHXAHwYs3Xj9SU3gQX8SgKcAvBitTp38WAJCWzgVxJg+F0qSGAFv5oAh5bADn5FAQ4lwVUAb3a86nX1tL/tXK10Czj+O+7zOLCFX3UDrEXYhwTW8KsLsPRx0Ap/+A/fq12uKpVnqx4BSx8Hgb9quAcB5t4EgX/sz6sXAeaSIPA3zqOeBJgqwTMAzxuuelJn/ubzSG8CTJFg12ex4Z4vDb+HW8A2aK1XRFYCC/g9C7DkJrCB37sAS0hgBV9BgDklGODfBvCaPScU5np8CPxf71OfCSzhq2yAqZ8d2MJXE6DlOLCGryjALhLYw1cVgJEg8Dv7MKjlgXvbg2Hgd/ph0BwSBH7nHwZNkeCW4z1/rDCV/wOM5RyOg7MAvo0Nur3uIoAbVzpvBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hyMAJpc6VQRgK5KczACaHKlU0UAuirNwQigyZVOFQHoqjQHI4AmVzpVBKCr0hz8BzIXtYE3VcPnAAAAAElFTkSuQmCC'}
          ]
        }).send();
        dbManager._getMessageData([m1], function(result) {
          dbManager._writeObjects('messages', result, done);
        });
      });

      it("Should get the specified message", function(done) {
        var expectedResult;
        dbManager._getMessageData([m1], function(result) {
          expectedResult = result;
        });
        dbManager.getObject('messages', m1.id, function(result) {
          result.parts.pop(); expectedResult[0].parts.pop(); // Next test focuses on blobs
          delete result.sent_at;
          delete expectedResult[0].sent_at;
          expect(result).toEqual(expectedResult[0]);
          done();
        });
      });

      it("Should get the specified object with blob data and no encoding", function(done) {
        dbManager.getObject('messages', m1.id, function(result) {
          expect(result.parts[1].encoding).toBe(null);
          expect(layer.Util.isBlob(result.parts[1].body)).toBe(true);
          done();
        });
      });

      it("Should get the specified identity", function(done) {
        var expectedResult = dbManager._getIdentityData([userIdentity]);
        dbManager.writeIdentities([userIdentity], function() {
          dbManager.getObject('identities', userIdentity.id, function(result) {
            expect(result).toEqual(expectedResult[0]);
            done();
          });
        });
      });

      it("Should get the specified conversation with last_message", function(done) {
        var expectedResult = dbManager._getConversationData([conversation]);
        dbManager.writeConversations([conversation], function() {
          dbManager.getObject('conversations', conversation.id, function(result) {
            var lastMessageResult = result.last_message;
            delete result.last_message;
            delete expectedResult[0].last_message;
            expect(result).toEqual(expectedResult[0]);
            dbManager._getMessageData([conversation.lastMessage], function(messageResults) {
              expect(lastMessageResult).toEqual(messageResults[0]);
              done();
            });
          });
        });
      });

      it("Should get the specified channel", function(done) {
        var expectedResult = dbManager._getChannelData([channel]);
        dbManager.writeChannels([channel], function() {
          dbManager.getObject('channels', channel.id, function(result) {
            expect(result).toEqual(expectedResult[0]);
            done();
          });
        });
      });


      it("Should callback with null if not found", function(done) {
        dbManager.getObject('messages', m1.id + "123", function(result) {
          expect(result).toBe(null);
          done();
        });
      });
    });
  });
})();