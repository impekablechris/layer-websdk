/*eslint-disable */
describe("The ConversationsQuery Class", function() {
    var appId = "Fred's App";

    var conversation, conversationUUID,
        conversation2,
        message,
        identity,
        client,
        query,
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
        client.userId = "Frodo";
        client.user = new layer.Identity({
          clientId: client.appId,
          userId: client.userId,
          id: "layer:///identities/" + client.userId,
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


        client._clientAuthenticated();
        getObjectsResult = [];
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectsResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        query = client.createQuery({
          model: layer.Query.Conversation
        });
        conversation = client._createObject(responses.conversation1);
        conversation2 = client._createObject(responses.conversation2);
        message = conversation.createMessage("Hey").send();

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

    it("Should be an ConversationsQuery", function() {
      expect(query.constructor.prototype.model).toEqual(layer.Query.Conversation);
    });

    describe("The constructor() method", function() {
         it("Should reject predicate on Conversations", function() {
            expect(function() {
                var query = client.createQuery({
                    client: client,
                    model: layer.Query.Conversation,
                    predicate: 'conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
                });
            }).toThrowError(layer.LayerError.dictionary.predicateNotSupported);
            expect(layer.LayerError.dictionary.predicateNotSupported.length > 0).toBe(true);
        });
    });

    describe("The _fetchData() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true", function() {
            query.isFiring = false;
            query._fetchData();
            expect(query.isFiring).toBe(true);
        });

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._fetchData(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations?sort_by=created_at&page_size=32");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._fetchData(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations?sort_by=created_at&page_size=32&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadConversations");

          // Test 1
          query._fetchData(17);
          expect(client.dbManager.loadConversations).toHaveBeenCalledWith('created_at', '', 17, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._fetchData(17);
          expect(client.dbManager.loadConversations).toHaveBeenCalledWith('created_at', 'howdy', 17, jasmine.any(Function));
        });

        it("Should refuse to call if already firing with same url", function() {
            requests.reset();
            query._fetchData(45);
            query._fetchData(45);
            expect(requests.count()).toEqual(1);
        });

        it("Should call with last_message sorting", function() {
            query.sortBy = [{'lastMessage.sentAt': 'desc'}];
            query._fetchData(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations?sort_by=last_message&page_size=32");
        });

        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._fetchData(36);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
                data: [{id: "a"}, {id: "b"}]
            }), "conversations?sort_by=created_at&page_size=36", 36);
        });
    });

    describe("The _getSortField() method", function() {
      it("Should return last_message", function() {
        query.update({sortBy: [{'lastMessage.sentAt': 'desc'}]});
        expect(query._getSortField()).toEqual('last_message');
      });

      it("Should return created_at", function() {
        query.update({sortBy: [{'createdAt': 'desc'}]});
        expect(query._getSortField()).toEqual('created_at');
      });
    });


    describe("The _getInsertIndex() method", function() {
        var query;
        beforeEach(function() {
            conversation.createdAt = 5;
            conversation2.createdAt = 10;
            conversation2.lastMessage.sentAt = 8;
            conversation.lastMessage.sentAt = 12;
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15,
                dataType: "object",
                sortBy: [{"createdAt": "desc"}]
            });
        });

        it("Should insert as first element if sort by createdAt", function() {
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 15;
            expect(query._getInsertIndex(c, [conversation2, conversation])).toEqual(0);
        });

        it("Should insert as second element if sort by createdAt", function() {
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 8;
            expect(query._getInsertIndex(c, [conversation2, conversation])).toEqual(1);
        });

        it("Should insert as last element if sort by createdAt", function() {
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 3;
            expect(query._getInsertIndex(c, [conversation2, conversation])).toEqual(2);
        });

        it("Should insert as first element if sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 15;
            expect(query._getInsertIndex(c, [conversation, conversation2])).toEqual(0);
        });

        it("Should insert as second element if sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 11;
            expect(query._getInsertIndex(c, [conversation, conversation2])).toEqual(1);
        });

        it("Should insert as last element if sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 3;
            expect(query._getInsertIndex(c, [conversation, conversation2])).toEqual(2);
        });

        it("Should use createdAt field in sort by lastMessage test 1", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 11;
            expect(query._getInsertIndex(c, [conversation, conversation2])).toEqual(1);
        });

        it("Should use createdAt field in sort by lastMessage test 2", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 11;
            data = [conversation, conversation2];
            data[0].createdAt = data[0].lastMessage.sentAt;
            delete data[0].lastMessage;
            expect(query._getInsertIndex(c, data)).toEqual(1);
        });

        it("Should insert NEW items at top for sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [conversation, conversation2];
            expect(query._getInsertIndex(c, data)).toEqual(0);
        });

        it("Should insert NEW items at top for sort by createdAt", function() {
            query.sortBy = [{"createdAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [conversation, conversation2];
            expect(query._getInsertIndex(c, data)).toEqual(0);
        });

        it("Should insert added items after NEW items for sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [c, conversation2];
            expect(query._getInsertIndex(conversation, data)).toEqual(1);
        });

        it("Should insert added items after NEW items for sort by createdAt", function() {
            query.sortBy = [{"createdAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [c, conversation2];
            expect(query._getInsertIndex(conversation, data)).toEqual(2);
        });
    });

    describe("The _handleEvents() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
            query.data = [conversation];
            spyOn(query, "_handleChangeEvent");
            spyOn(query, "_handleAddEvent");
            spyOn(query, "_handleRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleChangeEvent", function() {
            query._handleEvents("conversations:change", {a: "b", eventName: "conversations:change"})
            expect(query._handleChangeEvent).toHaveBeenCalledWith('conversations', {a: "b", eventName: "conversations:change"});
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleAddEvent", function() {
            query._handleEvents("conversations:add", {a: "b", eventName: "conversations:add"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).toHaveBeenCalledWith('conversations', {a: "b", eventName: "conversations:add"});
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleRemoveEvent", function() {
            query._handleEvents("conversations:remove", {a: "b", eventName: "conversations:remove"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).toHaveBeenCalledWith('conversations', {a: "b", eventName: "conversations:remove"});
        });
    });

    describe("The _handleChangeEvent() method", function() {
        describe("Sort by createdAt, dataType is object", function() {
            var query;
            beforeEach(function() {
                query = client.createQuery({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "object",
                    sortBy: [{'createdAt': 'desc'}]
                });
                query.data = [conversation2.toObject(), conversation.toObject()];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should find the Conversation and apply Conversation ID changes without reordering and using a new data array", function() {
                // Setup
                var id = conversation.id;
                var tempId = layer.Util.generateUUID();
                query.data[1].id = tempId;
                var data = query.data;
                conversation._clearObject();
                conversation.id = id;
                var evt = new layer.LayerEvent({
                    property: "id",
                    oldValue: tempId,
                    newValue: id,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1].id).toEqual(id);
                expect(data[1].id).toEqual(tempId);
            });

            it("Should update the array object and the conversation object for unreadCount change", function() {
                // Setup
                var data = query.data;
                var originalObject = data[1];
                originalObject.unreadCount = 1;
                conversation._clearObject();
                var evt = new layer.LayerEvent({
                    property: "unreadCount",
                    oldValue: 1,
                    newValue: 2,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1]).not.toEqual(originalObject);
            });

            it("Should update the array object but not reorder for lastMessage events", function() {
                // Setup
                var data = query.data;
                conversation._clearObject();
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data).toEqual(data);
            });

            it("Should not touch data array if dataType is object but item not in the data", function() {
                var conversation = client.createConversation({ participants: ["abc"] });
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;
                data[0].id += "1";

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).toBe(data);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation.toObject(),
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });


            it("Should not trigger a move event if the Conversation sorting has not changed", function() {
                expect(query.data.indexOf(conversation.toObject())).toEqual(1);
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);


                // Posttest
                expect(query._triggerChange).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    type: 'move'
                }));
                expect(query.data.indexOf(conversation.toObject())).toEqual(1);
            });

            describe("Sort by createdAt, dataType is instance", function() {
            var query;
            beforeEach(function() {
                query = client.createQuery({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "instance",
                    sortBy: [{'createdAt': 'desc'}]
                });
                query.data = [conversation2, conversation];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should not touch data array for a participant change event", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).toEqual([conversation2, conversation]);
                expect(query.data).toBe(data);
            });

            it("Should not reorder the array for a lastMessage event", function() {
                // Setup
                var data = query.data;
                var dataCopy = [].concat(query.data);
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).toBe(data);
                expect(query.data).toEqual(dataCopy);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation,
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });

            it("Should not trigger a move event if the Conversation sorting has not changed", function() {
                expect(query.data.indexOf(conversation)).toEqual(1);
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);


                // Posttest
                expect(query._triggerChange).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    type: 'move'
                }));
                expect(query.data.indexOf(conversation)).toEqual(1);
            });
        });

        describe("Sort by lastMessage.sentAt, dataType is object", function() {
            var query;
            beforeEach(function() {
                query = client.createQuery({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "object",
                    sortBy: [{'lastMessage.sentAt': 'desc'}]
                });
                query.data = [conversation2.toObject(), conversation.toObject()];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should find the Conversation and apply Conversation ID changes but not reorder", function() {
                // Setup
                var id = conversation.id;
                var tempId = layer.Util.generateUUID();
                query.data[1].id = tempId;
                var data = query.data = [conversation2.toObject(), conversation.toObject()];
                conversation._clearObject();
                conversation.id = id;
                var evt = new layer.LayerEvent({
                    property: "id",
                    oldValue: tempId,
                    newValue: id,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1].id).toEqual(id);
                expect(data[1].id).toEqual(tempId);
                expect(query.data).toEqual([conversation2.toObject(), conversation.toObject()]);
            });

            it("Should update the array object and reorder for lastMessage events", function() {
                // Setup
                var data = query.data;
                conversation._clearObject();
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data).toEqual([conversation.toObject(), conversation2.toObject()]);
            });

            it("Should not touch data array if dataType is object but item not in the data", function() {
                var conversation = client.createConversation({ participants: ["abc"] });
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;
                data[0].id += "1";

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).toBe(data);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation.toObject(),
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });

            it("Should trigger a move event if the Conversation sorting has changed", function() {
                expect(query.data.indexOf(conversation.toObject())).toEqual(1);
                spyOn(query, "_handleChangeEvent").and.callThrough();
                spyOn(query, "_triggerChange");

                // Run
                // This will trigger a conversations:change event with lastMessage changing, that should call _handleChangeEvent
                conversation.createMessage('hey').send();
                jasmine.clock().tick(1);
                expect(query._handleChangeEvent).toHaveBeenCalled();


                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: 'move',
                    target: conversation.toObject(),
                    query: query,
                    isChange: false,
                    fromIndex: 1,
                    toIndex: 0
                });
                expect(query.data.indexOf(conversation.toObject())).toEqual(0);
            });

            it("Should not trigger a move event if the Conversation sorting has not changed", function() {
                expect(query.data.indexOf(conversation.toObject())).toEqual(1);
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);


                // Posttest
                expect(query._triggerChange).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    type: 'move'
                }));
                expect(query.data.indexOf(conversation.toObject())).toEqual(1);
            });
        });

        describe("Sort by lastMessage.sentAt, dataType is instance", function() {
            var query;
            beforeEach(function() {
                query = client.createQuery({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "instance",
                    sortBy: [{'lastMessage.sentAt': 'desc'}]
                });
                query.data = [conversation2, conversation];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should not touch data array for a participant change event", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).toEqual([conversation2, conversation]);
                expect(query.data).toBe(data);
            });

            it("Should reorder the array for a lastMessage event", function() {
                // Setup
                var data = query.data;
                var dataCopy = [].concat(query.data);
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.data).toBe(data);
                expect(query.data).toEqual([conversation, conversation2]);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation,
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleChangeEvent('conversations', evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });

            it("Should trigger a move event if the Conversation sorting has changed", function() {
                expect(query.data.indexOf(conversation)).toEqual(1);
                spyOn(query, "_handleChangeEvent").and.callThrough();
                spyOn(query, "_triggerChange");

                // Run
                // This will trigger a conversations:change event with lastMessage changing, that should call _handleChangeEvent
                conversation.createMessage('hey').send();
                jasmine.clock().tick(1);
                expect(query._handleChangeEvent).toHaveBeenCalled();


                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: 'move',
                    target: conversation,
                    query: query,
                    isChange: false,
                    fromIndex: 1,
                    toIndex: 0
                });
                expect(query.data.indexOf(conversation)).toEqual(0);
            });

            it("Should not trigger a move event if the Conversation sorting has not changed", function() {
                expect(query.data.indexOf(conversation)).toEqual(1);
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('conversations', evt);


                // Posttest
                expect(query._triggerChange).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    type: 'move'
                }));
                expect(query.data.indexOf(conversation)).toEqual(1);
            });
        });
    });
  });

  describe("The _handleAddEvent() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15,
                dataType: "object"
            });
            query.data = [conversation];
            spyOn(query, "_getInsertIndex").and.returnValue(0);
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [];

            // Run
            query._handleAddEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([conversation2.toObject(), conversation.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleAddEvent('conversations',{
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([conversation2, conversation]);
        });

        it("Should only operate on new values", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [conversation.toObject()];

            // Run
            query._handleAddEvent('conversations',{
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).toEqual([conversation2.toObject(), conversation.toObject()]);

        });

        it("Should trigger change event if new values", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [];
            spyOn(query, "trigger");

            // Run
            query._handleAddEvent('conversations',{
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.trigger).toHaveBeenCalledWith("change", {
                type: 'insert',
                index: 0,
                target: conversation.toObject(),
                query: query
            });
            expect(query.trigger).toHaveBeenCalledWith("change", {
                type: 'insert',
                index: 0,
                target: conversation2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");

            // Run
            query._handleAddEvent('conversations', {
                conversations: [conversation]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalSize property", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [];
            expect(query.totalSize).toEqual(0);

            // Run
            query._handleAddEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.totalSize).toEqual(2);
        });
    });

    describe("The _handleRemoveEvent() method", function() {
        var query, conversation2;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15,
                dataType: "object"
            });
            conversation2 = client.createConversation({ participants: ["cdc"] });
            query.data = [conversation.toObject(), conversation2.toObject()];

        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _updateNextFromId for db and server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextDBFromId = conversation.id;
            query._nextServerFromId = conversation2.id;

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('heyho');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should replace data with a new array removes conversations if dataType is object", function() {

            var data = query.data;

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var conversation3 = client.createConversation({ participants: ["zbd"] });

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation, conversation3]
            });

            // Posttest
            expect(query.data).toEqual([conversation2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: conversation.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: conversation2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [conversation2.toObject()];

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalSize property", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var conversation3 = client.createConversation({ participants: ["azab"] });
            var data = query.data = [conversation, conversation2, conversation3];
            query.totalSize = 3;

            // Run
            query._handleRemoveEvent('conversations', {
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.totalSize).toEqual(1);
        });
    });
});