/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Channel Mixin", function() {
    var appId = "Fred's App";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";
    var cid1 = "layer:///channels/test1",
        url1 = "http://localhost:9753/channels/test1";
    var client, requests, userIdentity, userIdentity2;

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
        it("Should setup _models.channels", function() {
           expect(client._models.channels).toEqual({});
        });
    });

    describe("The cleanup() method", function() {
        afterEach(function() {
            client._models.conversations = client._models.messages = client._models.channels = client._models.queries = client._models.identities = {};
        });

        it("Should destroy all channels", function() {
          // Setup
          var channel = client.createChannel({ members: ["a"] });

          // Pretest
          expect(client._models.channels[channel.id]).toBe(channel);

          // Run
          client._cleanup();

          // Posttest
          expect(channel.isDestroyed).toBe(true);
          expect(client._models.channels).toBe(null);

      });
    });

    describe("The getChannel() method", function() {
        var channel;
        beforeEach(function() {
            channel = new layer.Channel({
                client: client,
                fromServer: {
                    id: "layer:///channels/" + layer.Util.generateUUID(),
                    membership: {
                        is_member: true
                    }
                }
            });
        });
        it("Should get by id", function() {
            expect(client.getChannel(channel.id)).toBe(channel);
        });

        it("Should load by id", function() {
            var c1 = client.getChannel(cid1, true);

            // Posttest
            expect(c1 instanceof layer.Channel).toBe(true);

            expect(c1.id).toEqual(cid1);
            expect(requests.mostRecent().url).toEqual(url1);
        });

        it("Should fail without id", function() {
            expect(function() {
                client.getChannel(5);
            }).toThrowError(layer.LayerError.dictionary.idParamRequired);
            expect(layer.LayerError.dictionary.idParamRequired.length > 0).toBe(true);
        });
    });

    describe("The _addChannel() method", function() {


        it("Should register a channel in _models.channels", function() {
            client._models.channels = {};
            var c = new layer.Channel({
                client: client
            });

            // Run
            client._addChannel(c);

            // Posttest
            expect(client.getChannel(c.id)).toBe(c);
        });

        it("Should set the clientId property", function() {
            // Setup
            var c = new layer.Channel({
                client: client
            });

            // Pretest
            expect(c.clientId).toEqual(client.appId);

            // Run
            client._addChannel(c);

            // Posttest
            expect(c.clientId).toEqual(client.appId);
        });

        it("Should fire channels:add", function() {
            // Setup
            spyOn(client, "_triggerAsync");

            // Run
            var c = new layer.Channel({
                client: client,
            });
            client._addChannel(c);

            // Posttest
            expect(client._triggerAsync)
            .toHaveBeenCalledWith("channels:add", {channels: [c]});
        });

        it("Should not do anything if the channel is already added", function() {
            // Setup
            var c = new layer.Channel({
                client: client
            });
            client._addChannel(c);
            spyOn(client, "_triggerAsync");


            // Run
            var c2 = new layer.Channel({
                id: c.id,
                client: client
            });
            client._addChannel(c2);

            // Posttest
            expect(client.getChannel(c.id)).toBe(c);
            expect(client._triggerAsync).not.toHaveBeenCalled();
        });

        it("Should call _scheduleCheckAndPurgeCache", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");

            // Run
            var c = new layer.Channel({
                client: client
            });
            client._addChannel(c);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).toHaveBeenCalledWith(c);
        });
    });

    describe("The _removeChannel() method", function() {

        it("Should deregister a channel", function() {
            // Setup
            var c1 = client.createChannel({ members: ["a"] });

            // Pretest
            var hash = {};
            hash[c1.id] = c1;
            expect(client._models.channels).toEqual(hash);

            // Run
            client._removeChannel(c1);

            // Posttest
            delete hash[c1.id];
            expect(client._models.channels).toEqual(hash);
        });

        it("Should trigger event on removing channel", function() {
            // Setup
            var c1 = new layer.Channel({
                client: client
            });
            client._addChannel(c1);
            spyOn(client, "_triggerAsync");

            // Run
            client._removeChannel(c1);

            // Posttest
            expect(client._triggerAsync).toHaveBeenCalledWith(
                "channels:remove", {
                    channels: [c1]
                }
            );
        });


        it("Should do nothing if channel not registered", function() {
            // Setup
            var c1 = new layer.Channel({
                client: client
            });
            client._models.channels = {};
            spyOn(client, "trigger");

            // Pretest
            expect(client.getChannel(c1.id)).toEqual(null);

            // Run
            client._removeChannel(c1);

            // Posttest
            expect(client.trigger).not.toHaveBeenCalled();
        });

        it("Should destroy any Messages associated with the channel", function() {
            // Setup
            var c1 = client.createChannel({ members: ["a"] });
            var m1 = c1.createMessage("a").send();
            var m2 = c1.createMessage("b").send();
            var m3 = c1.createMessage("c").send();
            var c2 = client.createChannel({ members: ["b"] });
            var m4 = c2.createMessage("a").send();

            // Pretest
            expect(Object.keys(client._models.messages))
                .toEqual(jasmine.arrayContaining([m1.id, m2.id, m3.id, m4.id]));

            // Run
            client._removeChannel(c1);

            // Posttest
            expect(Object.keys(client._models.messages)).toEqual(jasmine.arrayContaining([m4.id]));
        });
    });

    describe("The _updateChannelId() method", function() {
        it("Should register the channel under the new id", function() {
            // Setup
            var c1 = new layer.Channel({
                client: client
            });
            client._addChannel(c1);
            var c1id = c1.id;

            // Run
            c1.id = "layer:///channels/fred";
            client._updateChannelId(c1, c1id);

            // Posttest
            expect(client.getChannel("layer:///channels/fred")).toBe(c1);
        });

        it("Should delete the old id", function() {
            // Setup
            var c1 = new layer.Channel({
                client: client
            });
            client._addChannel(c1);
            var c1id = c1.id;

            // Pretest
            expect(client.getChannel(c1id)).toBe(c1);

            // Run
            c1.id = "layer:///channels/fred";
            client._updateChannelId(c1, c1id);

            // Posttest
            expect(client._models.channels[c1id]).toBe(undefined);
        });

        it("Should update all Message conversationIds", function() {
            // Setup
            var c1 = new layer.Channel({
                members: ["a"],
                client: client
            });
            client._addChannel(c1);
            var m1 = c1.createMessage("Hey").send();
            var m2 = c1.createMessage("Ho").send();
            var c1id = c1.id;

            // Pretest
            expect(m1.conversationId).toEqual(c1id);
            expect(m2.conversationId).toEqual(c1id);

            // Run
            c1.id = "layer:///channels/fred";
            client._updateChannelId(c1, c1id);

            // Posttest
            expect(m1.conversationId).toEqual("layer:///channels/fred");
            expect(m2.conversationId).toEqual("layer:///channels/fred");
        });
    });

    describe("The findCachedChannel() method", function() {
        var c1, c2, c3;
        beforeEach(function() {
            c1 = client.createChannel({
                members: ["a"],
                metadata: {
                    b: "c"
                }
            });
            c2 = client.createChannel({
                name: 'FrodoLordOfEarth',
                members: ["b"],
                metadata: {
                    d: "e"
                }
            });
            c3 = client.createChannel({
                members: ["c"]
            });

        });

        it("Should call the callback with each channel", function() {
            // Setup
            var spy = jasmine.createSpy('spy');

            // Run
            client.findCachedChannel(spy);

            // Posttest
            expect(spy).toHaveBeenCalledWith(c1, 0);
            expect(spy).toHaveBeenCalledWith(c2, 1);
            expect(spy).toHaveBeenCalledWith(c3, 2);
        });

        it("Should call the callback with correct context", function() {
            // Setup
            var d = new Date();

            // Run
            client.findCachedChannel(function(channel) {
                expect(this).toBe(d);
            }, d);
        });

        it("Should return undefined if no matches", function() {
            // Run
            var result = client.findCachedChannel(function(channel) {
                return false;
            });

            // Posttest
            expect(result).toBe(null);
        });

        it("Should return matching channel", function() {
            // Setup
            var identity = client.getIdentity("b");

            // Run
            var result = client.findCachedChannel(function(channel) {
                return channel.name === 'FrodoLordOfEarth';
            });

            // Posttest
            expect(result).toBe(c2);
        });
    });

    describe("The createChannel() method", function() {
        var createMethod;
        beforeEach(function() {
            createMethod = layer.Channel.create;
            spyOn(layer.Channel, "create").and.returnValue(5);
        });

        afterEach(function() {
            layer.Channel.create = createMethod;
        });

        it("Should create a channel with a full object and strings", function() {
            // Run
            var c = client.createChannel({members: ["a","z"]});

            // Posttest
            expect(layer.Channel.create).toHaveBeenCalledWith({
                members: ["a", "z"],
                private: false,
                client: client
            });
        });

        it("Should create a channel with a full object and identities", function() {
            // Run
            var c = client.createChannel({members: [userIdentity, userIdentity2]});

            // Posttest
            expect(layer.Channel.create).toHaveBeenCalledWith({
                members: [userIdentity, userIdentity2],
                private: false,
                client: client
            });
        });

        it("Should create a channel with a full object", function() {
            // Run
            var c = client.createChannel({
                members: ["a","z"],
                private: true
            });

            // Posttest
            expect(layer.Channel.create).toHaveBeenCalledWith({
                members: ["a", "z"],
                private: true,
                client: client
            });
        });

        it("Should return the new channel", function() {
            // Run
            var c = client.createChannel({ members: ["a","z"] });

            // Posttest
            expect(c).toEqual(5);
        });

        it("Should throw an error if not authenticated", function() {
            client.isAuthenticated = false;
            expect(function() {
                client.createChannel({members: [userIdentity, userIdentity2]});
            }).toThrowError(layer.LayerError.dictionary.clientMustBeReady);
            expect(layer.LayerError.dictionary.clientMustBeReady.length > 0).toEqual(true);
        });
    });
});
