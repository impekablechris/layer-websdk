/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Members Mixin", function() {
    var appId = "Fred's App";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";
    var client, requests, userIdentity;

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
        it("Should setup _models.members", function() {
           expect(client._models.members).toEqual({});
        });
    });

    describe("The cleanup() method", function() {
        afterEach(function() {
            client._models.conversations = client._models.messages = client._models.channels = client._models.members = client._models.queries = client._models.identities = {};
        });

        it("Should destroy all channels", function() {
          // Setup
          var membership = client._createObject(responses.membership1);

          // Pretest
          expect(client._models.members[membership.id]).toBe(membership);

          // Run
          client._cleanup();

          // Posttest
          expect(membership.isDestroyed).toBe(true);
          expect(client._models.members).toBe(null);
      });

      it("Should not throw errors on unknown ids", function() {
          client._models.members["frodo"] = null;
          client._cleanup();
          expect(client._models.members).toBe(null);
      });
    });

    describe("The getMember() method", function() {
        var membership;
        beforeEach(function() {
            membership = client._createObject(responses.membership1);
        });
        it("Should get by id", function() {
            expect(client.getMember(membership.id)).toBe(membership);
        });

        it("Should load by id", function() {
            client._models.members = {};
            var m1 = client.getMember(membership.id, true);

            // Posttest
            expect(m1 instanceof layer.Membership).toBe(true);
            expect(m1.id).toEqual(responses.membership1.id);
            expect(requests.mostRecent().url).toEqual(responses.membership1.url);
        });

        it("Should fail without id", function() {
            expect(function() {
                client.getMember(5);
            }).toThrowError(layer.LayerError.dictionary.idParamRequired);
            expect(layer.LayerError.dictionary.idParamRequired.length > 0).toBe(true);
        });
    });

    describe("The _addMembership() method", function() {
        var membership;
        beforeEach(function() {
            membership = client._createObject(responses.membership1);
        });
        it("Should register a member in _models.members", function() {
            client._models.members = {};

            // Run
            client._addMembership(membership);

            // Posttest
            expect(client.getMember(membership.id)).toBe(membership);
        });

        it("Should set the clientId property", function() {
            // Setup
            var m = new layer.Membership({
                client: client
            });

            // Pretest
            expect(m.clientId).toEqual(client.appId);

            // Run
            client._addMembership(m);

            // Posttest
            expect(m.clientId).toEqual(client.appId);
        });

        it("Should fire members:add", function() {
            // Setup
            spyOn(client, "_triggerAsync");
            client._models.members = {};

            // Run
            client._addMembership(membership);

            // Posttest
            expect(client._triggerAsync)
                .toHaveBeenCalledWith("members:add", {members: [membership]});
        });

        it("Should not do anything if the member is already added", function() {

            client._addMembership(membership);
            spyOn(client, "_triggerAsync");


            // Run
            client._addMembership(membership);

            // Posttest
            expect(client.getMember(membership.id)).toBe(membership);
            expect(client._triggerAsync).not.toHaveBeenCalled();
        });

        it("Should call _scheduleCheckAndPurgeCache", function() {
            spyOn(client, "_scheduleCheckAndPurgeCache");
            client._models.members = {};

            // Run
            client._addMembership(membership);

            // Posttest
            expect(client._scheduleCheckAndPurgeCache).toHaveBeenCalledWith(membership);
        });
    });

    describe("The _removeMembership() method", function() {

        it("Should deregister a member", function() {
            // Setup
            var membership = client._createObject(responses.membership1);

            // Pretest
            var hash = {};
            hash[membership.id] = membership;
            expect(client._models.members).toEqual(hash);

            // Run
            client._removeMembership(membership);

            // Posttest
            delete hash[membership.id];
            expect(client._models.members).toEqual(hash);
        });

        it("Should trigger event on removing membership", function() {
            // Setup
            client._addMembership(membership);
            spyOn(client, "_triggerAsync");

            // Run
            client._removeMembership(membership);

            // Posttest
            expect(client._triggerAsync).toHaveBeenCalledWith(
                "members:remove", {
                    members: [membership]
                }
            );
        });


        it("Should do nothing if membership not registered", function() {
            // Setup
            var membership = client._createObject(responses.membership1);
            client._models.members = {};
            spyOn(client, "trigger");

            // Pretest
            expect(client.getMember(membership.id)).toEqual(null);

            // Run
            client._removeMembership(membership);

            // Posttest
            expect(client.trigger).not.toHaveBeenCalled();
        });
    });
});
