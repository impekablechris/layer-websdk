/* eslint-disable */
describe("The Websocket Change Manager Class", function() {
    var client, changeManager, conversation, channel;
    var appId = "Fred's App";

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
        getObjectResult = null;
        spyOn(client.dbManager, "getObject").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        changeManager = client.socketChangeManager;
        conversation = client._createObject(responses.conversation1);
        channel = client._createObject(responses.channel1);
        requests.reset();
    });

    afterEach(function() {
        jasmine.Ajax.uninstall();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The constructor() method", function() {
        it("Should return a Websockets.ChangeManager", function() {
            expect(new layer.Websockets.ChangeManager({
                client: client,
                socketManager: client.socketManager
            })).toEqual(jasmine.any(layer.Websockets.ChangeManager));
        });


        it("Should subscribe to call _handleChange on message", function() {
            var tmp = layer.Websockets.ChangeManager.prototype._handleChange;
            layer.Websockets.ChangeManager.prototype._handleChange = jasmine.createSpy('handleChange');
            var changeManager = new layer.Websockets.ChangeManager({
                client: client,
                socketManager: client.socketManager
            })
            expect(layer.Websockets.ChangeManager.prototype._handleChange).not.toHaveBeenCalled();

            // Run
            client.socketManager.trigger("message", {data: {body: {}}});

            // Posttest
            expect(layer.Websockets.ChangeManager.prototype._handleChange).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));

            // Restore
            layer.Websockets.ChangeManager.prototype._handleChange = tmp;
            changeManager.destroy();
        });
    });

    describe("The getObject() method", function() {
        it("Should call client.getObject", function() {
            spyOn(client, "getObject").and.returnValue("fred");
            expect(changeManager.getObject({object: {id: "jane"}})).toEqual("fred");
        });
    });

    describe("The _handleChange() method", function() {
        it("Should trigger websocket:operation on the client", function() {
            // Setup
            spyOn(client, "trigger");

            // Run
            changeManager._handleChange({
              data: {
                type: 'operation',
                body: {
                  "method": "do_something",
                  data: "fred",
                  object: {}
                }
              }
            });

            // Posttest
            expect(client.trigger).toHaveBeenCalledWith('websocket:operation', {
                data: {
                  "method": "do_something",
                  data: "fred",
                  object: {}
                }
            });
        });

        it("Should call _handleCreate", function() {
            // Setup
            spyOn(changeManager, "_handleCreate");

            // Run
            changeManager._handleChange({
              data: {
                type: 'change',
                body: {
                  "operation": "create",
                  data: "fred",
                  object: {}
                }
              }
            });

            // Posttest
            expect(changeManager._handleCreate).toHaveBeenCalledWith({
                operation: "create",
                data: "fred",
                object: {}
            });
        });

        it("Should call _handleDelete", function() {
            // Setup
            spyOn(changeManager, "_handleDelete");

            // Run
            changeManager._handleChange({
                data: {
                  type: 'change',
                  body: {
                    "operation": "delete",
                    data: "fred",
                    object: {}
                  }
              }
            });

            // Posttest
            expect(changeManager._handleDelete).toHaveBeenCalledWith({
                operation: "delete",
                data: "fred",
                object: {}
            });
        });

        it("Should call _handlePatch", function() {
            // Setup
            spyOn(changeManager, "_handlePatch");

            // Run
            changeManager._handleChange({
              data: {
                type: 'change',
                body: {
                  "operation": "update",
                  data: [],
                  object: {}
                }
              }
            });

            // Posttest
            expect(changeManager._handlePatch).toHaveBeenCalledWith({
                operation: "update",
                data: [],
                object: {}
            });
        });

        it("Should ignore non-change events", function() {
           // Setup
            spyOn(changeManager, "_handlePatch");
            spyOn(changeManager, "_handleCreate");
            spyOn(changeManager, "_handleDelete");

            // Run
            changeManager._handleChange({
              data: {
                type: 'change2',
                body: {
                  "operation": "update",
                  data: [],
                  object: {}
                }
              }
            });

            // Posttest
            expect(changeManager._handlePatch).not.toHaveBeenCalled();
            expect(changeManager._handleCreate).not.toHaveBeenCalled();
            expect(changeManager._handleDelete).not.toHaveBeenCalled();
        });
    });

    describe("The _handleCreate() method", function() {
        it("Should call client._createObject", function() {
            spyOn(client, "_createObject");
            changeManager._handleCreate({
                operation: "create",
                data: {id: "layer:///messages/uuid"}
            });
            expect(client._createObject).toHaveBeenCalledWith({
                id: "layer:///messages/uuid",
                fromWebsocket: true,
            });
        });
    });

    describe("The _handleDelete() method", function() {
        it("Should call object._handleWebsocketDelete if found", function() {
            var m = conversation.createMessage("hey").send();
            spyOn(changeManager, "getObject").and.returnValue(m);
            spyOn(m, "_handleWebsocketDelete");

            // Run
            changeManager._handleDelete({
                object: {
                  id: conversation.id
                },
                data: {
                  mode: "all_participants"
                }
            });

            // Posttest
            expect(m._handleWebsocketDelete).toHaveBeenCalledWith({
                mode: "all_participants"
            });
        });

        it("Should do nothing if the object is not found", function() {
            var m = conversation.createMessage("hey").send();
            spyOn(changeManager, "getObject").and.returnValue(null);
            spyOn(m, "_handleWebsocketDelete");

            // Run
            changeManager._handleDelete({
                object: {
                  id: conversation.id
                },
                data: {
                  mode: "my_devices"
                }
            });

            // Posttest
            expect(m._handleWebsocketDelete).not.toHaveBeenCalled();
        });
    });

    describe("The _handlePatch() method", function() {
        it("Should call Util.layerParse if found", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");
            var m = conversation.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(m);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: m.id,
                    type: "Message"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });

            // Posttest
            expect(layer.Util.layerParse).toHaveBeenCalledWith({
                object: m,
                type: "Message",
                operations: [{operation: "set", property: "joe", value: "jane"}],
                client: client
            });

            // Cleanup
            layer.Util.LayerParse = tmp;
        });

        it("Should load a Conversation if not found and allowed", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            var _loadResourceForPatch = layer.Conversation._loadResourceForPatch;
            spyOn(layer.Conversation, "_loadResourceForPatch").and.returnValue(true);

            var m = conversation.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: "layer:///conversations/fred"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });
            jasmine.clock().tick(100);

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations/fred");

            // Cleanup
            layer.Util.LayerParse = tmp;
            layer.Conversation._loadResourceForPatch = _loadResourceForPatch;
        });

        it("Should not load a Conversation if not found and not allowed", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            var _loadResourceForPatch = layer.Conversation._loadResourceForPatch;
            spyOn(layer.Conversation, "_loadResourceForPatch").and.returnValue(false);

            var m = conversation.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: "layer:///conversations/fred"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent()).toBe(undefined);

            // Cleanup
            layer.Util.LayerParse = tmp;
            layer.Conversation._loadResourceForPatch = _loadResourceForPatch;
        });


        it("Should load a Channel if not found and allowed", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            var _loadResourceForPatch = layer.Channel._loadResourceForPatch;
            spyOn(layer.Channel, "_loadResourceForPatch").and.returnValue(true);

            var m = channel.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: "layer:///channels/fred"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });
            jasmine.clock().tick(100);

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent().url).toEqual(client.url + "/channels/fred");

            // Cleanup
            layer.Util.LayerParse = tmp;
            layer.Channel._loadResourceForPatch = _loadResourceForPatch;
        });

        it("Should not load a Channel if not found and not allowed", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            var _loadResourceForPatch = layer.Channel._loadResourceForPatch;
            spyOn(layer.Channel, "_loadResourceForPatch").and.returnValue(false);

            var m = channel.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: "layer:///channels/fred"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent()).toBe(undefined);

            // Cleanup
            layer.Util.LayerParse = tmp;
            layer.Channel._loadResourceForPatch = _loadResourceForPatch;
        });

        it("Should load a Message if not found and allowed", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            var _loadResourceForPatch = layer.Message._loadResourceForPatch;
            spyOn(layer.Message, "_loadResourceForPatch").and.returnValue(true);

            var m = conversation.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: "layer:///messages/fred"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });
            jasmine.clock().tick(100);

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent().url).toEqual(client.url + "/messages/fred");

            // Cleanup
            layer.Util.LayerParse = tmp;
            layer.Message._loadResourceForPatch = _loadResourceForPatch;
        });

        it("Should not load a Message if not found and not allowed", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");

            var _loadResourceForPatch = layer.Message._loadResourceForPatch;
            spyOn(layer.Message, "_loadResourceForPatch").and.returnValue(false);

            var m = conversation.createMessage("hey");
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: "layer:///messages/fred"
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent()).toBe(undefined);

            // Cleanup
            layer.Util.LayerParse = tmp;
            layer.Message._loadResourceForPatch = _loadResourceForPatch;
        });

        it("Shouldn't do much of anything for Announcements", function() {
            var tmp = layer.Util.layerParse;
            spyOn(layer.Util, "layerParse");



            var announcement = client._createObject(responses.announcement);
            spyOn(changeManager, "getObject").and.returnValue(null);

            // Run
            changeManager._handlePatch({
                operation: "update",
                object: {
                    id: announcement.id
                },
                data: [{operation: "set", property: "joe", value: "jane"}]
            });

            // Posttest
            expect(layer.Util.layerParse).not.toHaveBeenCalled();
            expect(requests.mostRecent()).toBe(undefined);

            // Cleanup
            layer.Util.LayerParse = tmp;
        });
    });
});