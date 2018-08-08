/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Identities Mixin", function() {
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
      it("Should initialize _models.identities", function() {
        var identityHash = {};
        identityHash[client.user.id] = client.user;
        identityHash[userIdentity2.id] = userIdentity2;
        expect(client._models.identities).toEqual(identityHash);
      });
    });

    describe("The cleanup() method", function() {
      afterEach(function() {
          client._models.channels = client._models.messages = client._models.conversations = client._models.queries = client._models.identities = {};
      });

      it("Should destroy all Identities", function() {
        // Setup
        var userIdentity4 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/2",
            displayName: "userIdentity4"
        });
        client._models.identities[userIdentity.id] = userIdentity;

        // Run
        client._cleanup();

        // Posttest
        expect(userIdentity.isDestroyed).toBe(true);
        expect(client._models.identities).toBe(null);
      });
    });

    describe("The getIdentity() method", function() {
      var userIdentity3;
      beforeEach(function() {
          userIdentity3 = new layer.Identity({
              clientId: client.appId,
              id: "layer:///identities/2",
              displayName: "userIdentity3"
          });
          client._models.identities = {
              "layer:///identities/1": userIdentity2,
              "layer:///identities/2": userIdentity3
          };


      });

      it("Should get the user by ID", function() {
          expect(client.getIdentity(userIdentity2.id)).toBe(userIdentity2);
      });

      it("Should get the user by UserID", function() {
          expect(client.getIdentity(userIdentity2.userId)).toBe(userIdentity2);
      });

      it("Should get the userIdentity3 by ID", function() {
          expect(client.getIdentity(userIdentity3.id)).toBe(userIdentity3);
      });

      it("Should load the identity if canLoad was used", function() {
          var identity = client.getIdentity('222', true);
          expect(requests.mostRecent().url).toEqual(client.url + '/identities/222');
          expect(identity.syncState).toEqual(layer.Constants.SYNC_STATE.LOADING);
      });

      it("Should require an ID", function() {
          expect(function() {
              client.getIdentity(55);
          }).toThrowError(layer.LayerError.dictionary.idParamRequired);
      });
  });

  describe("The _addIdentity() method", function() {
      beforeEach(function() {
        client._loadPresenceIds = [];
      });

      it("Should not add a UserIdentity that already exists", function() {
          // Setup
          client._models.identities = {};
          client._models.identities[userIdentity.id] = userIdentity;
          userIdentity2.id = userIdentity.id;
          expect(userIdentity).not.toBe(userIdentity2);

          // Run
          client._addIdentity(userIdentity2);

          // Posttest
          var endHash = {};
          endHash[userIdentity.id] = userIdentity;
          expect(client._models.identities).toEqual(endHash);
      });

      it("Should add a UserIdentity and trigger identities:add", function() {
          // Setup
          client._models.identities = {};
          spyOn(client, "_triggerAsync");

          // Run
          client._addIdentity(userIdentity);

          // Posttest
          var endHash = {};
          endHash[userIdentity.id] = userIdentity;
          expect(client._models.identities).toEqual(endHash);
          expect(client._triggerAsync).toHaveBeenCalledWith('identities:add', {identities: [userIdentity]});
      });

      it("Should not add an Identity only a display_name", function() {
          // Setup
          client._models.identities = {};
          userIdentity  = new layer.Identity({
              client: client,
              fromServer: {
                  display_name: "Fred"
              }
          });

          // Run
          client._addIdentity(userIdentity);

          // Posttest
          expect(client._models.identities).toEqual({});
      });

      it("Should queue up the Identity in _loadPresenceIds", function() {
        userIdentity  = new layer.Identity({
              client: client,
              fromServer: {
                  id: "layer:///identities/fred",
                  display_name: "Fred"
              }
          });
          expect(client._loadPresenceIds).toEqual([userIdentity.id]);
      });

      it("Should schedule call to _loadPresence if _loadPresenceIds is empty", function() {
        spyOn(client, "_loadPresence");
        expect(client._loadPresenceIds).toEqual([]);
        userIdentity  = new layer.Identity({
              client: client,
              fromServer: {
                  display_name: "Fred"
              }
          });
        expect(client._loadPresence).not.toHaveBeenCalled();
        jasmine.clock().tick(1000);
        expect(client._loadPresence).toHaveBeenCalledWith();
        expect(client._loadPresence.calls.count()).toEqual(1);
      });

      it("Should schedule not call to _loadPresence if _loadPresenceIds is not empty", function() {
        spyOn(client, "_loadPresence");
        expect(client._loadPresenceIds).toEqual([]);
        userIdentity  = new layer.Identity({
            client: client,
            fromServer: {
                display_name: "Fred"
            }
        });
        jasmine.clock().tick(10);
        var userIdentity2  = new layer.Identity({
            client: client,
            fromServer: {
                display_name: "Fred2"
            }
        });
        jasmine.clock().tick(10);
        var userIdentity2  = new layer.Identity({
            client: client,
            fromServer: {
                display_name: "Fred3"
            }
        });
        expect(client._loadPresence).not.toHaveBeenCalled();
        jasmine.clock().tick(1000);
        expect(client._loadPresence).toHaveBeenCalledWith();
        expect(client._loadPresence.calls.count()).toEqual(1);
      });
  });

  describe("The _removeIdentity() method", function() {
      var userIdentity4;
      beforeEach(function() {
          userIdentity4 = new layer.Identity({
              clientId: client.appId,
              id: "layer:///identities/2",
              displayName: "userIdentity4"
          });
          client._models.identities = {};
          client._models.identities[userIdentity.id] = userIdentity;
          client._models.identities[userIdentity4.id] = userIdentity4;
      });

      it("Should ignore IDS not cached", function() {
          var ident = new layer.Identity({
              id: "layer:///identities/fooled-you",
              clientId: client.appId
          });
          delete client._models.identities[ident.id];
          client._removeIdentity(ident);

          // Posttest
          var endTest = {};
          endTest[userIdentity.id] = userIdentity;
          endTest[userIdentity4.id] = userIdentity4;
          expect(client._models.identities).toEqual(endTest);
      });

      it("Should remove UserIdentity and trigger identities:remove", function() {
          spyOn(client, "_triggerAsync");
          client._removeIdentity(userIdentity);
          var endTest = {};
          endTest[userIdentity4.id] = userIdentity4;
          expect(client._models.identities).toEqual(endTest);
          expect(client._triggerAsync).toHaveBeenCalledWith('identities:remove', {identities: [userIdentity]});
      });
  });

  describe("The _loadPresence() method", function() {
    it("Should clear _loadPresenceIds", function() {
        client._loadPresenceIds = ['a','b','c'];
        client._loadPresence();
        expect(client._loadPresenceIds).toEqual([]);
    });

    it("Should request all queued ids", function() {
        spyOn(client.syncManager, 'request');
        client._loadPresenceIds = ['a','b','c'];
        client._loadPresence();
        expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.any(layer.WebsocketSyncEvent));
        var syncEvent = client.syncManager.request.calls.allArgs()[0][0];
        expect(syncEvent.returnChangesArray).toBe(true);
        expect(syncEvent.data).toEqual({
            method: 'Presence.sync',
            data: {
                ids: ['a','b','c']
            }
        });
    });
  });


    describe("The followIdentity() method", function() {
        it("Should call follow() on an existing Identity", function() {
            client._models.identities[userIdentity.id] = userIdentity;
            spyOn(userIdentity, "follow");

            // Run
            var result1 = client.followIdentity(userIdentity.userId);
            var result2 = client.followIdentity(userIdentity.id);

            // Posttest
            expect(userIdentity.follow.calls.count()).toEqual(2);
            expect(result1).toBe(userIdentity);
            expect(result2).toBe(userIdentity);
        });

        it("Should call follow() on a new Identity", function() {
            var tmp = layer.Identity.prototype.follow;
            spyOn(layer.Identity.prototype, "follow");

            // Run
            var result1 = client.followIdentity("123");

            // Posttest
            expect(layer.Identity.prototype.follow.calls.count()).toEqual(1);
            expect(result1.id).toEqual("layer:///identities/123");
        });
    });

    describe("The unfollowIdentity() method", function() {
        it("Should call unfollow() on an existing Identity", function() {
            client._models.identities[userIdentity.id] = userIdentity;
            spyOn(userIdentity, "unfollow");

            // Run
            var result1 = client.unfollowIdentity(userIdentity.userId);
            var result2 = client.unfollowIdentity(userIdentity.id);

            // Posttest
            expect(userIdentity.unfollow.calls.count()).toEqual(2);
            expect(result1).toBe(userIdentity);
            expect(result2).toBe(userIdentity);
        });

        it("Should call unfollow() on a new Identity", function() {
            var tmp = layer.Identity.prototype.unfollow;
            spyOn(layer.Identity.prototype, "unfollow");

            // Run
            var result1 = client.unfollowIdentity("321");

            // Posttest
            expect(layer.Identity.prototype.unfollow.calls.count()).toEqual(1);
            expect(result1.id).toEqual("layer:///identities/321");
        });

    });
});
