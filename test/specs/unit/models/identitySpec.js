/*eslint-disable */

describe("The Identity Class", function() {
    var appId = "Fred's App";

    var client,
        identity,
        basicIdentity,
        serviceIdentity,
        dbManager,
        requests;

function deleteTables(done) {
      client.dbManager._loadAll('messages',  function(results) {
        client.dbManager.deleteObjects('messages', results, function() {
          client.dbManager._loadAll('identities',  function(results) {
            client.dbManager.deleteObjects('identities', results, function() {
              client.dbManager._loadAll('conversations',  function(results) {
                client.dbManager.deleteObjects('conversations', results, function() {
                  done();
                });
              });
            });
          });
        });
      });

    }

    beforeEach(function(done) {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        client = new layer.Client({
            appId: appId,
            url: "http://localhost:9753",
            isTrustedDevice: true
        });
        client.sessionToken = "sessionToken";
        var userId = "Frodo";
        client.user = new layer.Identity({
            clientId: client.appId,
            userId: userId,
            id: "layer:///identities/" + userId,
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
        spyOn(client.dbManager, "claimSyncEvent").and.callFake(function(syncEvent, callback) {
          callback([]);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        client.syncManager.queue = [];
        identity = new layer.Identity({
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
          isFullIdentity: true
        });
        basicIdentity = new layer.Identity({
          clientId: client.appId,
          userId: client.userId + "a",
          id: "layer:///identities/" + client.userId + "a",
          isFullIdentity: false
        });
        serviceIdentity = new layer.Identity({
          clientId: client.appId,
          display_name: "Sauron the Sore",
          id: "layer:///identities/Sauron the Sore"
        });

        dbManager = client.dbManager;
        deleteTables(function() {
          done();
        });
    });

    afterEach(function() {
        client.destroy();
        jasmine.clock().uninstall();
        jasmine.Ajax.uninstall();
    });

    describe("The Identity class", function() {

      describe("The constructor() method", function() {
        it("Should call populateFromServer if fromServer", function() {
          var populateFromServer = layer.Identity.prototype._populateFromServer;
          spyOn(layer.Identity.prototype, "_populateFromServer");
          new layer.Identity({
            fromServer: {
              id: "hey"
            },
            id: "hey",
            client: client
          });

          // Posttest
          expect(layer.Identity.prototype._populateFromServer).toHaveBeenCalledWith({id: "hey"});

          // Cleanup
          layer.Identity.prototype._populateFromServer = populateFromServer;
        });

        it("Should fail if no client or clientId", function() {
          expect(function() {
            new layer.Identity({});
          }).toThrowError(layer.LayerError.dictionary.clientMissing);
        });

        it("Should work if client", function() {
          new layer.Identity({
            client: client
          });
        });

        it("Should work if clientId", function() {
          new layer.Identity({
            clientId: client.appId
          });
        });

        it("Should set a URL if none provided", function() {
          expect(new layer.Identity({
            userId: "frodo",
            client: client
          }).url).toEqual(client.url + '/identities/frodo');
        });

        it("Should decode a userId", function() {
          expect(new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/auth0%7Cabc"
          }).userId).toEqual("auth0|abc");
        });

        it("Should call client._addIdentity", function() {
          spyOn(client, "_addIdentity");
          var identity = new layer.Identity({
            userId: "frodo",
            client: client
          })
          expect(client._addIdentity).toHaveBeenCalledWith(identity);
        });

        it("Should not register deprecated non-ided identities", function() {
          var oldIdentity = new layer.Identity({
            clientId: client.appId,
            fromServer: {
              display_name: "Sauron the Sore"
            }
          });
          expect(oldIdentity.id).toEqual('');
          expect(client._models.identities[oldIdentity.id]).toBe(undefined);
        });

        it("Should always initialize the presence object", function() {
          var i1 = new layer.Identity({client: client});
          expect(i1._presence).toEqual({
            status: null,
            lastSeenAt: null
          });

          var i2 = layer.Identity._createFromServer(responses.useridentity, client);
          expect(i2._presence).toEqual({
            status: null,
            lastSeenAt: null
          });

          expect(i1.status).toEqual('offline');
          expect(i2.status).toEqual('offline');
        });
      });

      describe("The _populateFromServer() method", function() {
        var identity;
        beforeEach(function() {
          identity = new layer.Identity({
            client: client
          });
        });

        it("Should call _setSynced", function() {
          spyOn(identity, "_setSynced");
          identity._populateFromServer({
            displayName: "Frodo"
          });
          expect(identity._setSynced).toHaveBeenCalledWith();
        });

        it("Should update all properties", function() {
          identity._populateFromServer({
            display_name: "a",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          });
          expect(identity.displayName).toEqual("a");
          expect(identity.firstName).toEqual("b");
          expect(identity.lastName).toEqual("c");
          expect(identity.phoneNumber).toEqual("d");
          expect(identity.emailAddress).toEqual("e");
          expect(identity.metadata).toEqual({hey: "ho"});
          expect(identity.publicKey).toEqual("h");
          expect(identity.userId).toEqual("i");
        });

        it("Should trigger change events for changed properties", function() {
          var lastSeenAt = new Date();
          identity.lastName = "c";
          identity.emailAddress = "e";
          spyOn(identity, "_triggerAsync");
          identity._populateFromServer({
            display_name: "a",
            avatar_url: "z",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith("identities:change", {
            property: "displayName",
            oldValue: '',
            newValue: 'a'
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith("identities:change", {
            property: "avatarUrl",
            oldValue: '',
            newValue: 'z'
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith("identities:change", {
            property: "firstName",
            oldValue: '',
            newValue: 'b'
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith("identities:change", {
            property: "phoneNumber",
            oldValue: '',
            newValue: 'd'
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith("identities:change", {
            property: "metadata",
            oldValue: {},
            newValue: {hey: "ho"}
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith("identities:change", {
            property: "publicKey",
            oldValue: '',
            newValue: 'h'
          });
          expect(identity._triggerAsync.calls.count()).toEqual(6);
        });

        it("Should set isFullIdentity to true", function() {
          identity._populateFromServer({
            display_name: "a",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          });
          expect(identity.isFullIdentity).toBe(true);

        });

        it("Should set isFullIdentity to false", function() {
          identity._populateFromServer({
            display_name: "a",
            user_id: "i",
            id: "layer:///identities/i"
          });
          expect(identity.isFullIdentity).toBe(false);
        });

        it("Should load Identity from database if not fullIdentity", function() {
          getObjectsResult = [{
            display_name: "a",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          }];

          // Run
          identity._populateFromServer({
            display_name: "a",
            user_id: "i",
            id: "layer:///identities/i"
          });

          // Posttest
          jasmine.clock().tick(101);
          expect(client.dbManager.getObjects).toHaveBeenCalledWith('identities', [identity.id], jasmine.any(Function));
          expect(identity.isFullIdentity).toBe(true);
          expect(identity.metadata).toEqual({hey: "ho"});
        });

        it("Should not load Identity from database if not authenticated", function() {
          getObjectsResult = [{
            display_name: "a",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          }];

          // Run
          identity._populateFromServer({
            display_name: "a",
            user_id: "i",
            id: "layer:///identities/i"
          });

          // Posttest
          jasmine.clock().tick(101);
          expect(client.dbManager.getObjects).toHaveBeenCalledWith('identities', [identity.id], jasmine.any(Function));
          expect(identity.isFullIdentity).toBe(true);
          expect(identity.metadata).toEqual({hey: "ho"});
        });

        it("Should not load Identity from database if already fullIdentity", function() {
          getObjectsResult = [{
            display_name: "a",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          }];
          jasmine.clock().tick(1000); // clear out any incomplete calls
          client.dbManager.getObjects.calls.reset();
          spyOn(identity, "_triggerAsync"); // prevent the trigger method from caus


          // Run
          identity._populateFromServer({
            display_name: "a",
            first_name: "b",
            last_name: "c",
            phone_number: "d",
            email_address: "e",
            metadata: {hey: "ho"},
            public_key: "h",
            user_id: "i",
            id: "layer:///identities/i"
          });

          // Posttest
          jasmine.clock().tick(101);
          expect(client.dbManager.getObjects).not.toHaveBeenCalled();
        });
      });

      describe("The _handlePatchEvent", function() {
        it("Should update lastSeenAt and status and trigger change events", function() {
          spyOn(identity, "_triggerAsync");
          identity._presence.status = 'available';
          identity._presence.last_seen_at = new Date('2020-01-01');
          identity._handlePatchEvent(
            {status: "available", last_seen_at: "2010-01-01"},
            {status: "away", lastSeenAt: new Date("2020-01-01")},
            ['presence.status', 'presence.last_seen_at']);
            expect(identity._presence.status).toEqual('available'); // not updated
            expect(identity._presence.lastSeenAt.toISOString().substring(0, 10)).toEqual('2010-01-01'); // updated
          expect(identity._triggerAsync).toHaveBeenCalledWith('identities:change', {
            property: 'status',
            oldValue: 'away',
            newValue: 'available'
          });
          expect(identity._triggerAsync).toHaveBeenCalledWith('identities:change', {
            property: 'lastSeenAt',
            oldValue: new Date('2020-01-01'),
            newValue: new Date('2010-01-01')
          });
        });

        it("Should not report that status has changed if it hasn't changed, nor should it report changes to only lastSeenAt", function() {
          spyOn(identity, "_triggerAsync");
          identity._presence.status = 'available';
          identity._presence.last_seen_at = new Date('2020-01-01');
          identity._handlePatchEvent(
            {status: "available", last_seen_at: "2010-01-01"},
            {status: "available", lastSeenAt: new Date("2020-02-02")},
            ['presence.status', 'presence.last_seen_at']);

          expect(identity._triggerAsync).not.toHaveBeenCalled();
        });
      });

      describe("The setStatus() method", function() {
        it("Should reject invalid status values", function() {
          expect(function() {
            client.user.setStatus("afraid");
          }).toThrowError(layer.LayerError.dictionary.valueNotSupported);

          expect(function() {
            client.user.setStatus("");
          }).toThrowError(layer.LayerError.dictionary.valueNotSupported);

          expect(function() {
            client.user.setStatus(null);
          }).toThrowError(layer.LayerError.dictionary.valueNotSupported);
        });

        it("Should send the specified presence update", function() {
          spyOn(client, "sendSocketRequest");
          client.user.setStatus("AWAY");
          expect(client.sendSocketRequest).toHaveBeenCalledWith({
            method: 'PATCH',
            body: {
              method: 'Presence.update',
              data: [{operation: 'set', property: 'status', value: 'away'}]
            },
            sync: {
              depends: [client.user.id],
              target: client.user.id
            }
          },
          jasmine.any(Function));
        });

        it("call _updateValue with the new status", function() {
          expect(client.user._presence.status).not.toEqual("AWAY");
          spyOn(client.user, "_updateValue").and.callThrough();;
          client.user.setStatus("AWAY");
          expect(client.user._updateValue).toHaveBeenCalledWith(['_presence', 'status'], 'away');
          expect(client.user._presence.status).toEqual("away");
        });

        it("Should roll back the value on server error", function() {
          client.user._presence.status = "available";
          spyOn(client.user, "_updateValue").and.callThrough();;
          spyOn(client, "sendSocketRequest").and.callFake(function(args, callback) {
            callback({
              success: false,
              data: {id: "frodo"}
            });
          });

          client.user.setStatus("AWAY");
          expect(client.user._updateValue).toHaveBeenCalledWith(['_presence', 'status'], 'available');
        });

        it("Should send offline and set invisible if setting to invisible", function() {
          client.user._presence.status = "available";
          spyOn(client, "sendSocketRequest")
          client.user.setStatus(layer.Identity.STATUS.INVISIBLE);
          expect(client.user.status).toEqual(layer.Identity.STATUS.INVISIBLE);
          expect(client.sendSocketRequest).toHaveBeenCalledWith({
            method: 'PATCH',
            body: {
              method: 'Presence.update',
              data: [{operation: 'set', property: 'status', value: 'offline'}]
            },
            sync: {
              depends: [client.user.id],
              target: client.user.id
            }
          }, jasmine.any(Function));
        });

        it("Should send offline and set invisible if setting to offline", function() {
          client.user._presence.status = "available";
          spyOn(client, "sendSocketRequest")
          client.user.setStatus(layer.Identity.STATUS.OFFLINE);
          expect(client.user.status).toEqual(layer.Identity.STATUS.INVISIBLE);
          expect(client.sendSocketRequest).toHaveBeenCalledWith({
            method: 'PATCH',
            body: {
              method: 'Presence.update',
              data: [{operation: 'set', property: 'status', value: 'offline'}]
            },
            sync: {
              depends: [client.user.id],
              target: client.user.id
            }
          }, jasmine.any(Function));
        });
      });

      describe("The follow() method", function() {
        beforeEach(function() {
          spyOn(client.dbManager, "writeSyncEvents").and.callFake(function(evts, callback) {callback(true);});
        });
        it("Should ignore the call if isFullIdentity", function() {
          spyOn(identity, "_xhr");
          identity.follow();
          expect(identity._xhr).not.toHaveBeenCalled();
        });

        it("Should send a request to the server if not isFullIdentity", function() {
          spyOn(basicIdentity, "_xhr");
          basicIdentity.follow();
          expect(basicIdentity._xhr).toHaveBeenCalledWith({
            method: "PUT",
            url: client.url + '/following/users/' + basicIdentity.userId,
            syncable: {}
          }, jasmine.any(Function));
        });

        it("Should call _load if successful", function() {
          basicIdentity.follow();
          spyOn(basicIdentity, "_load");
          requests.mostRecent().response({
              status: 204
          });
          expect(basicIdentity._load).toHaveBeenCalledWith();
        });

        it("Should leave syncState as LOADING", function() {
          basicIdentity.follow();
          expect(basicIdentity.syncState).toEqual(layer.Constants.SYNC_STATE.LOADING);
        });
      });

      describe("The unfollow() method", function() {
        beforeEach(function() {
          spyOn(client.dbManager, "writeSyncEvents").and.callFake(function(evts, callback) {callback(true);});
        });
        it("Should send a request to the server if not isFullIdentity", function() {
          spyOn(basicIdentity, "_xhr");
          basicIdentity.unfollow();
          expect(basicIdentity._xhr).toHaveBeenCalledWith({
            method: "DELETE",
            url: client.url + '/following/users/' + basicIdentity.userId,
            syncable: {}
          });
        });
      });

      describe("The _handleWebsocketDelete() method", function() {
        it("Should call dbManager.deleteObjects", function() {
          spyOn(client.dbManager, "deleteObjects");
          identity._handleWebsocketDelete(null);
          expect(client.dbManager.deleteObjects).toHaveBeenCalledWith('identities', [identity]);
        });

        it("Should clear out all fullIdentity fields", function() {
          identity._handleWebsocketDelete(null);
          expect(identity.firstName).toBe('');
          expect(identity.lastName).toBe('');
          expect(identity.emailAddress).toBe('');
          expect(identity.phoneNumber).toBe('');
          expect(identity.metadata).toBe(null);
          expect(identity.publicKey).toBe('');
          expect(identity.isFullIdentity).toBe(false);
        });

        it("Should trigger identities:unfollow", function() {
          spyOn(identity, '_triggerAsync');
          identity._handleWebsocketDelete(null);
          expect(identity._triggerAsync).toHaveBeenCalledWith('identities:unfollow');
        });
      });

      describe("The _createFromServer() method", function() {
        it("Should return a new Identity", function() {
          expect(layer.Identity._createFromServer(responses.useridentity, client)).toEqual(jasmine.any(layer.Identity));
          expect(layer.Identity._createFromServer(responses.useridentity, client).userId).toEqual(responses.useridentity.user_id);
        });
      });

      describe("The _updateValue() method", function() {
        it("Should update a standard value", function() {
          spyOn(identity, '_triggerAsync');
          identity._updateValue(['firstName'], 'They call me First Name');
          expect(identity.firstName).toEqual('They call me First Name');
          expect(identity._triggerAsync).toHaveBeenCalledWith('identities:change', {
            property: 'firstName',
            oldValue: 'first',
            newValue: 'They call me First Name'
          });
        });

        it("Should update an embedded value", function() {
          identity._presence.status = 'away';
          spyOn(identity, '_triggerAsync');
          identity._updateValue(['_presence', 'status'], 'annoyed');
          expect(identity._presence.status).toEqual('annoyed');
          expect(identity._triggerAsync).toHaveBeenCalledWith('identities:change', {
            property: 'status',
            oldValue: 'away',
            newValue: 'annoyed'
          });
        });
      });

      describe("The _setUserId() method", function() {
        it("Should update userId", function() {
          // Run
          client.user._setUserId('Frodo the Dodo');

          // Posttest
          expect(client.user.userId).toEqual('Frodo the Dodo');
        });

        it("Should update id", function() {
          // Run
          client.user._setUserId('Frodo the Dodo');

          // Posttest
          expect(client.user.id).toEqual('layer:///identities/Frodo%20the%20Dodo');
        });

        it("Should update url", function() {
          // Run
          client.user._setUserId('Frodo the Dodo');

          // Posttest
          expect(client.user.url).toEqual(client.url + '/identities/Frodo%20the%20Dodo');
        });

        it("Should update client._models.identities", function() {
          // Setup
          client._models.identities = {};
          client._models.identities[client.user.id] = client.user;

          // Run
          client.user._setUserId('Frodo the Dodo');

          // Posttest
          expect(client._models.identities).toEqual({
            'layer:///identities/Frodo%20the%20Dodo': client.user
          });
        });
      });

      xit("Should escape user ids", function() {
        expect(1).toBe(0);
      });
    });

    describe("The destroy() method", function() {
      it("Should call _removeIdentity", function() {
        spyOn(client, "_removeIdentity");
        identity.destroy();
        expect(client._removeIdentity).toHaveBeenCalledWith(identity);
      });

      it("Should call parent destroy", function() {
        var tmp = layer.Syncable.prototype.destroy;
        spyOn(layer.Syncable.prototype, "destroy");
        identity.destroy();
        expect(layer.Syncable.prototype.destroy).toHaveBeenCalledWith();

        // Restore
        layer.Syncable.prototype.destroy = tmp;
      });
    });
});