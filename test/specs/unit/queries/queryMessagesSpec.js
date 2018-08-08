/*eslint-disable */
describe("The MessagesQuery Class", function() {
    var appId = "Fred's App";

    var conversation, conversationUUID,
        conversation2,
        channel,
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
          model: layer.Query.Message
        });
        channel = client._createObject(responses.channel1);
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

    it("Should be an MessagesQuery", function() {
      expect(query.constructor.prototype.model).toEqual(layer.Query.Message);
    });

    describe("The constructor() method", function() {
        it("Should accept a full predicate", function() {
          var query = client.createQuery({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
        });

        it("Should accept a UUID predicate", function() {
          var query = client.createQuery({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
        });

        it("Should accept a full predicate double quote", function() {
          var query = client.createQuery({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual("conversation.id = 'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'");
        });

        it("Should accept a UUID predicate double quote", function() {
          var query = client.createQuery({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual("conversation.id = 'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'");
        });

        it("Should reject an invalid predicate", function() {
          expect(function() {
            var query = client.createQuery({
                client: client,
                model: layer.Query.Message,
                predicate: "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf-hey"
            });
          }).toThrowError(layer.LayerError.dictionary.invalidPredicate);
          expect(layer.LayerError.dictionary.invalidPredicate.length > 0).toBe(true);
        });
    });

    describe("The _fixPredicate() method", function() {
        it("Should generate a well formed predicate for conversations", function() {
            expect(query._fixPredicate('conversation.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"')).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
            expect(query._fixPredicate("conversation.id  =    'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'")).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
        });

        it("Should throw error on ill formed predicate for conversations", function() {
            expect(function() {
                query._fixPredicate('conversation.id  =    "la:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);

            expect(function() {
                query._fixPredicate('conversation.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77b"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);

            expect(function() {
                query._fixPredicate('conversation.id  =    "layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);
        });

        it("Should generate a well formed predicate for conversations from just a UUID", function() {
            expect(query._fixPredicate('conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"')).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
            expect(query._fixPredicate("conversation.id  =    'fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'")).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');

        });

        it("Should generate a well formed predicate for channels", function() {
             expect(query._fixPredicate('channel.id  =    "layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"')).toEqual('channel.id = \'layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
            expect(query._fixPredicate("channel.id  =    'layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'")).toEqual('channel.id = \'layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');

        });

        it("Should throw error on ill formed predicate for channels", function() {
            expect(function() {
                query._fixPredicate('channel.id  =    "la:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);

            expect(function() {
                query._fixPredicate('channel.id  =    "layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77b"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);

            expect(function() {
                query._fixPredicate('channel.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);

        });

        it("Should generate a well formed predicate for channels from just a UUID", function() {
            expect(query._fixPredicate('channel.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"')).toEqual('channel.id = \'layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
            expect(query._fixPredicate("channel.id  =    'fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'")).toEqual('channel.id = \'layer:///channels/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');

        });

        it("Should throw an error if neither a conversation nor channel is clearly being queried", function() {
            expect(function() {
                query._fixPredicate('identity.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"');
            }).toThrowError(layer.LayerError.dictionary.invalidPredicate);
        });
    });

    describe("The _getConversationPredicateIds() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return a UUID from a single quoted Full predicate", function() {
          query.predicate = 'conversation.id = "' + conversation.id + '"'
          expect(query._getConversationPredicateIds()).toEqual({
            uuid: conversation.id.replace(/layer\:\/\/\/conversations\//, ""),
            id: conversation.id,
            type: layer.Query.Conversation
          });
        });

        it("Should return a undefined from an unquoted predicate", function() {
          query.predicate = 'conversation.id = ' + conversation.id;
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });

        it("Should return a undefined from an arbitrarty predicate", function() {
          query.predicate = 'Frodo is a Dodo';
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });

        it("Should return a undefined from an empty predicate", function() {
          query.predicate = 'Frodo is a Dodo';
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });

        it("Should return a undefined from an predicate whose substring looks right", function() {
          query.predicate = 'conversation.id = "' + conversation.id + '" Frodo is a Dodo';
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });
    });


    describe("The _fetchData() method", function() {
        it("Should set isFiring to true if _getConversationPredicateIds returns an id", function() {
            var query = client.createQuery({
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });;
            spyOn(query, "_getConversationPredicateIds").and.returnValue({
              uuid: conversation.id.replace(/^layer\:\/\/\/conversations\//,''),
              id: conversation.id,
              type: layer.Query.Conversation
            });
            query.isFiring = false;
            query._fetchData(37);
            expect(query.isFiring).toBe(true);
        });

        it("Should set isFiring to false if _getConversationPredicateIds returns undefined", function() {
            var query = client.createQuery({
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });
            spyOn(query, "_getConversationPredicateIds").and.returnValue(undefined);
            query.isFiring = false;
            expect(query.isFiring).toBe(false);
        });

        it("Should call _fetchConversationMessages", function() {
            var query = client.createQuery({
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });
            spyOn(query, "_fetchConversationMessages");
            query._fetchData(38);
            expect(query._fetchConversationMessages).toHaveBeenCalledWith(38, jasmine.any(Object));
        });

        it("Should call _fetchChannelMessages", function() {
            var query = client.createQuery({
                model: 'Message',
                paginationWindow: 15,
                predicate: 'channel.id = "' + channel.id + '"'
            });
            spyOn(query, "_fetchChannelMessages");
            query._fetchData(39);
            expect(query._fetchChannelMessages).toHaveBeenCalledWith(39, jasmine.any(Object));
        });
    });

    describe("The _fetchConversationMessages() method", function() {

        var query;
        beforeEach(function() {
            client._models.conversations[conversation.id] = conversation;
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = client.createQuery({
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });


        it("Should do nothing if no predicate", function() {
            query.isFiring = false;
            query.predicate = '';
            query._fetchData(39);
            expect(query.isFiring).toBe(false);
        });

        it("Should update _predicate", function() {
            query.isFiring = false;
            query.predicate = 'conversation.id = "' + conversation.id + '"';
            query._fetchData(40);
            expect(query._predicate).toEqual(conversation.id);
        });


        it("Should call server with _nextServerFromId", function() {
            // Test 1
            expect(requests.mostRecent()).toBe(undefined);

            // Test 2
            query._nextServerFromId = 'howdy';
            query._fetchData(140);
            expect(requests.mostRecent().url).toEqual(client.url + '/conversations/' + layer.Util.uuid(conversation.id) + "/messages?page_size=140&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadMessages")
          // Test 1
          query._fetchData(141);
          expect(client.dbManager.loadMessages).toHaveBeenCalledWith(conversation.id, '', 141, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._fetchData(141);
          expect(client.dbManager.loadMessages).toHaveBeenCalledWith(conversation.id, 'howdy', 141, jasmine.any(Function));
        });

        it("Should call _appendResults with DB results", function() {
            spyOn(client.dbManager, "loadMessages").and.callFake(function(conversationId, fromId, pageSize, callback) {
                callback(["a", "b", "c"]);
            });
            spyOn(query, "_appendResults");
            query._fetchData(141);

            expect(query._appendResults).toHaveBeenCalledWith({ data: ["a", "b", "c"]}, true);
        });

        it("Should refuse to call if already firing with same url", function() {
            var m1 = client._createObject(responses.message1);
            var m2 = client._createObject(responses.message2);
            requests.reset();

            conversation.lastMessage = conversation.createMessage("hi");
            query.data = [m1, m2];
            query._fetchData(45);
            query._fetchData(45);
            expect(requests.count()).toEqual(1);
        });

        it("Should refuse to call if Conversation unsaved", function() {
            var m1 = client._createObject(responses.message1);
            var m2 = client._createObject(responses.message2);
            requests.reset();

            conversation.lastMessage = conversation.createMessage("hi");
            conversation.syncState = layer.Constants.SYNC_STATE.SAVING;
            query.data = [m1, m2];
            query._fetchData(45);
            expect(requests.count()).toEqual(0);
        });

        it("Should set pagedToEnd if Conversation unsaved", function() {
            var m1 = client._createObject(responses.message1);
            var m2 = client._createObject(responses.message2);
            requests.reset();

            conversation.lastMessage = conversation.createMessage("hi");
            conversation.syncState = layer.Constants.SYNC_STATE.SAVING;
            query.data = [m1, m2];
            expect(query.pagedToEnd).toBe(false);

            query._fetchData(45);
            expect(query.pagedToEnd).toBe(true);
        });


        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._fetchData(47);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
            }), "conversations/" + conversation.id.replace(/^layer\:\/\/\/conversations\//, "") + "/messages?page_size=47", 47);
        });

        it("Should add lastMessage to the results", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._fetchData(48);

            // Posttest
            expect(query.data).toEqual([conversation.lastMessage]);
            expect(query._triggerChange).toHaveBeenCalledWith({
              type: 'data',
              query: query,
              data: [conversation.lastMessage],
              target: client,
            });
        });
    });


    describe("The _fetchChannelMessages() method", function() {

        var query;
        beforeEach(function() {
            client._models.channels[channel.id] = channel;
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = client.createQuery({
                model: 'Message',
                paginationWindow: 15,
                predicate: 'channel.id = "' + channel.id + '"'
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });


        it("Should do nothing if no predicate", function() {
            query.isFiring = false;
            query.predicate = '';
            query._fetchData(39);
            expect(query.isFiring).toBe(false);
        });

        it("Should update _predicate", function() {
            query.isFiring = false;
            query.predicate = 'channel.id = "' + channel.id + '"';
            query._fetchData(40);
            expect(query._predicate).toEqual(channel.id);
        });


        it("Should call server with _nextServerFromId", function() {
            // Test 1
            expect(requests.mostRecent()).toBe(undefined);

            // Test 2
            query._nextServerFromId = 'howdy';
            query._fetchData(140);
            expect(requests.mostRecent().url).toEqual(client.url + '/channels/' + layer.Util.uuid(channel.id) + "/messages?page_size=140&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadMessages")
          // Test 1
          query._fetchData(141);
          expect(client.dbManager.loadMessages).toHaveBeenCalledWith(channel.id, '', 141, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._fetchData(141);
          expect(client.dbManager.loadMessages).toHaveBeenCalledWith(channel.id, 'howdy', 141, jasmine.any(Function));
        });

        it("Should call _appendResults with DB results", function() {
            spyOn(client.dbManager, "loadMessages").and.callFake(function(channelId, fromId, pageSize, callback) {
                callback(["a", "b", "c"]);
            });
            spyOn(query, "_appendResults");
            query._fetchData(141);

            expect(query._appendResults).toHaveBeenCalledWith({ data: ["a", "b", "c"]}, true);
        });

        it("Should refuse to call if already firing with same url", function() {
            var m1 = client._createObject(responses.message1);
            var m2 = client._createObject(responses.message2);
            requests.reset();

            query.data = [m1, m2];
            query._fetchData(45);
            query._fetchData(45);
            expect(requests.count()).toEqual(1);
        });

        it("Should refuse to call if Channel unsaved", function() {
            var m1 = client._createObject(responses.message1);
            m1.conversationId = channel.id;
            var m2 = client._createObject(responses.message2);
            requests.reset();

            channel.syncState = layer.Constants.SYNC_STATE.SAVING;
            query.data = [m1, m2];
            query._fetchData(45);
            expect(requests.count()).toEqual(0);
        });


        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._fetchData(47);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
            }), "channels/" + channel.id.replace(/^layer\:\/\/\/channels\//, "") + "/messages?page_size=47", 47);
        });
    });

    describe("The _handleEvents() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: 'Message',
                paginationWindow: 15
            });
            query.data = [conversation.createMessage("hey")];
            spyOn(query, "_handleConvIdChangeEvent");
            spyOn(query, "_handleChangeEvent");
            spyOn(query, "_handleAddEvent");
            spyOn(query, "_handleRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleChangeEvent", function() {
            query._handleEvents("messages:change", {a: "b", eventName: "messages:change"})
            expect(query._handleChangeEvent).toHaveBeenCalledWith('messages', {a: "b", eventName: "messages:change"});
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
            expect(query._handleConvIdChangeEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleAddEvent", function() {
            query._handleEvents("messages:add", {a: "b", eventName: "messages:add"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).toHaveBeenCalledWith('messages', {a: "b", eventName: "messages:add"});
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
            expect(query._handleConvIdChangeEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleRemoveEvent", function() {
            query._handleEvents("messages:remove", {a: "b", eventName: "messages:remove"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).toHaveBeenCalledWith('messages', {a: "b", eventName: "messages:remove"});
            expect(query._handleConvIdChangeEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleConvIdChangeEvent", function() {
            query._handleEvents("conversations:change", {a: "b", eventName: "conversations:change"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
            expect(query._handleConvIdChangeEvent).toHaveBeenCalledWith({a: "b", eventName: "conversations:change"});
        });
    });

    describe("The _getInsertIndex() method", function() {
        var query, message2;
        beforeEach(function() {
            message.position = 5;
            message2 = conversation.createMessage("hey");
            message2.position = 10;
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object"
            });
        });

        it("Should insert as first element if sort by position", function() {
            var m = {position: 15};
            expect(query._getInsertIndex(m, [message2, message])).toEqual(0);
        });

        it("Should insert as second element if sort by position", function() {
            var c = {position: 8};
            expect(query._getInsertIndex(c, [message2, message])).toEqual(1);
        });

        it("Should insert as last element if sort by position", function() {
            var c = {position: 3};
            expect(query._getInsertIndex(c, [message2, message])).toEqual(2);
        });
    });


    describe("The _handleConvIdChangeEvent() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should update the predicate if the old id matches", function() {
            var predicate = query.predicate;
            spyOn(query, "_run");

            // Run
            query._handleConvIdChangeEvent(new layer.LayerEvent({
                property: "id",
                oldValue: conversation.id,
                newValue: conversation.id + "1",
                target: conversation
            }, "conversations:change"));

            // Posttest
            expect(query.predicate).not.toEqual(predicate);
            expect(query.predicate).toEqual("conversation.id = '" + conversation.id + "1'");
            expect(query._run).toHaveBeenCalled();
        });

        it("Should NOT update the predicate if the old id does not match", function() {
            var predicate = query.predicate;
            spyOn(query, "_run");

            // Run
            query._handleConvIdChangeEvent(new layer.LayerEvent({
                property: "id",
                oldValue: conversation.id + "1",
                newValue: conversation.id,
                target: conversation
            }, "conversations:change"));

            // Posttest
            expect(query.predicate).toEqual(predicate);
            expect(query._run).not.toHaveBeenCalled();
        });
    });

    describe("The _handlePositionChange() method", function() {
        var query, message, evt;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            message = conversation.createMessage("hi");
            query.data = [conversation.createMessage("hi 0"), message, conversation.createMessage("hi 2")];

            var oldPosition = 5;
            var newPosition = message.position = 15;
            evt = new layer.LayerEvent({
                property: "position",
                oldValue: oldPosition,
                newValue: newPosition,
                target: message
            }, "messages:change");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should do nothing if index is -1", function() {
          // Setup
          spyOn(query, "_getInsertIndex");

            // Run
          query._handlePositionChange(evt, -1);

          // Posttest
          expect(query._getInsertIndex).not.toHaveBeenCalled();
        });

        it("Should update data with the new index", function() {
          var data = query.data;
          spyOn(query, "_getInsertIndex").and.returnValue(1);

          // Run
          query._handlePositionChange(evt, 0);

          // Posttest
          expect(query.data).not.toBe(data);
          expect(query.data[0].id).toBe(message.id);
        });

        it("Should trigger a change event with the new index", function() {
          spyOn(query, "trigger");
          spyOn(query, "_getInsertIndex").and.returnValue(1);

          // Run
          query._handlePositionChange(evt, 0);

          // Posttest
          expect(query.trigger).toHaveBeenCalledWith('change', {
            type: 'property',
            target: query._getData(message),
            query: query,
            isChange: true,
            changes: evt.changes,
          });
        });

        it("Should return true with the new index", function() {
          spyOn(query, "_getInsertIndex").and.returnValue(1);
          expect(query._handlePositionChange(evt, 0)).toBe(true);
        });

        it("Should do none of the above if its the old index", function() {
          var data = query.data;
          spyOn(query, "trigger");
          spyOn(query, "_getInsertIndex").and.returnValue(1);

          // Run
          expect(query._handlePositionChange(evt, 1)).not.toBe(true);

          // Posttest
          expect(query.trigger).not.toHaveBeenCalled();
          expect(data).toBe(query.data);
        });
    });

    describe("The _handleChangeEvent() method", function() {
        var query, message;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            message = conversation.createMessage("hi");
            query.data = [message];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handlePositionChange and make no changes if that method reports it handled everything", function() {
            // Setup
            var oldPosition =  5;
            var newPosition = message.position = 10;
            spyOn(query, "_handlePositionChange").and.returnValue(true);
            spyOn(query, "_getIndex").and.returnValue(0);
            var evt = new layer.LayerEvent({
                property: "position",
                oldValue: oldPosition,
                newValue: newPosition,
                target: message
            }, "messages:change");
            var data = query.data = [message.toObject()];

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query.data).toBe(data);
            expect(query._handlePositionChange).toHaveBeenCalledWith(evt, 0);
            expect(query._getIndex.calls.count()).toEqual(1);
        });

        it("Should call _handlePositionChange and make more changes if that method reports it didnt handle everything", function() {
            // Setup
            var oldPosition =  5;
            var newPosition = message.position = 10;
            spyOn(query, "_handlePositionChange").and.returnValue(true);
            spyOn(query, "_getIndex").and.returnValue(0);
            spyOn(query, "_triggerChange");
            var evt = new layer.LayerEvent({
                property: "position",
                oldValue: oldPosition,
                newValue: newPosition,
                target: message
            }, "messages:change");
            evt.changes.push({
                property: 'isRead',
                oldValue: false,
                newValue: true
            });
            var data = query.data = [message.toObject()];

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual(data);
            expect(query._handlePositionChange).toHaveBeenCalledWith(evt, 0);
            expect(query._getIndex.calls.count()).toEqual(2);
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: "property",
                target: message.toObject(),
                query: query,
                changes: evt.changes,
                isChange: true
            });
        });

        it("Should call _handlePositionChange and not update index if position did not change", function() {
            // Setup
            spyOn(query, "_handlePositionChange").and.returnValue(true);
            spyOn(query, "_getIndex").and.returnValue(0);
            var evt = new layer.LayerEvent({
                property: "position",
                oldValue: 10,
                newValue: 10,
                target: message
            }, "messages:change");
            var data = query.data = [message.toObject()];

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query.data).toBe(data);
            expect(query._handlePositionChange).toHaveBeenCalledWith(evt, 0);
            expect(query._getIndex.calls.count()).toEqual(1);
        });


        it("Should not touch data array if dataType is object but item not in the data", function() {
            var evt = new layer.LayerEvent({
                property: "recipientStatus",
                oldValue: [{}],
                newValue: [{a: "read"}],
                target: message
            }, "messages:change");
            var data = query.data = [message.toObject()];
            data[0].id += "1"; // prevent data from being found

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should update data array if dataType is instance", function() {
            // Setup
            query.dataType = "instance";
            var data = query.data = [message];
            var evt = new layer.LayerEvent({
                property: "recipientStatus",
                oldValue: [{}],
                newValue: [{a: "read"}],
                target: message
            }, "messages:change");

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should trigger change event if the Message is in the data", function() {
            var data = query.data = [message.toObject()];
            var evt = new layer.LayerEvent({
                property: "recipientStatus",
                oldValue: [{}],
                newValue: [{a: "read"}],
                target: message
            }, "messages:change");
            spyOn(query, "_triggerChange");

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: "property",
                target: message.toObject(),
                query: query,
                isChange: true,
                changes: [{
                    property: "recipientStatus",
                    oldValue: [{}],
                    newValue: [{a: "read"}]
                }]
            });
        });

        it("Should not trigger change event if Message is NOT in the data", function() {
            var data = query.data = [message.toObject()];
            var evt = new layer.LayerEvent({
                property: "participants",
                oldValue: ["a"],
                newValue: ["a", "b"],
                target: {id: message.id + "1"}
            }, "messages:change");
            spyOn(query, "trigger");

            // Run
            query._handleChangeEvent('messages', evt);

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });
    });


    describe("The _handleAddEvent() method", function() {
        var query, message1, message2;
        beforeEach(function() {
            message1 = conversation.createMessage("hi").send();
            message2 = conversation.createMessage("ho").send();
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            query.data = [];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var data = query.data = [];

            // Run
            query._handleAddEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([message2.toObject(), message1.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleAddEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([message2, message1]);
        });

        it("Should only operate on new values", function() {
            var data = query.data = [message1.toObject()];

            // Run
            query._handleAddEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).toEqual([message2.toObject(), message1.toObject()]);

        });

        it("Should use _getInsertIndex to position result", function() {
            spyOn(query, "_getInsertIndex").and.callFake(function(arg1, arg2) {
              expect(arg1).toBe(message3);
              expect(arg2).toEqual([message1.toObject(), message2.toObject()]);
            }).and.returnValue(1);
            spyOn(query, "_handleEvents");
            query.data = [message1.toObject(), message2.toObject()];
            message3 = conversation.createMessage("ho").send();

            // Run
            query._handleAddEvent('messages', {
                messages: [message3]
            });

            // Posttest
            expect(query.data).toEqual([message1.toObject(), message3.toObject(), message2.toObject()]);
            expect(query._getInsertIndex).toHaveBeenCalled();
        });

        it("Should trigger change event if new values", function() {
            var data = query.data = [];
            var count = 0;
            spyOn(query, "_triggerChange").and.callFake(function(evt) {
                if (count === 0) {
                    expect(evt).toEqual({
                        type: 'insert',
                        index: 0,
                        target: message1.toObject(),
                        query: query
                    });
                    expect(query.data).toEqual([message1.toObject()]);
                    count++;
                } else if (count === 1) {
                    expect(evt).toEqual({
                        type: 'insert',
                        index: 0,
                        target: message2.toObject(),
                        query: query
                    });
                    expect(query.data).toEqual([message2.toObject(), message1.toObject()]);
                    count++;
                }
            });

            // Run
            query._handleAddEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(count).toEqual(2);
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");
            query.data = [message1, message2];

            // Run
            query._handleAddEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalCount property", function() {
          expect(query.totalSize).toEqual(0);

          // Run
          query._handleAddEvent('messages', {
              messages: [message1, message2]
          });

          // Posttest
          expect(query.totalSize).toEqual(2);
        });
    });


    describe("The _handleRemoveEvent() method", function() {
        var query, message1, message2;
        beforeEach(function() {
            message1 = conversation.createMessage("hi");
            message2 = conversation.createMessage("ho");
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            query.data = [message1.toObject(), message2.toObject()];

        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array without message if dataType is object", function() {

            var data = query.data;

            // Run
            query._handleRemoveEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should call _updateNextFromId for db and server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextDBFromId = message1.id;
            query._nextServerFromId = message2.id;

            // Run
            query._handleRemoveEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('heyho');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleRemoveEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var message3 = conversation.createMessage("hi3");

            // Run
            query._handleRemoveEvent('messages', {
                messages: [message1, message3]
            });

            // Posttest
            expect(query.data).toEqual([message2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleRemoveEvent('messages', {
                messages: [message1, message2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: message1.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: message2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [message2.toObject()];

            // Run
            query._handleRemoveEvent('messages', {
                messages: [message1]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should decrease the totalCount property", function() {
          query.data = [message, message1, message2];
          query.totalSize = 3;

          // Run
          query._handleRemoveEvent('messages', {
              messages: [message1, message2]
          });

          // Posttest
          expect(query.totalSize).toEqual(1);
        });
    });
});
