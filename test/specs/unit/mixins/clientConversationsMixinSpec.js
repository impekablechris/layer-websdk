/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Conversation Mixin", function() {
    var appId = "Fred's App";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";
    var cid1 = "layer:///conversations/test1",
        cid2 = "layer:///conversations/test2",
        cid3 = "layer:///conversations/test3",
        url1 = "http://localhost:9753/conversations/test1",
        url2 = "http://localhost:9753/conversations/test2",
        url3 = "http://localhost:9753/conversations/test3";
    var client, requests, userIdentity2;

    beforeEach(function() {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        jasmine.addCustomEqualityTester(mostRecentEqualityTest);
        jasmine.addCustomEqualityTester(responseTest);

        client = new layer.Client({
            appId: appId,
            url: "http://localhost:9753"
        });
        client.sessionToken = "sessionToken";

        client.user = userIdentity = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/Frodo",
            displayName: "Frodo",
            userId: "Frodo"
        });

        userIdentity2 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/1",
            displayName: "UserIdentity",
            userId: '1'
        });

        client.isTrustedDevice = true;

        client._clientAuthenticated();
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            callback([]);
        });
        spyOn(client.dbManager, "getObject").and.callFake(function(tableName, ids, callback) {
            callback(null);
        });
        client._clientReady();
    });

    afterEach(function() {
        client.destroy();
        jasmine.clock().uninstall();
        jasmine.Ajax.uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The constructor() method", function() {
        it("Should setup _models.conversations", function() {
           expect(client._models.conversations).toEqual({});
        });
    });

    describe("The cleanup() method", function() {
        afterEach(function() {
            client._models.channels = client._models.messages = client._models.conversations = client._models.queries = client._models.identities = {};
        });

        it("Should destroy all Conversations", function() {
          // Setup
          var conversation = client.createConversation({ participants: ["a"] });

          // Pretest
          expect(client._models.conversations[conversation.id]).toBe(conversation);

          // Run
          client._cleanup();

          // Posttest
          expect(conversation.isDestroyed).toBe(true);
          expect(client._models.conversations).toBe(null);

      });
    });

    describe("The getConversation() method", function() {
        var conversation;
        beforeEach(function() {
            conversation = new layer.Conversation({
                client: client,
                fromServer: {
                    id: "layer:///conversations/" + layer.Util.generateUUID(),
                    participants: ["a"]
                }
            });
        });
        it("Should get by id", function() {
            expect(client.getConversation(conversation.id)).toBe(conversation);
        });

        it("Should load by id", function() {
            var c1 = client.getConversation(cid1, true);

            // Posttest
            expect(c1 instanceof layer.Conversation).toBe(true);

            expect(c1.participants).toEqual([client.user]);
            expect(c1.id).toEqual(cid1);
            expect(requests.mostRecent().url).toEqual(url1);
        });

        it("Should fail without id", function() {
            expect(function() {
                client.getConversation(5);
            }).toThrowError(layer.LayerError.dictionary.idParamRequired);
            expect(layer.LayerError.dictionary.idParamRequired.length > 0).toBe(true);
        });

        it("Should not load if not ready", function() {
            client.isReady = false;
            requests.reset();
            client.getConversation(cid1, true);
            expect(requests.count()).toEqual(0);
            client._clientReady();
            expect(requests.count()).toEqual(1);
        });
    });

    describe("The _addConversation() method", function() {


        it("Should register a conversation in _models.conversations", function() {
            client._models.conversations = {};
            var c = new layer.Conversation({
                client: client
            });

            // Run
            client._addConversation(c);

            // Posttest
            expect(client.getConversation(c.id)).toBe(c);
        });

        it("Should set the clientId property", function() {
            // Setup
            var c = new layer.Conversation({
                client: client
            });

            // Pretest
            expect(c.clientId).toEqual(client.appId);

            // Run
            client._addConversation(c);

            // Posttest
            expect(c.clientId).toEqual(client.appId);
        });

        it("Should fire conversations:add", function() {
            // Setup
            spyOn(client, "_triggerAsync");

            // Run
            var c = new layer.Conversation({
                client: client,
            });
            client._addConversation(c);

            // Posttest
            expect(client._triggerAsync)
            .toHaveBeenCalledWith("conversations:add", {conversations: [c]});
        });

        it("Should not do anything if the conversation is already added", function() {
            // Setup
            var c = new layer.Conversation({
                client: client
            });
            client._addConversation(c);
            spyOn(client, "_triggerAsync");


            // Run
            var c2 = new layer.Conversation({
                id: c.id,
                client: client
            });
            client._addConversation(c2);

            // Posttest
            expect(client.getConversation(c.id)).toBe(c);
            expect(client._triggerAsync).not.toHaveBeenCalled();
        });

        it("Should no longer call _scheduleCheckAndPurgeCache", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");

            // Run
            var c = new layer.Conversation({
                client: client
            });
            client._addConversation(c);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).not.toHaveBeenCalled();
        });
    });

    describe("The _removeConversation() method", function() {

        it("Should deregister a conversation", function() {
            // Setup
            var c1 = client.createConversation({ participants: ["a"] });

            // Pretest
            var hash = {};
            hash[c1.id] = c1;
            expect(client._models.conversations).toEqual(hash);

            // Run
            client._removeConversation(c1);

            // Posttest
            delete hash[c1.id];
            expect(client._models.conversations).toEqual(hash);
        });

        it("Should trigger event on removing conversation", function() {
            // Setup
            var c1 = new layer.Conversation({
                client: client
            });
            client._addConversation(c1);
            spyOn(client, "_triggerAsync");

            // Run
            client._removeConversation(c1);

            // Posttest
            expect(client._triggerAsync).toHaveBeenCalledWith(
                "conversations:remove", {
                    conversations: [c1]
                }
            );
        });


        it("Should do nothing if conversation not registered", function() {
            // Setup
            var c1 = new layer.Conversation({
                client: client
            });
            client._models.conversations = {};
            spyOn(client, "trigger");

            // Pretest
            expect(client.getConversation(c1.id)).toEqual(null);

            // Run
            client._removeConversation(c1);

            // Posttest
            expect(client.trigger).not.toHaveBeenCalled();
        });

        it("Should destroy any Messages associated with the Conversation", function() {
            // Setup
            var c1 = client.createConversation({ participants: ["a"] });
            var m1 = c1.createMessage("a").send();
            var m2 = c1.createMessage("b").send();
            var m3 = c1.createMessage("c").send();
            var c2 = client.createConversation({ participants: ["b"] });
            var m4 = c2.createMessage("a").send();

            // Pretest
            expect(Object.keys(client._models.messages))
                .toEqual(jasmine.arrayContaining([m1.id, m2.id, m3.id, m4.id]));

            // Run
            client._removeConversation(c1);

            // Posttest
            expect(Object.keys(client._models.messages)).toEqual(jasmine.arrayContaining([m4.id]));
        });
    });

    describe("The _updateConversationId() method", function() {
        it("Should register the conversation under the new id", function() {
            // Setup
            var c1 = new layer.Conversation({
                client: client
            });
            client._addConversation(c1);
            var c1id = c1.id;

            // Run
            c1.id = "layer:///conversations/fred";
            client._updateConversationId(c1, c1id);

            // Posttest
            expect(client.getConversation("layer:///conversations/fred")).toBe(c1);
        });

        it("Should delete the old id", function() {
            // Setup
            var c1 = new layer.Conversation({
                client: client
            });
            client._addConversation(c1);
            var c1id = c1.id;

            // Pretest
            expect(client.getConversation(c1id)).toBe(c1);

            // Run
            c1.id = "layer:///conversations/fred";
            client._updateConversationId(c1, c1id);

            // Posttest
            expect(client._models.conversations[c1id]).toBe(undefined);
        });

        it("Should update all Message conversationIds", function() {
            // Setup
            var c1 = new layer.Conversation({
                participants: ["a"],
                client: client
            });
            client._addConversation(c1);
            var m1 = c1.createMessage("Hey").send();
            var m2 = c1.createMessage("Ho").send();
            var c1id = c1.id;

            // Pretest
            expect(m1.conversationId).toEqual(c1id);
            expect(m2.conversationId).toEqual(c1id);

            // Run
            c1.id = "layer:///conversations/fred";
            client._updateConversationId(c1, c1id);

            // Posttest
            expect(m1.conversationId).toEqual("layer:///conversations/fred");
            expect(m2.conversationId).toEqual("layer:///conversations/fred");
        });
    });

    describe("The findCachedConversation() method", function() {
        var c1, c2, c3;
        beforeEach(function() {
            c1 = client.createConversation({
                participants: ["a"],
                metadata: {
                    b: "c"
                }
            });
            c2 = client.createConversation({
                participants: ["b"],
                metadata: {
                    d: "e"
                }
            });
            c3 = client.createConversation({
                participants: ["c"]
            });

        });

        it("Should call the callback with each Conversation", function() {
            // Setup
            var spy = jasmine.createSpy('spy');

            // Run
            client.findCachedConversation(spy);

            // Posttest
            expect(spy).toHaveBeenCalledWith(c1, 0);
            expect(spy).toHaveBeenCalledWith(c2, 1);
            expect(spy).toHaveBeenCalledWith(c3, 2);
        });

        it("Should call the callback with correct context", function() {
            // Setup
            var d = new Date();

            // Run
            client.findCachedConversation(function(conversation) {
                expect(this).toBe(d);
            }, d);
        });

        it("Should return undefined if no matches", function() {
            // Run
            var result = client.findCachedConversation(function(conversation) {
                return false;
            });

            // Posttest
            expect(result).toBe(null);
        });

        it("Should return matching Conversation", function() {
            // Setup
            var identity = client.getIdentity("b");

            // Run
            var result = client.findCachedConversation(function(conversation) {
                return conversation.participants.indexOf(identity) != -1;
            });

            // Posttest
            expect(result).toBe(c2);
        });
    });

    describe("The createConversation() method", function() {
        var createMethod;
        beforeEach(function() {
            createMethod = layer.Conversation.create;
            spyOn(layer.Conversation, "create").and.returnValue(5);
        });

        afterEach(function() {
            layer.Conversation.create = createMethod;
        });

        it("Should create a conversation with a full object and strings", function() {
            // Run
            var c = client.createConversation({participants: ["a","z"]});

            // Posttest
            expect(layer.Conversation.create).toHaveBeenCalledWith({
                participants: ["a", "z"],
                distinct: true,
                client: client
            });
        });

        it("Should create a conversation with a full object and identities", function() {
            // Run
            var c = client.createConversation({participants: [userIdentity, userIdentity2]});

            // Posttest
            expect(layer.Conversation.create).toHaveBeenCalledWith({
                participants: [userIdentity, userIdentity2],
                distinct: true,
                client: client
            });
        });

        it("Should create a conversation with a full object", function() {
            // Run
            var c = client.createConversation({
            participants: ["a","z"],
            distinct: false
            });

            // Posttest
            expect(layer.Conversation.create).toHaveBeenCalledWith({
                participants: ["a", "z"],
                distinct: false,
                client: client
            });
        });

        it("Should return the new conversation", function() {
            // Run
            var c = client.createConversation({ participants: ["a","z"] });

            // Posttest
            expect(c).toEqual(5);
        });

        it("Should throw an error if not authenticated", function() {
            client.isAuthenticated = false;
            expect(function() {
                client.createConversation({participants: [userIdentity, userIdentity2]});
            }).toThrowError(layer.LayerError.dictionary.clientMustBeReady);
            expect(layer.LayerError.dictionary.clientMustBeReady.length > 0).toEqual(true);
        });
    });
});
