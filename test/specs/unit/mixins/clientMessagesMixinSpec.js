/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Message Mixin", function() {
    var appId = "Fred's App";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";
    var cid1 = "layer:///conversations/test1",
        cid2 = "layer:///conversations/test2",
        cid3 = "layer:///conversations/test3",
        url1 = "http://localhost:9753/conversations/test1",
        url2 = "http://localhost:9753/conversations/test2",
        url3 = "http://localhost:9753/conversations/test3";
    var client, requests;

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
        it("Should setup the _models.messages", function() {
            expect(client._models.messages).toEqual({});
        });
    });

    describe("The cleanup() method", function() {
        afterEach(function() {
            client._models.channels = client._models.messages = client._models.conversations = client._models.queries = client._models.identities = {};
        });

        it("Should destroy all Messages", function() {
            // Setup
            var conversation = client.createConversation({
                participants: ["a"]
            });
            var message = conversation.createMessage("Hi").send();
            conversation.lastMessage = null;
            message.conversationId = "c1";

            // Pretest
            expect(client._models.messages[message.id]).toBe(message);

            // Run
            client._cleanup();

            // Posttest
            expect(message.isDestroyed).toBe(true);
            expect(client._models.messages).toBe(null);
        });
    });

    describe("The getMessage() method", function() {
        var conversation;
        var message;
        beforeEach(function() {
            conversation = client.createConversation({
                participants: ["a"]
            });
            message = conversation.createMessage("hello").send();
        });

        it("Should get by id", function() {
            expect(client.getMessage(message.id)).toBe(message);
        });

        it("Should load Message by id", function() {
            var newId = message.id + "a";
            var m1 = client.getMessage(newId, true);

            // Posttest
            expect(m1 instanceof layer.Message).toBe(true);
            expect(m1.id).toEqual(newId);
            expect(requests.mostRecent().url).toEqual(client.url + newId.replace(/layer\:\/\//, ""));
        });

        it("Should load Announcement by id", function() {
            var newId = message.id.replace(/messages/, 'announcements');
            var m1 = client.getMessage(newId, true);

            // Posttest
            expect(m1 instanceof layer.Announcement).toBe(true);
            expect(m1.id).toEqual(newId);
            expect(requests.mostRecent().url).toEqual(client.url + newId.replace(/layer\:\/\//, ""));
        });

        it("Should fail without id", function() {
            expect(function() {
                client.getMessage(5);
            }).toThrowError(layer.LayerError.dictionary.idParamRequired);
            expect(layer.LayerError.dictionary.idParamRequired.length > 0).toBe(true);
        });

        it("Should not load if not ready", function() {
            requests.reset();
            client.isReady = false;
            var newId = message.id + "a";
            spyOn(client, 'xhr');
            client.getMessage(newId, true);
            expect(client.xhr).not.toHaveBeenCalled();
            client._clientReady();
            expect(client.xhr).toHaveBeenCalled();
        });
    });

    describe("The _addMessage() method", function() {
        var conversation;
        var message;
        beforeEach(function() {
            conversation = client.createConversation({
                participants: ["a"]
            });
            message = conversation.createMessage("hello").send();
        });

        it("Should register a Message in _models.messages", function() {
            // Setup
            client._models.messages = {};

            // Run
            client._addMessage(message);

            // Posttest
            expect(client.getMessage(message.id)).toBe(message);
        });

        it("Should fire messages:add", function() {
            // Setup
            spyOn(client, "_triggerAsync");
            client._models.messages = {};

            // Run
            client._addMessage(message);

            // Posttest
            expect(client._triggerAsync)
                .toHaveBeenCalledWith("messages:add", {
                    messages: [message]
                });
        });

        it("Should not do anything if the Message is already added", function() {
            // Setup
            var m = conversation.createMessage("b").send();
            m.id = message.id;
            spyOn(client, "_triggerAsync");

            // Run
            client._addMessage(m);

            // Posttest
            expect(client.getMessage(m.id)).toBe(message);
            expect(client._triggerAsync).not.toHaveBeenCalled();
        });

        it("Should update conversation lastMessage if position is greater than last Position", function() {
            // Setup
            conversation.lastMessage = conversation.createMessage("Hey");
            message.position = 10;
            client._models.messages = {};


            // Run
            client._addMessage(message);

            // Posttest
            expect(conversation.lastMessage).toBe(message);
        });

        it("Should update conversation lastMessage if no lastMessage", function() {
            // Setup
            conversation.lastMessage = null;
            client._models.messages = {};

            // Run
            client._addMessage(message);

            // Posttest
            expect(conversation.lastMessage).toBe(message);
        });

        it("Should call _scheduleCheckAndPurgeCache if no Conversation found", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");
            message.conversationId = '';
            client._models.messages = {};

            // Run
            client._addMessage(message);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).toHaveBeenCalledWith(message);
        });

        it("Should not call _scheduleCheckAndPurgeCache if Conversation found and no lastMessage", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");
            client._models.messages = {};
            var c = message.getConversation();
            c.lastMessage = null;

            // Run
            client._addMessage(message);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).not.toHaveBeenCalled();
        });

        it("Should call _scheduleCheckAndPurgeCache on prior lastMessage", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");
            var lastMessage = conversation.lastMessage;
            lastMessage.position = 1;

            client._models.messages = {};
            client._models.messages[lastMessage.id] = lastMessage;
            var m = conversation.createMessage("Hi");
            m.position = 2;

            // Run
            client._addMessage(m);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).toHaveBeenCalledWith(lastMessage);
        });

        it("Should not call _scheduleCheckAndPurgeCache if no lastMessage", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");
            conversation.lastMessage = null;
            client._models.messages = {};

            // Run
            client._addMessage(message);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).not.toHaveBeenCalled();
        });
    });

    describe("The _removeMessage() method", function() {
        var conversation;
        var message;
        beforeEach(function() {
            conversation = client.createConversation({
                participants: ["a"]
            });
            message = conversation.createMessage("hello").send();
        });

        it("Should deregister a Message", function() {
            // Pretest
            var hash = {};
            hash[message.id] = message;
            expect(client._models.messages).toEqual(hash);

            // Run
            client._removeMessage(message);

            // Posttest
            expect(client._models.messages).toEqual({});
        });

        it("Should trigger event on removing Message", function() {
            // Setup
            spyOn(client, "_triggerAsync");

            // Run
            client._removeMessage(message);

            // Posttest
            expect(client._triggerAsync).toHaveBeenCalledWith(
                "messages:remove", {
                    messages: [message]
                }
            );
        });


        it("Should do nothing if Message not registered", function() {
            // Setup
            var m = conversation.createMessage("h").send();
            delete client._models.messages[m.id];
            spyOn(client, "trigger");

            // Pretest
            expect(client.getMessage(m.id)).toEqual(null);

            // Run
            client._removeMessage(m);

            // Posttest
            expect(client.trigger).not.toHaveBeenCalled();
        });

        it("Should allow a message to be sent and receive a position after a message has been removed", function() {
            var m = conversation.createMessage("h").send();
            var position = m.position = 100;

            // Run
            client._removeMessage(m);
            var m2 = conversation.createMessage("hello").send();

            // Posttest
            expect(conversation.lastMessage).toBe(m2);
            expect(m2.position).toEqual(101);
        });
    });
});