/*eslint-disable */
describe("The ChannelsQuery Class", function() {
    var appId = "Fred's App";

    var channel, channelUUID,
        channel2,
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
          model: layer.Query.Channel
        });
        channel = client._createObject(responses.channel1);
        channel2 = client._createObject(responses.channel2);
        message = channel.createMessage("Hey").send();

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

    it("Should be an ChannelsQuery", function() {
      expect(query.constructor.prototype.model).toEqual(layer.Query.Channel);
    });

    describe("The constructor() method", function() {
         it("Should reject predicate on Channel", function() {
            expect(function() {
                var query = client.createQuery({
                    model: layer.Query.Channel,
                    predicate: 'channel.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
                });
            }).toThrowError(layer.LayerError.dictionary.predicateNotSupported);
            expect(layer.LayerError.dictionary.predicateNotSupported.length > 0).toBe(true);
        });
    });

    describe("The _fetchData() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Channel,
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true", function() {
            query.isFiring = false;
            query._fetchData();
            expect(query.isFiring).toBe(true);
        });

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._fetchData(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/channels?page_size=32");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._fetchData(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/channels?page_size=32&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadChannels");

          // Test 1
          query._fetchData(17);
          expect(client.dbManager.loadChannels).toHaveBeenCalledWith('', 17, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._fetchData(17);
          expect(client.dbManager.loadChannels).toHaveBeenCalledWith('howdy', 17, jasmine.any(Function));
        });

        it("Should refuse to call if already firing with same url", function() {
            requests.reset();
            query._fetchData(45);
            query._fetchData(45);
            expect(requests.count()).toEqual(1);
        });

        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._fetchData(36);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
                data: [{id: "a"}, {id: "b"}]
            }), "channels?page_size=36", 36);
        });
    });

    describe("The _getSortField() method", function() {
      it("Should return created_at even though sentAt was requested", function() {
        query.update({sortBy: [{'lastMessage.sentAt': 'desc'}]});
        expect(query._getSortField()).toEqual('created_at');
      });

      it("Should return created_at", function() {
        query.update({sortBy: [{'createdAt': 'desc'}]});
        expect(query._getSortField()).toEqual('created_at');
      });
    });


    describe("The _getInsertIndex() method", function() {
        var query;
        beforeEach(function() {
            channel.createdAt = 5;
            channel2.createdAt = 10;
            query = client.createQuery({
                client: client,
                model: layer.Query.Channel,
                paginationWindow: 15,
                dataType: "object"
            });
        });

        it("Should insert as first element", function() {
            var c = client.createChannel({name: "a"});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 15;
            expect(query._getInsertIndex(c, [channel2, channel])).toEqual(0);
        });

        it("Should insert as second element", function() {
            var c = client.createChannel({name: "a"});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 8;
            expect(query._getInsertIndex(c, [channel2, channel])).toEqual(1);
        });

        it("Should insert as last element", function() {
            var c = client.createChannel({name: "a"});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 3;
            expect(query._getInsertIndex(c, [channel2, channel])).toEqual(2);
        });

        it("Should insert NEW items at top", function() {
            var c = client.createChannel({name: "a"});
            c.syncState = layer.Constants.SYNCED;
            data = [channel, channel2];
            expect(query._getInsertIndex(c, data)).toEqual(0);
        });

        it("Should insert added items after NEW items for sort by createdAt", function() {
            var c = client.createChannel({name: "a"});
            data = [c, channel2];
            expect(query._getInsertIndex(channel, data)).toEqual(2);
        });
    });

    describe("The _handleEvents() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: layer.Query.Channel,
                paginationWindow: 15
            });
            query.data = [channel];
            spyOn(query, "_handleChangeEvent");
            spyOn(query, "_handleAddEvent");
            spyOn(query, "_handleRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleChangeEvent", function() {
            query._handleEvents("channels:change", {a: "b", eventName: "channels:change"})
            expect(query._handleChangeEvent).toHaveBeenCalledWith('channels', {a: "b", eventName: "channels:change"});
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleAddEvent", function() {
            query._handleEvents("channels:add", {a: "b", eventName: "channels:add"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).toHaveBeenCalledWith('channels', {a: "b", eventName: "channels:add"});
            expect(query._handleRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleRemoveEvent", function() {
            query._handleEvents("channels:remove", {a: "b", eventName: "channels:remove"})
            expect(query._handleChangeEvent).not.toHaveBeenCalled();
            expect(query._handleAddEvent).not.toHaveBeenCalled();
            expect(query._handleRemoveEvent).toHaveBeenCalledWith('channels', {a: "b", eventName: "channels:remove"});
        });
    });

    describe("The _handleChangeEvent() method", function() {
        describe("Sort by createdAt, dataType is object", function() {
            var query;
            beforeEach(function() {
                query = client.createQuery({
                    model: layer.Query.Channel,
                    paginationWindow: 15,
                    dataType: "object",
                    sortBy: [{'createdAt': 'desc'}]
                });
                query.data = [channel2.toObject(), channel.toObject()];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should find the channel and apply channel ID changes without reordering and using a new data array", function() {
                // Setup
                var id = channel.id;
                var tempId = layer.Util.generateUUID();
                query.data[1].id = tempId;
                var data = query.data;
                channel._clearObject();
                channel.id = id;
                var evt = new layer.LayerEvent({
                    property: "id",
                    oldValue: tempId,
                    newValue: id,
                    target: channel
                }, "channels:change");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1].id).toEqual(id);
                expect(data[1].id).toEqual(tempId);
            });

            it("Should update the array object and the channel object for unreadCount change", function() {
                // Setup
                var data = query.data;
                var originalObject = data[1];
                originalObject.unreadCount = 1;
                channel._clearObject();
                var evt = new layer.LayerEvent({
                    property: "unreadCount",
                    oldValue: 1,
                    newValue: 2,
                    target: channel
                }, "channels:change");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1]).not.toEqual(originalObject);
            });

            it("Should update the array object but not reorder for name events", function() {
                // Setup
                var data = query.data;
                channel._clearObject();
                var evt = new layer.LayerEvent({
                    property: "name",
                    oldValue: 'a',
                    newValue: 'b',
                    target: channel
                }, "channels:change");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data).toEqual(data);
            });

            it("Should not touch data array if dataType is object but item not in the data", function() {
                var channel = client.createChannel({ members: ["abc"] });
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: channel
                }, "channels:change");
                var data = query.data;
                data[0].id += "1";

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.data).toBe(data);
            });

            it("Should trigger change event if the Channel is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: channel
                }, "channels:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: channel.toObject(),
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if channel is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: channel.id + "1"}
                }, "channels:change");
                spyOn(query, "trigger");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });


            it("Should not trigger a move event if the channel sorting has not changed", function() {
                expect(query.data.indexOf(channel.toObject())).toEqual(1);
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: channel
                }, "channels:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('channels', evt);


                // Posttest
                expect(query._triggerChange).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    type: 'move'
                }));
                expect(query.data.indexOf(channel.toObject())).toEqual(1);
            });
        });
        describe("Sort by createdAt, dataType is instance", function() {
            var query;
            beforeEach(function() {
                query = client.createQuery({
                    client: client,
                    model: layer.Query.Channel,
                    paginationWindow: 15,
                    dataType: "instance",
                    sortBy: [{'createdAt': 'desc'}]
                });
                query.data = [channel2, channel];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should not touch data array for a participant change event", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: channel
                }, "channels:change");
                var data = query.data;

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.data).toEqual([channel2, channel]);
                expect(query.data).toBe(data);
            });

            it("Should not reorder the array for a lastMessage event", function() {
                // Setup
                var data = query.data;
                var dataCopy = [].concat(query.data);
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: channel
                }, "channels:change");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.data).toBe(data);
                expect(query.data).toEqual(dataCopy);
            });

            it("Should trigger change event if the channel is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: channel
                }, "channels:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: channel,
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if channel is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: channel.id + "1"}
                }, "channels:change");
                spyOn(query, "trigger");

                // Run
                query._handleChangeEvent('channels', evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });

            it("Should not trigger a move event if the channel sorting has not changed", function() {
                expect(query.data.indexOf(channel)).toEqual(1);
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: channel
                }, "channels:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleChangeEvent('channels', evt);


                // Posttest
                expect(query._triggerChange).not.toHaveBeenCalledWith(jasmine.objectContaining({
                    type: 'move'
                }));
                expect(query.data.indexOf(channel)).toEqual(1);
            });
        });
  });

  describe("The _handleAddEvent() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: layer.Query.Channel,
                paginationWindow: 15,
                dataType: "object"
            });
            query.data = [channel];
            spyOn(query, "_getInsertIndex").and.returnValue(0);
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var channel2 = client.createChannel({ members: ["aza"] });
            var data = query.data = [];

            // Run
            query._handleAddEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([channel2.toObject(), channel.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            var channel2 = client.createChannel({ members: ["aza"] });
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleAddEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([channel2, channel]);
        });

        it("Should only operate on new values", function() {
            var channel2 = client.createChannel({ members: ["aza"] });
            var data = query.data = [channel.toObject()];

            // Run
            query._handleAddEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.data).toEqual([channel2.toObject(), channel.toObject()]);

        });

        it("Should trigger change event if new values", function() {
            var channel2 = client.createChannel({ participants: ["aza"] });
            var data = query.data = [];
            spyOn(query, "trigger");

            // Run
            query._handleAddEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.trigger).toHaveBeenCalledWith("change", {
                type: 'insert',
                index: 0,
                target: channel.toObject(),
                query: query
            });
            expect(query.trigger).toHaveBeenCalledWith("change", {
                type: 'insert',
                index: 0,
                target: channel2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");

            // Run
            query._handleAddEvent('channels', {
                channels: [channel]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalSize property", function() {
            var channel2 = client.createChannel({ participants: ["aza"] });
            var data = query.data = [];
            expect(query.totalSize).toEqual(0);

            // Run
            query._handleAddEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.totalSize).toEqual(2);
        });
    });

    describe("The _handleRemoveEvent() method", function() {
        var query, channel2;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: layer.Query.Channel,
                paginationWindow: 15,
                dataType: "object"
            });
            channel2 = client.createChannel({ participants: ["cdc"] });
            query.data = [channel.toObject(), channel2.toObject()];

        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _updateNextFromId for db and server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextDBFromId = channel.id;
            query._nextServerFromId = channel2.id;

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('heyho');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should replace data with a new array removes channels if dataType is object", function() {

            var data = query.data;

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var channel3 = client.createChannel({ participants: ["zbd"] });

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel, channel3]
            });

            // Posttest
            expect(query.data).toEqual([channel2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: channel.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: channel2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [channel2.toObject()];

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalSize property", function() {
            var channel2 = client.createChannel({ participants: ["aza"] });
            var channel3 = client.createChannel({ participants: ["azab"] });
            var data = query.data = [channel, channel2, channel3];
            query.totalSize = 3;

            // Run
            query._handleRemoveEvent('channels', {
                channels: [channel, channel2]
            });

            // Posttest
            expect(query.totalSize).toEqual(1);
        });
    });
});