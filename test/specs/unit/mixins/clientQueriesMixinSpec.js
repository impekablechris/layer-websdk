/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Queries Mixin", function() {
    var appId = "Fred's App";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";
    var cid1 = "layer:///conversations/test1",
        cid2 = "layer:///conversations/test2",
        cid3 = "layer:///conversations/test3",
        url1 = "http://localhost:9753/conversations/test1",
        url2 = "http://localhost:9753/conversations/test2",
        url3 = "http://localhost:9753/conversations/test3";
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
          delete client._models.identities['layer:///identities/Frodo'];
          client.user = new layer.Identity({
              userId: client.userId,
              displayName: "Frodo2",
              syncState: layer.Constants.SYNC_STATE.LOADING,
              clientId: client.appId,

          });

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
      it("Should setup the _models.queries", function() {
        expect(client._models.queries).toEqual({});
      });
    });

    describe("The cleanup() method", function() {
      afterEach(function() {
          client._models.channels = client._models.messages = client._models.conversations = client._models.queries = client._models.identities = {};
      });

      it("Should destroy all Queries", function() {
          // Setup
          client._clientAuthenticated();
          client._clientReady();
          var query = client.createQuery({});

          // Pretest
          expect(client._models.queries[query.id]).toBe(query);

          // Run
          client._cleanup();

          // Posttest
          expect(query.isDestroyed).toBe(true);
          expect(client._models.queries).toBe(null);
      });

    });

    describe("The createQuery() method", function() {
          beforeEach(function() {
            client._clientReady();
          });
          it("Should return a Query from options", function() {
              var query = client.createQuery({
                  model: "Conversation"
              });

              expect(query).toEqual(jasmine.any(layer.Query));
              expect(query.client).toBe(client);
              expect(query.model).toEqual("Conversation");
          });

          it("Should return a Query from QueryBuilder", function() {
              var query = client.createQuery(layer.QueryBuilder.conversations());

              expect(query).toEqual(jasmine.any(layer.Query));
              expect(query.client).toBe(client);
              expect(query.model).toEqual("Conversation");
          });

          it("Should call _addQuery", function() {
              spyOn(client, "_addQuery");
              var query = client.createQuery({
                  model: "Conversation"
              });
              expect(client._addQuery).toHaveBeenCalledWith(query);
          });
      });



    describe("The getQuery() method", function() {
        beforeEach(function() {
          client._clientReady();
        });
        it("Should throw an error if an invalid id is passed in", function() {
            expect(function() {
                client.getQuery(5);
            }).toThrowError(layer.LayerError.dictionary.idParamRequired);
            expect(layer.LayerError.dictionary.idParamRequired.length > 0).toEqual(true);
        });

        it("Should return a Query if it exists", function() {
            var q = client.createQuery({
                model: "Conversation"
            });
            expect(client.getQuery(q.id)).toBe(q);
        });

        it("Should return undefined if it does not exist", function() {
            var q = client.createQuery({
                model: "Conversation"
            });
            expect(client.getQuery(q.id + "1")).toBe(null);
        });
    });

    describe("The _removeQuery() method", function() {
        var query, c1, c2, c3;
        beforeEach(function() {
            client._clientReady();
            query = client.createQuery({model: "Conversation"});
            c1 = client.createConversation({ participants: ["a"] });
            c2 = client.createConversation({ participants: ["b"] });
            c3 = client.createConversation({ participants: ["c"] });
            query.data = [c1, c2, c3];
        });

        it("Should call _checkAndPurgeCache with Conversations that are registered", function() {
            spyOn(client, "_checkAndPurgeCache");
            delete client._models.conversations[c2.id];
            client._removeQuery(query);
            expect(client._checkAndPurgeCache).toHaveBeenCalledWith([c1, c3]);
        });

        it("Should remove the query from cache", function() {
            expect(client.getQuery(query.id)).toBe(query);
            client._removeQuery(query);
            expect(client.getQuery(query.id)).toBe(null);
        });

        it("Should do nothing if no query", function() {
            expect(function() {
                client._removeQuery();
            }).not.toThrow();
        });
    });

});