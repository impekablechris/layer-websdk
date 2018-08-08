/*eslint-disable */
describe("The Conversation Class", function() {
    var appId = "Fred's App";

    var conversation,
        userIdentity1,
        userIdentity2,
        userIdentity3,
        userIdentity4,
        userIdentity5,
        userIdentity6,
        client,
        requests;

    beforeEach(function() {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        client = new layer.Client({
            appId: appId,
            url: "http://localhost:9753"
        });
        client.sessionToken = "sessionToken";

        client.user = new layer.Identity({
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
          sessionOwner: true
        });
        userIdentity1 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/1",
            displayName: "1",
            userId: "1"
        });
        userIdentity2 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/2",
            displayName: "2",
            userId: "2"
        });
        userIdentity3 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/3",
            displayName: "3",
            userId: "3"
        });
        userIdentity4 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/4",
            displayName: "4",
            userId: "4"
        });
        userIdentity5 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/5",
            displayName: "5",
            userId: "5"
        });
        userIdentity6 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/6",
            displayName: "6",
            userId: "6"
        });

        client._clientAuthenticated();
        getObjectsResult = [];
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectsResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        conversation = client._createObject(responses.conversation1);
        jasmine.clock().tick(1);
        requests.reset();
        client.syncManager.queue = [];

    });

    afterEach(function() {
        client.destroy();
        jasmine.Ajax.uninstall();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The constructor() method", function() {
        it("Shoulds setup an empty participants array", function() {
            expect(new layer.Conversation({client: client}).participants).toEqual([client.user]);
        });

        it("Should setup empty metadata", function() {
            expect(new layer.Conversation({client: client}).metadata).toEqual({});
        });

        it("Should default to distinct true", function() {
           expect(new layer.Conversation({client: client}).distinct).toEqual(true);
        });

        it("Should setup the clientId", function() {
            expect(new layer.Conversation({client: client}).clientId).toEqual(client.appId);
        });

        it("Should setup localCreatedAt", function() {
            expect(new layer.Conversation({client: client}).localCreatedAt).toEqual(jasmine.any(Date));
        });

        it("Should setup createdAt", function() {
            expect(new layer.Conversation({client: client}).createdAt).toEqual(jasmine.any(Date));
        });

        it("Should copy in any input participants", function() {
            expect(new layer.Conversation({client: client, participants: [userIdentity1, userIdentity2.userId]}).participants)
                .toEqual([userIdentity1, userIdentity2, client.user]);
        });

        it("Should copy in any metadata", function() {
            expect(new layer.Conversation({client: client, metadata: {a: "b"}}).metadata).toEqual({a: "b"});
        });

        it("Should copy in distinct", function() {
            expect(new layer.Conversation({client: client, distinct: false}).distinct).toEqual(false);
        });

        it("Should call _addConversation", function() {
            // Setup
            spyOn(client, "_addConversation");

            // Run
            var c = new layer.Conversation({
                client: client
            });

            // Posttest
            expect(client._addConversation).toHaveBeenCalledWith(c);
        });

        it("Should copy in the ID if using fromServer", function() {
            expect(new layer.Conversation({
                fromServer: {
                    id: "ccc",
                    participants: [],
                    metadata: {}
                },
                client: client
            }).id).toEqual("ccc");
        });

        it("Should call _populateFromServer if fromServer", function() {
            // Setup
            var tmp = layer.Conversation.prototype._populateFromServer;
            spyOn(layer.Conversation.prototype, "_populateFromServer");

            // Run
            new layer.Conversation({
                fromServer: {
                    id: "ccc",
                    participants: [],
                    metadata: {}
                },
                client: client
            });

            // Posttest
            expect(layer.Conversation.prototype._populateFromServer).toHaveBeenCalledWith({
                id: "ccc",
                participants: [],
                metadata: {}
            });

            // Restore
            layer.Conversation.prototype._populateFromServer = tmp;
        });
    });

    describe("The isSaved() isNew() isSaving() isSynced() methods", function() {

      it("Should correctly handle new conversations", function() {
        conversation.syncState = layer.Constants.SYNC_STATE.NEW;
        expect(conversation.isNew()).toBe(true);
        expect(conversation.isSaving()).toBe(false);
        expect(conversation.isSaved()).toBe(false);
        expect(conversation.isSynced()).toBe(false);
        expect(conversation.toObject().isNew).toBe(true);
        expect(conversation.toObject().isSaving).toBe(false);
        expect(conversation.toObject().isSaved).toBe(false);
        expect(conversation.toObject().isSynced).toBe(false);
      });

      it("Should correctly handle sending conversations", function() {
        conversation.syncState = layer.Constants.SYNC_STATE.SAVING;
        expect(conversation.isNew()).toBe(false);
        expect(conversation.isSaving()).toBe(true);
        expect(conversation.isSaved()).toBe(false);
        expect(conversation.isSynced()).toBe(false);
        expect(conversation.toObject().isNew).toBe(false);
        expect(conversation.toObject().isSaving).toBe(true);
        expect(conversation.toObject().isSaved).toBe(false);
        expect(conversation.toObject().isSynced).toBe(false);
      });

      it("Should correctly handle sent conversations", function() {
        conversation.syncState = layer.Constants.SYNC_STATE.SYNCED;
        expect(conversation.isNew()).toBe(false);
        expect(conversation.isSaving()).toBe(false);
        expect(conversation.isSaved()).toBe(true);
        expect(conversation.isSynced()).toBe(true);
        expect(conversation.toObject().isNew).toBe(false);
        expect(conversation.toObject().isSaving).toBe(false);
        expect(conversation.toObject().isSaved).toBe(true);
        expect(conversation.toObject().isSynced).toBe(true);
      });

      it("Should correctly handle out of sync conversations", function() {
        conversation.syncState = layer.Constants.SYNC_STATE.SYNCING;
        expect(conversation.isNew()).toBe(false);
        expect(conversation.isSaving()).toBe(false);
        expect(conversation.isSaved()).toBe(true);
        expect(conversation.isSynced()).toBe(false);
        expect(conversation.toObject().isNew).toBe(false);
        expect(conversation.toObject().isSaving).toBe(false);
        expect(conversation.toObject().isSaved).toBe(true);
        expect(conversation.toObject().isSynced).toBe(false);
      });
    });


    describe("The destroy() method", function() {

        it("Should clear the lastMessage", function() {
            // Pretest
            var m = conversation.lastMessage;
            expect(m).toEqual(jasmine.any(layer.Message));

            // Run
            conversation.destroy();

            // Posttest
            expect(conversation.lastMessage).toBe(null);
        });

        it("Should call _removeConversation", function() {
            // Setup
            spyOn(client, "_removeConversation");

            // Run
            conversation.destroy();

            // Posttest
            expect(client._removeConversation).toHaveBeenCalledWith(conversation);
        });


        it("Should fire a destroy event", function() {
            // Setup
            spyOn(conversation, "trigger");

            // Run
            conversation.destroy();

            // Posttest
            expect(conversation.trigger).toHaveBeenCalledWith("destroy");
        });
    });

    describe("The send() method", function() {
      var conversation;
      beforeEach(function() {
        conversation = new layer.Conversation({
            participants: [userIdentity1],
            client: client
        });
      });

      it("Should fail without a client property", function() {
        delete conversation.clientId;

        // Run + Posttest
        expect(function() {
            conversation.send();
        }).toThrowError(layer.LayerError.dictionary.clientMissing);
      });

        it("Should update the lastMessage property", function() {
          m = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });

          // Run
          conversation.send(m);

          // Posttest
          expect(conversation.lastMessage).toBe(m);
        });

        it("Should update the lastMessage property even if syncState is not NEW", function() {
          conversation.syncState = layer.Constants.SYNC_STATE.SYNCED;
          m = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });

          // Run
          conversation.send(m);

          // Posttest
          expect(conversation.lastMessage).toBe(m);
        });

        it("Should update the lastMessage position property if prior lastMessage", function() {
          mOld = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });
          mOld.position = 5;
          conversation.lastMessage = mOld;
          m = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });

          // Run
          conversation.send(m);

          // Posttest
          expect(conversation.lastMessage.position > mOld.position).toBe(true);
        });

        it("Should update the lastMessage position property if prior lastMessage AND calling _handleLocalDistinctConversation", function() {
          // Setup
          spyOn(conversation, "_handleLocalDistinctConversation");
          conversation._sendDistinctEvent = true;

          mOld = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });
          mOld.position = 5;
          conversation.lastMessage = mOld;
          m = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });

          // Run
          conversation.send(m);

          // Posttest
          expect(conversation.lastMessage.position > mOld.position).toBe(true);
          expect(conversation._handleLocalDistinctConversation).toHaveBeenCalledWith();
        });


        it("Should update the lastMessage position property incrementally", function() {
          jasmine.clock().uninstall();

          mOld = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });
          mOld.position = 5;
          conversation.lastMessage = mOld;
          m = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });

          m2 = conversation.createMessage({
            parts: [{body: "ho", mimeType: "text/plain"}]
          });

          // Run
          m.presend();
          expect(m.position).toEqual(6);

          m2.presend();
          expect(m2.position).toEqual(7);
        });

        it("Should set the lastMessage position property to 0 if no prior message", function() {
          m = conversation.createMessage({
            parts: [{body: "hey", mimeType: "text/plain"}]
          });

          // Run
          conversation.send(m);

          // Posttest
          expect(conversation.lastMessage.position).toBe(0);
        });



        it("Should do nothing if syncState is not NEW", function() {

            // Setup
            conversation.syncState = layer.Constants.SYNC_STATE.SYNCED;
            spyOn(conversation, "_setSyncing");

            conversation.send();

            expect(conversation._setSyncing).not.toHaveBeenCalled();
        });

        it("Should succeed with 1 participant if it is NOT the current user", function() {
            // Setup
            conversation.participants = [userIdentity1];
            conversation.syncState = layer.Constants.SYNC_STATE.NEW;
            spyOn(client, "sendSocketRequest");

            // Run
            expect(function() {
                conversation.send();
            }).not.toThrow();
        });

        it("Should trigger _handleLocalDistinctConversation and abort", function() {
            // Setup
            conversation._sendDistinctEvent = "Doh!";
            conversation.syncState = layer.Constants.SYNC_STATE.NEW;
            spyOn(conversation, "_handleLocalDistinctConversation");
            spyOn(client, "sendSocketRequest");

            // Run
            conversation.send();

            // Posttest
            expect(conversation._handleLocalDistinctConversation).toHaveBeenCalledWith();
            expect(client.sendSocketRequest).not.toHaveBeenCalled();
        });


        it("Should be chainable", function() {
            // Run
            expect(conversation.send()).toBe(conversation);
        });

        it("Should call _setSyncing", function() {
            // Setup
            spyOn(conversation, "_setSyncing");
            spyOn(client, "sendSocketRequest");
            conversation.syncState = layer.Constants.SYNC_STATE.NEW;

            // Run
            conversation.send();

            // Posttest
            expect(conversation._setSyncing).toHaveBeenCalledWith();
        });

        it("Should call client.sendSocketRequest", function() {
            // Setup
            spyOn(client, "sendSocketRequest");
            conversation.syncState = layer.Constants.SYNC_STATE.NEW;

            // Run
            conversation.send();

            // Posttest
            expect(client.sendSocketRequest).toHaveBeenCalledWith({
                method: 'POST',
                body: {},
                sync: {
                  depends: conversation.id,
                  target: conversation.id
                }
              }, jasmine.any(Function));
        });
    });

    describe("The _getSendData() method", function() {
      it("Should return the current state of the data in a create format", function() {
        var conversation = new layer.Conversation({
          participants: [userIdentity1, client.user],
          client: client,
          metadata: {hey: "ho"}
        });
        expect(conversation._getSendData()).toEqual({
          method: 'Conversation.create',
          data: {
            participants: [userIdentity1.id, client.user.id],
            distinct: true,
            metadata: {hey: "ho"},
            id: conversation.id
          }
        });
      });

      it("Should return null if no metadata", function() {
        var conversation = new layer.Conversation({
          participants: [userIdentity1, client.user],
          client: client
        });
        expect(conversation._getSendData()).toEqual({
          method: 'Conversation.create',
          data: {
            id: conversation.id,
            participants: [userIdentity1.id, client.user.id],
            distinct: true,
            metadata: null
          }
        });
      });
    });

    describe("The markAllMessagesAsRead() method", function() {
        var m1, m2, m3;
        beforeEach(function() {
            m1 = conversation.createMessage("m1").presend();
            m2 = conversation.createMessage("m2").presend();
            m3 = conversation.createMessage("m3").presend();
            m1.syncState = m2.syncState = m3.syncState = layer.Constants.SYNC_STATE.SYNCED;
        });

        it("Should use the input message to send mark all as read to the server", function(){
            expect(conversation.lastMessage).toBe(m3);
            expect(m1.position < m2.position).toBe(true);
            expect(m2.position < m3.position).toBe(true);

            // Run
            conversation.markAllMessagesAsRead(m2);

            // Posttest
            expect(requests.mostRecent().url).toEqual(conversation.url + '/mark_all_read');
            expect(requests.mostRecent().method).toEqual('POST');
            expect(requests.mostRecent().data()).toEqual({position: m2.position});
        });

        it("Should use the last message to send mark all as read to the server", function(){
            // Run
            conversation.markAllMessagesAsRead();

            // Posttest
            expect(requests.mostRecent().url).toEqual(conversation.url + '/mark_all_read');
            expect(requests.mostRecent().method).toEqual('POST');
            expect(requests.mostRecent().data()).toEqual({position: m3.position});
        });

        it("Should use null if no last message ", function() {
            // Setup
            conversation.lastMessage = null;

            // Run
            conversation.markAllMessagesAsRead();

            // Posttest
            expect(requests.mostRecent().url).toEqual(conversation.url + '/mark_all_read');
            expect(requests.mostRecent().method).toEqual('POST');
            expect(requests.mostRecent().data()).toEqual({position: null});
        });

        it("Should use null if last message is unsent", function() {
            // Setup
            conversation.lastMessage.syncState = layer.Constants.SYNC_STATE.SAVING;

            // Run
            conversation.markAllMessagesAsRead();

            // Posttest
            expect(requests.mostRecent().url).toEqual(conversation.url + '/mark_all_read');
            expect(requests.mostRecent().method).toEqual('POST');
            expect(requests.mostRecent().data()).toEqual({position: null});
        });

        it("Should do nothing if conversation is unsaved", function() {
            // Setup
            conversation.syncState = layer.Constants.SYNC_STATE.SAVING;

            // Run
            conversation.markAllMessagesAsRead();

            // Posttest
            expect(requests.mostRecent()).toBe(undefined);
        });
    });

    describe("The _handleLocalDistinctConversation() method", function() {
        it("Should clear the _sendDistinctEvent", function() {
            // Setup
            conversation._sendDistinctEvent = "Doh!";

            // Run
            conversation._handleLocalDistinctConversation();

            // Posttest
            expect(conversation._sendDistinctEvent).toBe(null);
        });

        it("Should trigger a conversations:sent event", function(done) {
            // Setup
            conversation._sendDistinctEvent = "Doh!";
            var called = false;
            conversation.on("conversations:sent", function(evt) {
                called = true;
                expect(evt.data).toEqual("Doh!");
                done();
            });
            jasmine.clock().uninstall();

            // Run
            conversation._handleLocalDistinctConversation();

            // Posttest
            expect(called).toBe(false);
        });
    });

    describe("The _createResult() method", function() {

        it("Calls _createSuccess if successful", function() {
            spyOn(conversation, "_createSuccess");
            conversation._createResult({success: true, data: "Argh!"});
            expect(conversation._createSuccess).toHaveBeenCalledWith("Argh!");
        });

        it("Calls _populateFromServer() if its a conflict error", function() {
            // Setup
            spyOn(conversation, "_populateFromServer");

            // Run
            conversation._createResult({success: false, data: {id: 'conflict', data: 'Doh!'}});

            // Posttest
            expect(conversation._populateFromServer).toHaveBeenCalledWith("Doh!");
        });


        it("Should trigger conversations:sent if its a conflict", function() {
            // Setup
            spyOn(conversation, "_triggerAsync");

            // Run
            conversation._createResult({success: false, data: {
                id: 'conflict',
                data:{
                    id: 'layer:///conversations/frododialog',
                    participants: []
                }
            }});

            // Posttest
            expect(conversation._triggerAsync).toHaveBeenCalledWith("conversations:sent", {
                result: layer.Conversation.FOUND_WITHOUT_REQUESTED_METADATA
            });
            expect(layer.Conversation.FOUND_WITHOUT_REQUESTED_METADATA).toEqual(jasmine.any(String));
        });

        it("Should trigger conversations:sent-error if its an error", function() {
            // Setup
            spyOn(conversation, "trigger");

            // Run
            conversation._createResult({success: false, data: {
                id: 'doh',
                data: 'ray'
            }});

            // Posttest
            expect(conversation.trigger)
                .toHaveBeenCalledWith("conversations:sent-error", {
                error: {
                    id: 'doh',
                    data: 'ray'
                }
            });
        });
    });

    describe("The _createSuccess() method", function() {
        it("Calls _populateFromServer() ", function() {
            // Setup
            spyOn(conversation, "_populateFromServer");

            // Run
            conversation._createSuccess({id: "layer:///messages/fred"});

            // Posttest
            expect(conversation._populateFromServer).toHaveBeenCalledWith({id: "layer:///messages/fred"});
        });

        it("Should trigger conversations:sent Conversations.CREATED if non distinct", function() {
            // Setup
            spyOn(conversation, "_triggerAsync");
            conversation.distinct = false;
            var conv1 = JSON.parse(JSON.stringify(responses.conversation1));
            conv1.distinct = false;

            // Run
            conversation._createSuccess(conv1);

            // Posttest
            expect(conversation._triggerAsync)
                .toHaveBeenCalledWith("conversations:sent", {result: layer.Conversation.CREATED});
            expect(layer.Conversation.CREATED).toEqual(jasmine.any(String));
        });

        it("Should trigger conversations:sent Conversations.CREATED if distinct/not found", function() {
            // Setup
            spyOn(conversation, "_triggerAsync");
            conversation.distinct = true;
            client._models.conversations = {};
            var conv1 = JSON.parse(JSON.stringify(responses.conversation1));
            conv1.last_message = null;
            conversation.lastMessage = null

            // Run
            conversation._createSuccess(conv1);

            // Posttest
            expect(conversation._triggerAsync)
                .toHaveBeenCalledWith("conversations:sent", {result: layer.Conversation.CREATED});
            expect(layer.Conversation.CREATED).toEqual(jasmine.any(String));
        });

        it("Should trigger conversations:sent Conversations.FOUND if distinct/found", function() {
            // Setup
            spyOn(conversation, "_triggerAsync");
            conversation.distinct = true;


            // Run
            conversation._createSuccess({
                id: "layer:///conversations/fred",
                participants: [userIdentity1],
                distinct: true,
                last_message: {
                    id: "layer:///messages/joe",
                    sender: {
                        user_id: "joe",
                        id: "layer:///identities/joe"
                    },
                    parts: [{mime_type: "text/plain", body: "hey"}],
                    conversation: {
                        id: "layer:///conversations/fred"
                    }
                }
            });

            // Posttest
            expect(conversation._triggerAsync)
                .toHaveBeenCalledWith("conversations:sent", {result: layer.Conversation.FOUND});
            expect(layer.Conversation.FOUND).toEqual(jasmine.any(String));
        });
    });

    describe("The _populateFromServer() method", function() {
        var conversation, c;
        beforeEach(function() {
            c = JSON.parse(JSON.stringify(responses.conversation1));
            conversation = new layer.Conversation({client: client});
            jasmine.clock().tick(1);
        });

        it("Should copy in all conversation properties", function() {
            // Run
            c.last_message = null;
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation.id).toEqual(c.id);
            expect(conversation.url).toEqual(c.url);
            expect(conversation.unreadCount).toEqual(c.unread_message_count);
            expect(conversation.distinct).toEqual(c.distinct);
            expect(conversation.metadata).toEqual(c.metadata);
            expect(conversation.createdAt).toEqual(new Date(c.created_at));
            expect(conversation.lastMessage).toEqual(null);
        });

        it("Should trigger change events if not new", function() {
            // Setup
            conversation.syncState = layer.Constants.SYNC_STATE.SYNCED;
            spyOn(conversation, "_triggerAsync");

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation._triggerAsync).toHaveBeenCalledWith("conversations:change", jasmine.any(Object));
        });

        it("Should trigger ID change events", function() {
            // Setup
            spyOn(conversation, "_triggerAsync");
            var initialId = conversation.id;

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation._triggerAsync)
                .toHaveBeenCalledWith('conversations:change', {
                    oldValue: initialId,
                    newValue: conversation.id,
                    property: 'id',
                });
        });

        it("Should setup lastMessage", function() {
            // Setup
            client._models.messages = {};

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(client._models.messages[conversation.lastMessage.id]).toEqual(jasmine.any(layer.Message));
            expect(conversation.lastMessage).toEqual(jasmine.any(layer.Message));
            expect(conversation.lastMessage.parts[0].body).toEqual(c.last_message.parts[0].body);
        });

        it("Should keep lastMessage even if the server doesnt yet recognize it", function() {
            // Setup
            client._messagesHash = {};
            var message = new layer.Message({
                client: client
            });
            conversation.lastMessage = message;
            c.last_message = null;

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation.lastMessage).toBe(message);
        });

        it("Should setup lastMessage from string", function() {
            // Setup
            var mid = c.last_message.id;
            client._models.messages = {};
            client._createObject(c.last_message);
            c.last_message = mid;

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation.lastMessage).toEqual(jasmine.any(layer.Message));
            expect(conversation.lastMessage).toBe(client._models.messages[mid]);
        });

        it("Should call client._addConversation", function() {
            // Setup
            spyOn(client, "_addConversation");

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(client._addConversation).toHaveBeenCalledWith(conversation);
        });

        it("Should set isCurrentParticipant to false", function() {
            // Setup
            c.participants = [userIdentity1, userIdentity2];

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation.isCurrentParticipant).toBe(false);
        });

        it("Should set isCurrentParticipant to true", function() {
            // Setup
            c.participants = [userIdentity1, client.user];

            // Run
            conversation._populateFromServer(c);

            // Posttest
            expect(conversation.isCurrentParticipant).toBe(true);
        });

        it("Should wire up all participants to _handleParticipantChangeEvent", function() {
            // Setup
            c.participants = [userIdentity1, client.user];
            conversation._populateFromServer(c);
            spyOn(conversation, "_triggerAsync");
            spyOn(userIdentity1, "_triggerAsync").and.callFake(function(name, args) {
                userIdentity1.trigger(name, args);
            });

            // Run
            userIdentity1._updateValue(['displayName'], 'Fred');

            // Posttest
            expect(conversation._triggerAsync).toHaveBeenCalledWith('conversations:change', {
                property: 'participants.displayName',
                identity: userIdentity1,
                oldValue: "1",
                newValue: "Fred",
            });
        });
    });


    describe("The addParticipants() method", function() {
        it("Should call _patchParticipants with only new participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];
            spyOn(conversation, "_patchParticipants");

            // Run
            conversation.addParticipants([userIdentity1, client.user, userIdentity4]);

            // Posttest
            expect(conversation._patchParticipants).toHaveBeenCalledWith({
                add: [client.user, userIdentity4], remove: []
            });
        });

        it("Should immediately modify the participants with userIds", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            conversation.addParticipants([userIdentity1.userId, userIdentity1.userId, client.user.userId, userIdentity4.userId]);

            // Posttest
            expect(conversation.participants).toEqual([userIdentity1, userIdentity2, userIdentity3, client.user, userIdentity4]);
        });

        it("Should immediately modify the participants with identities", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            conversation.addParticipants([userIdentity1, client.user, userIdentity4]);

            // Posttest
            expect(conversation.participants).toEqual([userIdentity1, userIdentity2, userIdentity3, client.user, userIdentity4]);
        });
    });

    describe("The removeParticipants method", function() {

        it("Should call _patchParticipants with existing removed participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];
            spyOn(conversation, "_patchParticipants");

            // Run
            conversation.removeParticipants([userIdentity2, userIdentity3, userIdentity4]);

            // Posttest
            expect(conversation._patchParticipants).toHaveBeenCalledWith({
                add: [], remove: [userIdentity2, userIdentity3]
            });
        });

        it("Should immediately modify the participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            conversation.removeParticipants([userIdentity2, userIdentity3, userIdentity4]);

            // Posttest
            expect(conversation.participants).toEqual([userIdentity1]);
        });

        it("Should immediately modify the participants with Identities", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            conversation.removeParticipants([userIdentity2, userIdentity3, userIdentity4]);

            // Posttest
            expect(conversation.participants).toEqual([userIdentity1]);
        });


        it("Should throw error if removing ALL participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            expect(function() {
                conversation.removeParticipants([userIdentity1, userIdentity2, userIdentity3]);
            }).toThrowError(layer.LayerError.dictionary.moreParticipantsRequired);
            expect(layer.LayerError.dictionary.moreParticipantsRequired).toEqual(jasmine.any(String));
        });

        it("Should return this", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            expect(conversation.removeParticipants([userIdentity1])).toBe(conversation);
            expect(conversation.removeParticipants([])).toBe(conversation);
            expect(conversation.removeParticipants(["not present"])).toBe(conversation);
        });
    });

    describe("The replaceParticipants() method", function() {
        it("Should throw error if removing ALL participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            expect(function() {
                conversation.replaceParticipants([]);
            }).toThrowError(layer.LayerError.dictionary.moreParticipantsRequired);
            expect(layer.LayerError.dictionary.moreParticipantsRequired).toEqual(jasmine.any(String));
        });

        it("Should call _patchParticipants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];
            spyOn(conversation, "_patchParticipants");

            // Run
            conversation.replaceParticipants([userIdentity2.userId, userIdentity3.userId, userIdentity4.userId]);

            // Posttest
            expect(conversation._patchParticipants).toHaveBeenCalledWith({
                add: [userIdentity4], remove: [userIdentity1]
            });
        });

        it("Should immediately modify the participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            conversation.replaceParticipants([userIdentity2.userId, userIdentity3.userId, userIdentity4.userId]);

            // Posttest
            expect(conversation.participants).toEqual([userIdentity2, userIdentity3, userIdentity4]);
        });

        it("Should immediately modify the participants by Identity", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, userIdentity3];

            // Run
            conversation.replaceParticipants([userIdentity2, userIdentity3, userIdentity4]);

            // Posttest
            expect(conversation.participants).toEqual([userIdentity2, userIdentity3, userIdentity4]);
        });
    });

    describe("The _patchParticipants() method", function() {
        it("Should send a message to the server", function() {
            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation._patchParticipants({
                add: [userIdentity1], remove: [userIdentity2, userIdentity3]
            });

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                headers: {
                    'content-type': 'application/vnd.layer-patch+json',
                },
                data: JSON.stringify([
                    {operation: "remove", property: "participants", id: userIdentity2.id},
                    {operation: "remove", property: "participants", id: userIdentity3.id},
                    {operation: "add", property: "participants", id: userIdentity1.id}
                ])
            }, jasmine.any(Function));
        });

        it("Should call _applyParticipantChange", function() {
             // Setup
            spyOn(conversation, "_applyParticipantChange");

            // Run
            conversation._patchParticipants({
                add: ["y", "z"], remove: ["b","c"]
            });

            // Posttest
            expect(conversation._applyParticipantChange).toHaveBeenCalledWith({
                add: ["y", "z"], remove: ["b","c"]
            });
        });

        it("Should set isCurrentParticipant", function() {
            // Setup
            conversation.isCurrentParticipant = false;

            conversation._patchParticipants({
                add: [userIdentity1, userIdentity2, client.user], remove: [userIdentity3, userIdentity4]
            });

            expect(conversation.isCurrentParticipant).toBe(true);
        });

        it("Should clear isCurrentParticipant", function() {
            // Setup
            conversation.isCurrentParticipant = true;

            conversation._patchParticipants({
                add: [userIdentity1, userIdentity2], remove: [userIdentity3, userIdentity4, client.user]
            });

            expect(conversation.isCurrentParticipant).toBe(false);
        });

        it("Should reload the Conversation on error", function() {
          spyOn(conversation, "_load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({
                success: false,
                data: {id: "frodo"}
            });
          });

          // Run
          conversation._patchParticipants({
              add: [userIdentity1, userIdentity2], remove: [userIdentity3, userIdentity4, client.user]
          });

          // Posttest
          expect(conversation._load).toHaveBeenCalledWith();
        });

        it("Should not reload the Conversation on success", function() {
          spyOn(conversation, "_load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({success: true});
          });

          // Run
          conversation._patchParticipants({
              add: [userIdentity1, userIdentity2], remove: [userIdentity3, userIdentity4, client.user]
          });

          // Posttest
          expect(conversation._load).not.toHaveBeenCalled();
        });
    });

    describe("The _applyParticipantChange() method", function() {
        it("Should add/remove participants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, client.user];

            // Run
            conversation._applyParticipantChange({
                add: [userIdentity1, userIdentity3, userIdentity4],
                remove: [userIdentity2, userIdentity5, userIdentity6]
            });

            // Posttest
            expect(conversation.participants).toEqual(jasmine.arrayContaining([userIdentity1, client.user, userIdentity3, userIdentity4]));
        });

        it("Should call __updateParticipants", function() {
            // Setup
            conversation.participants = [userIdentity1, userIdentity2, client.user];
            spyOn(conversation, "__updateParticipants");

            // Run
            conversation._applyParticipantChange({
                add: [userIdentity1, userIdentity3, userIdentity4],
                remove: [userIdentity2, userIdentity5, userIdentity6]
            });

            // Posttest
            expect(conversation.__updateParticipants).toHaveBeenCalledWith([userIdentity1, client.user, userIdentity3, userIdentity4], [userIdentity1, userIdentity2, client.user]);
        });

        it("Should survive an integration test", function() {
            conversation.participants = [userIdentity1, userIdentity2];
            client.socketChangeManager._handlePatch({
                operation: "patch",
                object: {
                    id: conversation.id,
                    type: "Conversation"
                },
                data: [
                    {operation: "add", property: "participants", id: "layer:///identities/jane", value: {id: "layer:///identities/jane", user_id: "jane", url: "http://doh.com/identities/jane", display_name: "Jane"}},
                    {operation: "add", property: "participants", id: "layer:///identities/3", value: {id: "layer:///identities/d", user_id: "d", url: "http://doh.com/identities/d", display_name: "The new 3"}},
                    {operation: "add", property: "participants", id: "layer:///identities/4"},
                    {operation: "remove", property: "participants", id: "layer:///identities/2"}
                ]
            });

            // Posttest
            expect(conversation.participants[1]).toBe(client.getIdentity("jane"));
            expect(conversation.participants).toEqual([userIdentity1, client.getIdentity("jane"), userIdentity3, userIdentity4]);
            //expect(client.getIdentity("3").displayName).toEqual("The new 3"); this is not expected to update at this time.
        });
    });

    describe("The __updateParticipants() method", function() {
        it("Should trigger conversations:change event", function() {
            spyOn(conversation, "_triggerAsync");
            conversation.__updateParticipants([userIdentity1, userIdentity2], [userIdentity2, userIdentity3, userIdentity4]);
            expect(conversation._triggerAsync).toHaveBeenCalledWith('conversations:change', {
                property: 'participants',
                oldValue: [userIdentity2, userIdentity3, userIdentity4],
                newValue: [userIdentity1, userIdentity2],
                add: [userIdentity1],
                remove: [userIdentity3, userIdentity4]
            });
        });

        it("Should wire up _handleParticipantChangeEvent", function() {
            spyOn(conversation, '_handleParticipantChangeEvent');
            conversation.__updateParticipants([userIdentity1, userIdentity2], [userIdentity2, userIdentity3, userIdentity4]);
            userIdentity1.trigger('identities:change', {property: 'displayName', oldValue: 'fred', newValue: 'freddy'});

            expect(conversation._handleParticipantChangeEvent.calls.argsFor(0)[0].changes).toEqual([{
                property: 'displayName',
                oldValue: 'fred',
                newValue: 'freddy'
            }]);
            expect(conversation._handleParticipantChangeEvent.calls.argsFor(0)[0].eventName).toEqual('identities:change');
            expect(conversation._handleParticipantChangeEvent.calls.argsFor(0)[0].target).toBe(userIdentity1);
        });

        it("Should unwire _handleParticipantChangeEvent", function() {
            spyOn(conversation, '_handleParticipantChangeEvent');
            conversation.__updateParticipants([userIdentity1, userIdentity2], [userIdentity2, userIdentity3, userIdentity4]);
            conversation.__updateParticipants([client.user], [userIdentity1, userIdentity2]);
            userIdentity2.trigger('identities:change', {property: 'displayName', oldValue: 'fred', newValue: 'freddy'});
            expect(conversation._handleParticipantChangeEvent).not.toHaveBeenCalled();
        });
    });

    describe("The _handleParticipantChangeEvent() method", function() {
        it("Should trigger conversations:change event", function() {
            spyOn(conversation, '_triggerAsync');
            conversation._handleParticipantChangeEvent({
                changes: [
                    {property: 'displayName', oldValue: 'fred', newValue: 'freddy'},
                    {property: 'firstName', oldValue: 'fred1', newValue: 'freddy1'},
                ],
                target: userIdentity1
            });
            expect(conversation._triggerAsync).toHaveBeenCalledWith('conversations:change', {
                property: 'participants.displayName',
                oldValue: 'fred',
                newValue: 'freddy',
                identity: userIdentity1
            });
            expect(conversation._triggerAsync).toHaveBeenCalledWith('conversations:change', {
                property: 'participants.firstName',
                oldValue: 'fred1',
                newValue: 'freddy1',
                identity: userIdentity1
            });
        });
    });

    describe("The leave() method", function() {
      it("Should fail if already deleted", function() {
        conversation.isDestroyed = true;
        expect(function() {
          conversation.leave();
        }).toThrowError(layer.LayerError.dictionary.isDestroyed);
      });
      it("Should call _delete", function() {
        spyOn(conversation, "_delete");
        conversation.leave();
        expect(conversation._delete).toHaveBeenCalledWith("mode=my_devices&leave=true");
      });
    });

    describe("The delete() method", function() {
      it("Should fail if already deleted", function() {
        conversation.isDestroyed = true;
        expect(function() {
          conversation.delete(layer.Constants.DELETION_MODE.ALL);
        }).toThrowError(layer.LayerError.dictionary.isDestroyed);
      });

      it("Should fail if invalid deletion mode", function() {
        expect(function() {
          conversation.delete(false);
        }).toThrowError(layer.LayerError.dictionary.deletionModeUnsupported);
      });

      it("Should handle deletion mode true for backwards compatability", function() {
        spyOn(conversation, "_delete");
        conversation.delete(true);
        expect(conversation._delete).toHaveBeenCalledWith('mode=all_participants');
      });

      it("Should handle deletion mode ALL", function() {
        spyOn(conversation, "_delete");
        conversation.delete(layer.Constants.DELETION_MODE.ALL);
        expect(conversation._delete).toHaveBeenCalledWith('mode=all_participants');
      });

      it("Should handle deletion mode MY_DEVICE", function() {
        spyOn(conversation, "_delete");
        conversation.delete(layer.Constants.DELETION_MODE.MY_DEVICES);
        expect(conversation._delete).toHaveBeenCalledWith('mode=my_devices&leave=false');
      });
    });

    describe("The _delete() method", function() {
        it("Should call _deleted", function() {
            // Setup
            spyOn(conversation, "_deleted");

            // Run
            conversation._delete('mode=hey&leave=ho');

            // Posttest
            expect(conversation._deleted).toHaveBeenCalledWith();
        });

        it("Should destroy the conversation", function() {
            // Setup
            spyOn(conversation, "destroy");

            // Run
            conversation._delete('mode=hey&leave=ho');

            // Posttest
            expect(conversation.destroy).toHaveBeenCalled();
        });


        it("Should call the server", function() {
            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation._delete('mode=hey&leave=ho');

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "?mode=hey&leave=ho",
                method: "DELETE"
            }, jasmine.any(Function));
        });

        it("Should load a new copy if deletion fails without not_found", function() {
          var tmp = layer.Conversation.load;
          spyOn(layer.Conversation, "load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({success: false});
          });

          // Run
          conversation._delete('mode=hey&leave=ho');

          // Posttest
          expect(conversation.isDestroyed).toBe(true);
          expect(layer.Conversation.load).toHaveBeenCalledWith(conversation.id, client);

          // Cleanup
          layer.Conversation.load = tmp;
        })

        it("Should not load a new copy if deletion fails with not_found", function() {
          var tmp = layer.Conversation.load;
          spyOn(layer.Conversation, "load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({success: false, data: {id: 'not_found'}});
          });

          // Run
          conversation._delete('mode=hey&leave=ho');

          // Posttest
          expect(conversation.isDestroyed).toBe(true);
          expect(layer.Conversation.load).not.toHaveBeenCalled();

          // Cleanup
          layer.Conversation.load = tmp;
        })
    });

    describe("The _deleted() method", function() {
        it("Should trigger conversations:delete", function() {
            spyOn(conversation, "trigger");
            conversation._deleted();
            expect(conversation.trigger).toHaveBeenCalledWith("conversations:delete");
        });
    });

    describe("The _handleWebsocketDelete() method", function() {

        it("Should destroy the conversation if from_position has no value", function() {
          // Run
          var m = conversation.createMessage("hey").send();
          m.position = 6;
          spyOn(conversation, "trigger");
          conversation._handleWebsocketDelete({
            mode: 'my_devices',
            from_position: null
          });

          // Posttest
          expect(conversation.isDestroyed).toBe(true);
          expect(m.isDestroyed).toBe(true);
          expect(conversation.trigger).toHaveBeenCalledWith("conversations:delete");
        });

        it("Should destroy the conversation if mode is all_participants", function() {
          // Run
          var m = conversation.createMessage("hey").send();
          m.position = 6;
          spyOn(conversation, "trigger");
          conversation._handleWebsocketDelete({
            mode: 'all_participants'
          });

          // Posttest
          expect(conversation.isDestroyed).toBe(true);
          expect(m.isDestroyed).toBe(true);
          expect(conversation.trigger).toHaveBeenCalledWith("conversations:delete");
        });

        it("Should not destroy the object if from_position has a lesser value", function() {
          var m = conversation.createMessage("hey").send();
          m.position = 6;

          // Run
          conversation._handleWebsocketDelete({
            mode: 'my_devices',
            from_position: 5
          });

          // Posttest
          expect(m.isDestroyed).toBe(false);
          expect(conversation.isDestroyed).toBe(false);
        });

        it("Should destroy the object if from_position has a greater value", function() {
          var m = conversation.createMessage("hey").send();
          m.position = 4;

          // Run
          conversation._handleWebsocketDelete({
            mode: 'my_devices',
            from_position: 5
          });

          // Posttest
          expect(m.isDestroyed).toBe(true);
          expect(conversation.isDestroyed).toBe(false);
        });

        it("Should call client._purgeMessagesByPosition if from_position has a value", function() {
          spyOn(client, "_purgeMessagesByPosition");

          // Run
          conversation._handleWebsocketDelete({
            mode: 'my_devices',
            from_position: 5
          });

          // Posttest
          expect(client._purgeMessagesByPosition).toHaveBeenCalledWith(conversation.id, 5);
        });

        it("Should not call client._purgeMessagesByPosition if from_position lacks a value", function() {
          spyOn(client, "_purgeMessagesByPosition");

          // Run
          conversation._handleWebsocketDelete({
            mode: 'my_devices',
            from_position: null
          });

          // Posttest
          expect(client._purgeMessagesByPosition).not.toHaveBeenCalled();
        });
    });

    describe("The createMessage() method", function() {
        it("Should return a new message with the provided parameters", function() {

            // Run
            var m = conversation.createMessage({
                parts: [new layer.MessagePart({body: "Hey"})]
            });

            // Posttest
            expect(m).toEqual(jasmine.any(layer.Message));
            expect(m.parts.length).toEqual(1);
            expect(m.parts[0].body).toEqual("Hey");
        });

        it("Should have its conversationId property set", function() {
            expect(conversation.createMessage("hi").conversationId).toBe(conversation.id);
        });

        it("Should have its clientId property set", function() {
            expect(conversation.createMessage("hi").clientId).toBe(client.appId);
        });
    });

    describe("The _handlePatchEvent method", function() {
        it("Should call __updateMetadata", function() {
            spyOn(conversation, "__updateMetadata");
            conversation._handlePatchEvent({a: "b"}, {c: "d"}, ["metadata.a", "metadata.b"]);
            expect(conversation.__updateMetadata).toHaveBeenCalledWith({a: "b"}, {c: "d"}, ["metadata.a", "metadata.b"]);
        });

        it("Should call __updateParticipants", function() {
            spyOn(conversation, "__updateParticipants");
            conversation._handlePatchEvent([userIdentity1.toObject(), userIdentity2.toObject(), client.user.toObject()], [userIdentity3, userIdentity4, client.user], ["participants"]);
            expect(conversation.__updateParticipants).toHaveBeenCalledWith([userIdentity1, userIdentity2, client.user], [userIdentity3, userIdentity4, client.user]);
        });
    });

    describe("The _getParticipantChange() method tested via replaceParticipants()", function() {

    });

    describe("The setMetadataProperties() method", function() {
        var conversation;
        beforeEach(function() {
            conversation = client.createConversation({
                participants: ["a"],
                metadata: {hey: "ho"}
            });
        });
        afterEach(function() {
            conversation.destroy();
        });
        it("Should trigger an event", function() {
            // Setup
            spyOn(conversation, "_xhr"); // disable xhr calls and events it will trigger
            spyOn(conversation, "_triggerAsync");

            // Run
            conversation.setMetadataProperties({
                "a.b.c": "fred",
                "a.d": "wilma"
            });
            jasmine.clock().tick(1);

            // Posttest
            expect(conversation._triggerAsync)
            .toHaveBeenCalledWith("conversations:change", jasmine.objectContaining({
                oldValue: {hey: "ho"},
                newValue: {hey: "ho", a: {b: {c: "fred"}, d: "wilma"}},
                property: "metadata",
                paths: ["metadata.a.b.c", "metadata.a.d"]
            }));
        });


        it("Should call the server with layer+patch data", function() {

            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation.setMetadataProperties({"a.b.c": "fred", "a.d": "wilma"});

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                headers: {
                    'content-type': 'application/vnd.layer-patch+json'
                },
                data: JSON.stringify([
                    {operation: "set", property: "metadata.a.b.c", value: "fred"},
                    {operation: "set", property: "metadata.a.d", value: "wilma"}
                ])
            }, jasmine.any(Function));
        });

        it("Should ignore empty string keys", function() {
            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation.setMetadataProperties({"a.b.c": "fred", "a.d": "wilma", "": "frodo"});

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                headers: {
                    'content-type': 'application/vnd.layer-patch+json'
                },
                data: JSON.stringify([
                    {operation: "set", property: "metadata.a.b.c", value: "fred"},
                    {operation: "set", property: "metadata.a.d", value: "wilma"}
                ])
            }, jasmine.any(Function));
        });

        it("Should accept metadata prefixed keys", function() {
            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation.setMetadataProperties({"metadata.a.b.c": "fred", "metadata.a.d": "wilma"});

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                headers: {
                    'content-type': 'application/vnd.layer-patch+json'
                },
                data: JSON.stringify([
                    {operation: "set", property: "metadata.a.b.c", value: "fred"},
                    {operation: "set", property: "metadata.a.d", value: "wilma"}
                ])
            }, jasmine.any(Function));
        });

        it("Should call layerParse", function() {
            // Setup
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            // Run
            conversation.setMetadataProperties({"a.b.c": "fred", "a.d": "wilma"});

            // Posttest
            expect(layer.Util.layerParse).toHaveBeenCalledWith({
                object: conversation,
                type: "Conversation",
                operations: [
                    {operation: "set", property: "metadata.a.b.c", value: "fred"},
                    {operation: "set", property: "metadata.a.d", value: "wilma"}
                ],
                client: client
            });

            // Cleanup
            layer.Util.layerParse = tmp;
        });

        it("Should reload the Conversation on error", function() {
          spyOn(conversation, "_load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({
                success: false,
                data: {id: "frodo"}
            });
          });

          // Run
          conversation.setMetadataProperties({"a.b.c": "fred", "a.d": "wilma"});

          // Posttest
          expect(conversation._load).toHaveBeenCalledWith();
        });

        it("Should not reload the Conversation on success", function() {
          spyOn(conversation, "_load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({success: true});
          });

          // Run
          conversation.setMetadataProperties({"a.b.c": "fred", "a.d": "wilma"});

          // Posttest
          expect(conversation._load).not.toHaveBeenCalled();
        });
    });


    describe("The deleteMetadataProperties() method", function() {
        var conversation;
        beforeEach(function() {
            conversation = client.createConversation({
                participants: ["a"],
                metadata: {a: {b: {c: "fred"}}, ho: "hum"}
            });
        });
        afterEach(function() {
            conversation.destroy();
        });
        it("Should trigger change", function() {
            // Setup
            spyOn(conversation, "_xhr"); // disable xhr calls and events it will trigger
            spyOn(conversation, "_triggerAsync");

            // Run
            conversation.deleteMetadataProperties(["a.b.c"]);

            // Posttest
            expect(conversation._triggerAsync)
            .toHaveBeenCalledWith("conversations:change", {
                oldValue: {ho: "hum", a: {b: {c: "fred"}}},
                newValue: {ho: "hum", a: {b: {}}},
                property: "metadata",
                paths: ["metadata.a.b.c"]
            });
        });


        it("Should call the server with layer+patch data", function() {

            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation.deleteMetadataProperties(["a.b.c"]);

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                headers: {
                    'content-type': 'application/vnd.layer-patch+json'
                },
                data: JSON.stringify([
                    {operation: "delete", property: "metadata.a.b.c"}
                ])
            }, jasmine.any(Function));
        });

        it("Should handle metadata prefixed properties", function() {
            // Setup
            spyOn(conversation, "_xhr");

            // Run
            conversation.deleteMetadataProperties(["metadata.a.b.c"]);

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                headers: {
                    'content-type': 'application/vnd.layer-patch+json'
                },
                data: JSON.stringify([
                    {operation: "delete", property: "metadata.a.b.c"}
                ])
            }, jasmine.any(Function));

        });

        it("Should call layerParse", function() {
            // Setup
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            // Run
            conversation.deleteMetadataProperties(["a.b.c"]);

            // Posttest
            expect(layer.Util.layerParse).toHaveBeenCalledWith({
                object: conversation,
                type: "Conversation",
                operations: [
                    {operation: "delete", property: "metadata.a.b.c"}
                ],
                client: client
            });

            // Cleanup
            layer.Util.layerParse = tmp;
        });

        it("Should reload the Conversation on error", function() {
          spyOn(conversation, "_load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({
                success: false,
                data: {id: "frodo"}
            });
          });

          // Run
          conversation.deleteMetadataProperties(["a.b.c"]);

          // Posttest
          expect(conversation._load).toHaveBeenCalledWith();
        });

        it("Should not reload the Conversation on success", function() {
          spyOn(conversation, "_load");
          spyOn(conversation, "_xhr").and.callFake(function(args, callback) {
            callback({success: true});
          });

          // Run
          conversation.deleteMetadataProperties(["a.b.c"]);

          // Posttest
          expect(conversation._load).not.toHaveBeenCalled();
        });
    });

    describe("The __updateMetadata() method", function() {
        it("Should call the server with layer+patch data", function() {
            spyOn(conversation, "_xhr");

            // Run
            conversation.setMetadataProperties({
                ho: "hum"
            });

            // Posttest
            expect(conversation._xhr).toHaveBeenCalledWith({
                url: "",
                method: "PATCH",
                data: JSON.stringify([
                    {operation: "set", property: "metadata.ho", value: "hum"}
                ]),
                headers: {
                    "content-type": "application/vnd.layer-patch+json"
                }
            }, jasmine.any(Function));
        });
    });

    describe("The __updateUnreadCount() method", function() {
        it("Should not let value drop below 0", function() {
          conversation.unreadCount = -50;
          expect(conversation.unreadCount).toEqual(0);
        });

        it("Should not trigger events if forced to not change", function() {
          conversation.unreadCount = 0;
          spyOn(conversation, "_updateUnreadCountEvent");
          conversation.unreadCount = -50;
          expect(conversation._updateUnreadCountEvent).not.toHaveBeenCalled();
        })

        it("Should  trigger events if changed", function() {
          conversation.unreadCount = 1;
          spyOn(conversation, "_updateUnreadCountEvent");
          conversation.unreadCount = 0;
          expect(conversation._updateUnreadCountEvent).toHaveBeenCalled();
        });

        it("Should delay events for 1 second if getting changes from layer-patch websocket events", function() {
          conversation._inLayerParser = true;
          spyOn(conversation, "_updateUnreadCountEvent");
          conversation.unreadCount = 100;
          expect(conversation._updateUnreadCountEvent).not.toHaveBeenCalled();
          jasmine.clock().tick(1001);
          expect(conversation._updateUnreadCountEvent).toHaveBeenCalled();
        });

        it("Should only trigger one event while processing websocket events", function() {
          conversation._inLayerParser = true;
          spyOn(conversation, "_updateUnreadCountEvent");
          conversation.unreadCount = 100;
          jasmine.clock().tick(10);
          conversation.unreadCount = 80;
          jasmine.clock().tick(10);
          conversation.unreadCount = 60;
          expect(conversation._updateUnreadCountEvent).not.toHaveBeenCalled();
          jasmine.clock().tick(1001);
          expect(conversation._updateUnreadCountEvent.calls.count()).toEqual(1);
        });
    });

    describe("The _updateUnreadCountEvent() method", function() {
      it("Should trigger a change event if there is a change", function() {
        conversation._oldUnreadCount = 5;
        conversation.__unreadCount = 10;
        spyOn(conversation, "_triggerAsync");
        conversation._updateUnreadCountEvent();
        expect(conversation._triggerAsync).toHaveBeenCalledWith('conversations:change', {
          newValue: 10,
          oldValue: 5,
          property: 'unreadCount'
        });
      });

      it("Should not trigger a change event if there is no change", function() {
        conversation._oldUnreadCount = 5;
        conversation.__unreadCount = 5;
        spyOn(conversation, "_triggerAsync");
        conversation._updateUnreadCountEvent();
        expect(conversation._triggerAsync).not.toHaveBeenCalled();
      });

      it("Should do nothing if isDestroyed", function() {
        conversation._oldUnreadCount = 5;
        conversation.__unreadCount = 10;
        conversation.isDestroyed = true;
        spyOn(conversation, "_triggerAsync");
        conversation._updateUnreadCountEvent();
        expect(conversation._triggerAsync).not.toHaveBeenCalled();
      });
    });

    describe("The __updateLastMessage() method", function() {
      it("Should trigger an event if Message ID changes", function() {
        spyOn(conversation, "_triggerAsync");
        conversation.__updateLastMessage({id: "1"}, {id: "2"});
        expect(conversation._triggerAsync).toHaveBeenCalledWith("conversations:change", {
          property: "lastMessage",
          newValue: {id: "1"},
          oldValue: {id: "2"}
        });
      });

      it("Should not trigger an event if Message ID did not change", function() {
        spyOn(conversation, "_triggerAsync");
        conversation.__updateLastMessage({id: "1"}, {id: "1"});
        expect(conversation._triggerAsync).not.toHaveBeenCalled();
      });
    });



    describe("The xhr() method", function() {

        it("Should throw an error if destroyed", function() {
            // Setup
            conversation.destroy();

            // Run
            expect(function() {
                conversation._xhr({});
            }).toThrowError(layer.LayerError.dictionary.isDestroyed);
            expect(layer.LayerError.dictionary.isDestroyed).toEqual(jasmine.any(String));
        });

        it("Should throw an error if the conversation does not have a client", function() {
            // Setup
            delete conversation.clientId;

            // Run
            expect(function() {
                conversation._xhr({});
            }).toThrowError(layer.LayerError.dictionary.clientMissing);
            expect(layer.LayerError.dictionary.clientMissing).toEqual(jasmine.any(String));

            // Recovery
            conversation.clientId = client.appId;
        });

        it("Should load the resource if no url or method", function() {
            conversation._xhr({});
            expect(requests.mostRecent().url).toEqual(conversation.url);
            expect(requests.mostRecent().method).toEqual('GET');
        });

        it("Should do nothing if its NEW and not a POST request on a NEW Conversation", function() {
            // Setup
            conversation.syncState = layer.Constants.SYNC_STATE.NEW;
            spyOn(client, "xhr");

            // Run
            conversation._xhr({
                url: "",
                method: "PATCH"
            });

            // Posttest
            expect(client.xhr).not.toHaveBeenCalled();
        });

        it("Should call _setSyncing if its not a GET request", function() {
            // Setup
            spyOn(conversation, "_setSyncing");

            // Run
            conversation._xhr({
                url: "",
                method: "POST"
            });

            // Posttest
            expect(conversation._setSyncing).toHaveBeenCalledWith();
        });

        it("Should call client.xhr with function relative url if sync", function() {
            // Setup
            spyOn(client, "xhr");
            conversation.url = "hey";

            // Run
            conversation._xhr({
                url: "/ho",
                method: "POST"
            });

            // Posttest
            expect(client.xhr).toHaveBeenCalledWith(jasmine.objectContaining({
                url: conversation.url + "/ho",
                sync: {
                    target: conversation.id
                },
                method: "POST"
            }), jasmine.any(Function));
        });

        it("Should call client.xhr with function full url if no sync", function() {
            // Setup
            spyOn(client, "xhr");
            conversation.url = "hey";

            // Run
            conversation._xhr({
                url: "/ho",
                method: "POST",
                sync: false
            });

            // Posttest
            expect(client.xhr).toHaveBeenCalledWith(jasmine.objectContaining({
                url: "hey/ho",
                sync: false,
                method: "POST"
            }), jasmine.any(Function));
        });
    });

    describe("The on() method", function() {
        it("Should call any callbacks if subscribing to conversations:loaded", function() {
            // Setup
            conversation.syncState = layer.Constants.SYNC_STATE.SYNCED;
            var spy = jasmine.createSpy("spy");

            // Run
            conversation.on("conversations:loaded", spy);

            // Midtest
            expect(spy).not.toHaveBeenCalled();


            // Posttest
            jasmine.clock().tick(1);
            expect(spy).toHaveBeenCalled();
        });

        it("Should call any callbacks if subscribing to conversations:loaded via object", function() {
            // Setup
            conversation.syncState = layer.Constants.SYNC_STATE.SYNCED;
            var spy = jasmine.createSpy("spy");

            // Run
            conversation.on({
                "conversations:loaded": spy
            });

            // Midtest
            expect(spy).not.toHaveBeenCalled();


            // Posttest
            jasmine.clock().tick(1);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe("The toObject() method", function() {
        it("Should return cached value", function() {
            conversation._toObject = "fred";
            expect(conversation.toObject()).toEqual("fred");
        });

        it("Should call toObject() on all participants", function() {
           var participants = conversation.toObject().participants;
           expect(participants.length > 0).toBe(true);
           participants.forEach(function(participant) {
              expect(participant.userId).toEqual(jasmine.any(String));
              expect(participant.url).toEqual(jasmine.any(String));
              expect(participant).not.toEqual(jasmine.any(layer.Identity));
           });
           expect(conversation.participants[0].toObject()).toBe(participants[0]);
        });

        it("Should return a clone of participants", function() {
            expect(conversation.toObject().participants).toEqual(conversation.participants.map(function(participant) { return participant.toObject();}));
            expect(conversation.toObject().participants).not.toBe(conversation.participants);
        });

        it("Should return a clone of metadata", function() {
            expect(conversation.toObject().metadata).toEqual(conversation.metadata);
            expect(conversation.toObject().metadata).not.toBe(conversation.metadata);
        });
    });

    describe("The create() method", function() {
        it("Should throw error if no client", function() {
            expect(function() {
                var conversation = layer.Conversation.create({
                    participants: ["a"]
                });
            }).toThrowError(layer.LayerError.dictionary.clientMissing);
        });

        it("Should return a matching distinct conversation", function() {
            var conversation = layer.Conversation.create({
                client: client,
                participants: ["a"],
                distinct: true
            });
            var conversation2 = layer.Conversation.create({
                client: client,
                participants: ["a"],
                distinct: true
            });

            expect(conversation).toBe(conversation2);
        });
    });
});
