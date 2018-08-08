/*eslint-disable */
describe("The IdentitiesQuery Class", function() {
    var appId = "Fred's App";

    var conversation, conversationUUID,
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

        identity = client._createObject(responses.useridentity);
        query = client.createQuery({
          model: layer.Query.Identity
        });

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

    it("Should be an IdentitiesQuery", function() {
      expect(query.constructor.prototype.model).toEqual(layer.Query.Identity);
    });


    describe("The _fetchData() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true", function() {
            query.isFiring = false;
            query._fetchData(37);
            expect(query.isFiring).toBe(true);
        });

        it("Should call database unless there is a _nextDBFromId", function() {
          spyOn(client.dbManager, "loadIdentities");

          // Test 1
          query._fetchData(140);
          expect(client.dbManager.loadIdentities).toHaveBeenCalledWith(jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._fetchData(141);
          expect(client.dbManager.loadIdentities.calls.count()).toEqual(1);
        });

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._fetchData(141);
            expect(requests.mostRecent().url).toEqual(client.url + "/identities?page_size=141");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._fetchData(140);
            expect(requests.mostRecent().url).toEqual(client.url + "/identities?page_size=140&from_id=howdy");
        });

        it("Should refuse to call if already firing with same url", function() {
            query.data = [];
            query._fetchData(45);
            query._fetchData(45);
            expect(requests.count()).toEqual(1);
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
                data: [{id: "a"}, {id: "b"}]
            }), "identities?page_size=47", 47);
        });
    });

    describe("The _appendResults() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should use last index to position result", function() {
          var i1 = client._createObject({
            id: "layer:///identities/1",
            user_id: "1",
            display_name: "1"
          });
          var i2 = client._createObject({
            id: "layer:///identities/2",
            user_id: "2",
            display_name: "2"
          });
          var i3 = client._createObject({
            id: "layer:///identities/3",
            user_id: "3",
            display_name: "3"
          });

          query.data = [i1.toObject(), i2.toObject()];
          query.dataType = "object";
          query.model = layer.Query.Identity;

          // Run
          query._appendResults({
              data: [i3],
              xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
          });

          // Posttest
          expect(query.data).toEqual([i1.toObject(), i2.toObject(), i3.toObject()]);
        });
    });

    describe("The _handleEvents() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15
            });
            query.data = [identity];
            spyOn(query, "_handleChangeEvent");
            spyOn(query, "_handleAddEvent");
            spyOn(query, "_handleRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleChangeEvent", function() {
            query._handleEvents("identities:change", ({a: "b", eventName: "identities:change"}));
            expect(query._handleChangeEvent).toHaveBeenCalledWith('identities', {a: "b", eventName: "identities:change"});
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleAddEvent", function() {
            query._handleEvents("identities:add", {a: "b", eventName: "identities:add"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).toHaveBeenCalledWith('identities', {a: "b", eventName: "identities:add"});
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleRemoveEvent", function() {
            query._handleEvents("identities:remove", {a: "b", eventName: "identities:remove"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).toHaveBeenCalledWith('identities', {a: "b", eventName: "identities:remove"});
        });
    });


    describe("The _handleChangeEvent() method", function() {
        var query, identity2;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15,
                dataType: "object"
            });
            identity2 = client._createObject(responses.useridentity);
            query.data = [identity];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should not touch data array if dataType is object but item not in the data", function() {
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");
            var data = query.data = [identity.toObject()];
            data[0].id += "1"; // prevent data from being found

            // Run
            query._handleChangeEvent('identities', evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should not change the data array if dataType is instance", function() {
            // Setup
            query.dataType = "instance";
            var data = query.data = [identity];
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");

            // Run
            query._handleChangeEvent('identities', evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should change data array if dataType is object and item is in the data", function() {
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");
            var data = query.data = [identity.toObject()];

            // Run
            query._handleChangeEvent('identities', evt);

            // Posttest
            expect(query.data).not.toBe(data);
        });

        it("Should trigger change event if the Identity is in the data", function() {
            var data = query.data = [identity.toObject()];
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");
            spyOn(query, "_triggerChange");

            // Run
            query._handleChangeEvent('identities', evt);

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: "property",
                target: identity.toObject(),
                query: query,
                isChange: true,
                changes: [{
                    property: "displayName",
                    oldValue: 'Frodo',
                    newValue: 'FrodoTheDodo',
                }]
            });
        });

        it("Should not trigger change event if Identity is NOT in the data", function() {
            var data = query.data = [identity.toObject()];
            var evt = new layer.LayerEvent({
                property: "displayName",
                    oldValue: 'Frodo',
                    newValue: 'FrodoTheDodo',
                target: {id: identity.id + "1"}
            }, "identities:change");
            spyOn(query, "trigger");

            // Run
            query._handleChangeEvent('identities', evt);

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });
    });


    describe("The _handleAddEvent() method", function() {
        var query, identity2;
        beforeEach(function() {
            identity2 = client._createObject({
                id: "layer:///identities/2",
                user_id: "2",
                display_name: "2"
            });
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15,
                dataType: "object",
            });
            query.data = [];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var data = query.data = [];

            // Run
            query._handleAddEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([identity.toObject(), identity2.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleAddEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([identity, identity2]);
        });

        it("Should only operate on new values", function() {
            var data = query.data = [identity.toObject()];

            // Run
            query._handleAddEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).toEqual([identity.toObject(), identity2.toObject()]);

        });


        it("Should trigger change event if new values", function() {
            var data = query.data = [];
            spyOn(query, "_triggerChange");

            // Run
            query._handleAddEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 0,
                target: identity.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 1,
                target: identity2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");
            query.data = [identity, identity2];

            // Run
            query._handleAddEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalCount property", function() {
          expect(query.totalSize).toEqual(0);

          // Run
          query._handleAddEvent('identities', {
              identities: [identity, identity2]
          });

          // Posttest
          expect(query.totalSize).toEqual(2);
        });
    });


    describe("The _handleRemoveEvent() method", function() {
        var query, identity2;
        beforeEach(function() {
            identity2 = client._createObject({
                id: "layer:///identities/2",
                user_id: "2",
                display_name: "2"
            });
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15,
                dataType: "object",
            });
            query.data = [identity.toObject(), identity2.toObject()];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array without Identity if dataType is object", function() {
            var data = query.data;

            // Run
            query._handleRemoveEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should call _updateNextFromId for server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextServerFromId = identity2.id;

            // Run
            query._handleRemoveEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleRemoveEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var identity3 = client._createObject(responses.useridentity);
            query.data = [identity2.toObject()];

            // Run
            query._handleRemoveEvent('identities', {
                identities: [identity, identity3]
            });

            // Posttest
            expect(query.data).toEqual([identity2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleRemoveEvent('identities', {
                identities: [identity, identity2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: identity.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: identity2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [identity2.toObject()];

            // Run
            query._handleRemoveEvent('identities', {
                identities: [identity]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should decrease the totalCount property", function() {
          query.data = [identity, identity2];
          query.totalSize = 2;

          // Run
          query._handleRemoveEvent('identities', {
              identities: [identity]
          });

          // Posttest
          expect(query.totalSize).toEqual(1);
        });
    });
});
