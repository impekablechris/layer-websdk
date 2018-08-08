/*eslint-disable */
describe("The IdentitiesQuery Class", function() {
    var appId = "Fred's App";

    var conversation, conversationUUID,
        identity,
        membership,
        channel,
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
        channel = client._createObject(responses.channel1);
        identity = client._createObject(responses.useridentity);
        membership = client._createObject(responses.membership1);
        query = client.createQuery({
          model: layer.Query.Membership,
          predicate: 'channel.id= "' + channel.id + '"'
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

    it("Should be an MembershipQuery", function() {
      expect(query.constructor.prototype.model).toEqual(layer.Query.Membership);
    });


    describe("The _fetchData() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = client.createQuery({
                model: layer.Query.Membership,
                paginationWindow: 15,
                predicate: 'channel.id= "' + channel.id + '"'
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

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._fetchData(141);
            expect(requests.mostRecent().url).toEqual(channel.url + "/members?page_size=141");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._fetchData(140);
            expect(requests.mostRecent().url).toEqual(channel.url + "/members?page_size=140&from_id=howdy");
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
            }), channel.id.replace(/layer:\/\/\//, "") + "/members?page_size=47", 47);
        });
    });

    describe("The _appendResults() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Membership,
                paginationWindow: 15,
                predicate: 'channel.id= "' + channel.id + '"'
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should use last index to position result", function() {
          var m1 = client._createObject({
            id: "layer:///members/1",
            identity: {
                id: "layer:///identities/1",
                display_name: "Frodo the Frog"
            },
            role: "admin",
                channel: channel
          });
          var m2 = client._createObject({
            id: "layer:///members/2",
            identity: {
                id: "layer:///identities/2",
                display_name: "Frodo the Frog"
            },
            role: "admin",
                channel: channel
          });
          var m3Obj = {
            id: "layer:///members/3",
            identity: {
                id: "layer:///identities/3",
                display_name: "Frodo the Frog"
            },
            role: "admin",
                channel: channel
          };
          var m3 = client._createObject(m3Obj);

          query.data = [m1.toObject(), m2.toObject()];
          query.dataType = "object";
          query.model = layer.Query.Membership;

          // Run
          query._appendResults({
              data: [m3Obj],
              xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
          });

          // Posttest
          expect(query.data).toEqual([m1.toObject(), m2.toObject(), m3.toObject()]);
        });
    });

    describe("The _handleEvents() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Membership,
                paginationWindow: 15,
                predicate: 'channel.id= "' + channel.id + '"'
            });
            query.data = [membership];
            spyOn(query, "_handleChangeEvent");
            spyOn(query, "_handleAddEvent");
            spyOn(query, "_handleRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleChangeEvent", function() {
            query._handleEvents("members:change", ({a: "b", eventName: "members:change"}));
            expect(query._handleChangeEvent).toHaveBeenCalledWith('members', {a: "b", eventName: "members:change"});
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleAddEvent", function() {
            query._handleEvents("members:add", {a: "b", eventName: "members:add"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).toHaveBeenCalledWith('members', {a: "b", eventName: "members:add"});
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleRemoveEvent", function() {
            query._handleEvents("members:remove", {a: "b", eventName: "members:remove"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).toHaveBeenCalledWith('members', {a: "b", eventName: "members:remove"});
        });
    });


    describe("The _handleChangeEvent() method", function() {
        var query, membership2;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Membership,
                paginationWindow: 15,
                dataType: "object"
            });
            membership2 = client._createObject(responses.membership1);
            query.data = [membership];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should not touch data array if dataType is object but item not in the data", function() {
            var evt = new layer.LayerEvent({
                property: "role",
                oldValue: 'admin',
                newValue: 'user',
                target: membership
            }, "members:change");
            var data = query.data = [membership.toObject()];
            data[0].id += "1"; // prevent data from being found

            // Run
            query._handleChangeEvent('members', evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should not change the data array if dataType is instance", function() {
            // Setup
            query.dataType = "instance";
            var data = query.data = [membership];
            var evt = new layer.LayerEvent({
                property: "role",
                oldValue: 'admin',
                newValue: 'user',
                target: membership
            }, "members:change");

            // Run
            query._handleChangeEvent('members', evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should change data array if dataType is object and item is in the data", function() {
            var evt = new layer.LayerEvent({
                property: "role",
                oldValue: 'admin',
                newValue: 'user',
                target: membership
            }, "members:change");
            var data = query.data = [membership.toObject()];

            // Run
            query._handleChangeEvent('members', evt);

            // Posttest
            expect(query.data).not.toBe(data);
        });

        it("Should trigger change event if the Member is in the data", function() {
            var data = query.data = [membership.toObject()];
            var evt = new layer.LayerEvent({
                property: "role",
                oldValue: 'admin',
                newValue: 'user',
                target: membership
            }, "members:change");
            spyOn(query, "_triggerChange");

            // Run
            query._handleChangeEvent('members', evt);

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: "property",
                target: membership.toObject(),
                query: query,
                isChange: true,
                changes: [{
                    property: "role",
                    oldValue: 'admin',
                    newValue: 'user',
                }]
            });
        });

        it("Should not trigger change event if Member is NOT in the data", function() {
            var data = query.data = [membership.toObject()];
            var evt = new layer.LayerEvent({
                property: "role",
                oldValue: 'admin',
                newValue: 'user',
                target: {id: membership.id + "1"}
            }, "members:change");
            spyOn(query, "trigger");

            // Run
            query._handleChangeEvent('members', evt);

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });
    });


    describe("The _handleAddEvent() method", function() {
        var query, membership2;
        beforeEach(function() {
            membership2 = client._createObject({
                id: "layer:///members/2",
                identity: responses.useridentity,
                role: "user",
                channel: channel
            });
            query = client.createQuery({
                model: layer.Query.Membership,
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
            query._handleAddEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([membership.toObject(), membership2.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleAddEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([membership, membership2]);
        });

        it("Should only operate on new values", function() {
            var data = query.data = [membership.toObject()];

            // Run
            query._handleAddEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query.data).toEqual([membership.toObject(), membership2.toObject()]);

        });


        it("Should trigger change event if new values", function() {
            var data = query.data = [];
            spyOn(query, "_triggerChange");

            // Run
            query._handleAddEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 0,
                target: membership.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 1,
                target: membership2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");
            query.data = [membership, membership2];

            // Run
            query._handleAddEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalCount property", function() {
          expect(query.totalSize).toEqual(0);

          // Run
          query._handleAddEvent('members', {
              members: [membership, membership2]
          });

          // Posttest
          expect(query.totalSize).toEqual(2);
        });
    });


    describe("The _handleRemoveEvent() method", function() {
        var query, membership2;
        beforeEach(function() {
            membership2 = client._createObject({
                id: "layer:///members/2",
                identity: responses.useridentity,
                role: "user",
                channel: channel
            });
            query = client.createQuery({
                model: layer.Query.Membership,
                paginationWindow: 15,
                dataType: "object",
            });
            query.data = [membership.toObject(), membership2.toObject()];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array without Member if dataType is object", function() {
            var data = query.data;

            // Run
            query._handleRemoveEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should call _updateNextFromId for server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextServerFromId = membership2.id;

            // Run
            query._handleRemoveEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleRemoveEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var membership3 = client._createObject(responses.membership2);
            query.data = [membership2.toObject()];

            // Run
            query._handleRemoveEvent('members', {
                members: [membership, membership3]
            });

            // Posttest
            expect(query.data).toEqual([membership2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleRemoveEvent('members', {
                members: [membership, membership2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: membership.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: membership2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [membership2.toObject()];

            // Run
            query._handleRemoveEvent('members', {
                members: [membership]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should decrease the totalCount property", function() {
          query.data = [membership, membership2];
          query.totalSize = 2;

          // Run
          query._handleRemoveEvent('members', {
              members: [membership]
          });

          // Posttest
          expect(query.totalSize).toEqual(1);
        });
    });
});
