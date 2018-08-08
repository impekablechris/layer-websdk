/*eslint-disable */
describe("The Query Class", function() {
    var appId = "Fred's App";

    var conversation, conversationUUID,
        conversation2,
        announcement,
        message,
        identity,
        client,
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
        conversation = client._createObject(responses.conversation1);
        announcement = client._createObject(responses.announcement);
        conversation2 = client._createObject(responses.conversation2);
        message = conversation.createMessage("Hey").send();

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

    describe("The constructor() method", function() {
        it("Should accept an object as input", function() {
            expect(new layer.Query({
                client: client,
                model: "Conversation"
            }).model).toEqual("Conversation");

            expect(new layer.Query({
                client: client,
                returnType: "count"
            }).returnType).toEqual("count");

            expect(new layer.Query({
                client: client,
                dataType: "object"
            }).dataType).toEqual("object");
        });

        it("Should accept a QueryBuilder input", function() {
            var builder = layer.QueryBuilder.conversations().paginationWindow(15);
            var query = new layer.Query(client, builder);
            expect(query.paginationWindow).toEqual(15);
        });

        it("Should initialize data", function() {
            expect(new layer.Query({
                client: client,
                dataType: "object"
            }).data).toEqual([]);
        });

        it("Should require a client", function() {
            expect(function() {
                new layer.Query({});
            }).toThrowError(layer.LayerError.dictionary.clientMissing);
        });

        it("Should call _run if isReady", function() {
            // Setup
            var tmp = layer.Query.prototype._run;
            spyOn(layer.Query.prototype, "_run");

            // Run
            var query = client.createQuery({
                client: client
            });

            // Posttest
            expect(layer.Query.prototype._run).toHaveBeenCalledWith();

            // Restore
            layer.Query.prototype._run = tmp;;
        });

        it("Should call _run WHEN isReady", function() {
            // Setup
            var tmp = layer.Query.prototype._run;
            spyOn(layer.Query.prototype, "_run");
            client.isReady = false;

            // Run
            var query = client.createQuery({
                client: client
            });

            // Midtest
            expect(layer.Query.prototype._run).not.toHaveBeenCalled();

            // Run some more
            client.trigger('ready');

            // Posttest
            expect(layer.Query.prototype._run).toHaveBeenCalledWith();

            // Restore
            layer.Query.prototype._run = tmp;
        });

        // Integration test verifies that new Conversation in the Client
        // triggers _handleEvents in Query
        it("Should setup change event handlers", function() {
            var query = client.createQuery({
                model: layer.Query.Conversation
            });
            var spy = client._events.all[0].callback = jasmine.createSpy('callback');
            spyOn(query, "_handleEvents");

            // Run
            client.trigger("conversations:add", {conversations: [conversation]});

            // Posttest
            expect(spy).toHaveBeenCalledWith("conversations:add", jasmine.any(layer.LayerEvent));
        });

        it("Should force paginationWindow to acceptable value", function() {
          var query = client.createQuery({
            client: client,
            paginationWindow: 12345
          });
          expect(query.paginationWindow).toEqual(layer.Query.MaxPageSize);
        });
    });

    describe("The destroy() method", function() {
        it("Should notify any views that its data has been cleared", function() {
            var query = client.createQuery({
                client: client
            });
            var changed = false;
            query.on('change', function() {
                changed = true;
            });

            var dataChanged = false;
            query.on('change:reset', function() {
                dataChanged = true;
            });

            // Run
            query.destroy();

            // Posttest
            expect(changed).toBe(true);
            expect(dataChanged).toBe(true);
        });

        it("Should call _removeQuery", function() {
            var query = client.createQuery({
                client: client
            });
            spyOn(client, "_removeQuery");

            // Run
            query.destroy();

            // Posttest
            expect(client._removeQuery).toHaveBeenCalledWith(query);
        });
    });

    describe("The update() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: layer.Query.Message,
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should update the paginationWindow", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({paginationWindow: 30});

            // Posttest
            expect(query.paginationWindow).toEqual(30);
            expect(query._reset).not.toHaveBeenCalled();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should not update the paginationWindow to more than MAX_PAGE_SIZE greater than current size", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");
            query.data = [conversation, conversation2];

            // Run
            query.update({paginationWindow: 500});

            // Posttest
            expect(query.paginationWindow).toEqual(layer.Query.MaxPageSize + query.data.length);
        });

        it("Should update the predicate", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({
                predicate: 'conversation.id = "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
            });

            // Posttest
            expect(query.predicate).toEqual("conversation.id = 'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'");
            expect(query._reset).toHaveBeenCalledWith();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should detect predicate is the same", function() {
            query.update({
                predicate: 'conversation.id = "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
            });
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({predicate: 'conversation.id    =   "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'});

            // Posttest
            expect(query._reset).not.toHaveBeenCalledWith();
            expect(query._run).not.toHaveBeenCalledWith();
        });

        it("Should not update the model", function() {
            expect(function() {
                query.update({model: 'Conversation'});
            }).toThrowError(layer.LayerError.dictionary.modelImmutable);
            expect(layer.LayerError.dictionary.modelImmutable.length > 0).toBe(true);
        });

        it("Should update sortBy", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({sortBy: [{'created_at': 'desc'}]});

            // Posttest
            expect(query.sortBy).toEqual([{'created_at': 'desc'}]);
            expect(query._reset).toHaveBeenCalledWith();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should accept a Query Builder", function() {
            query.update(layer.QueryBuilder.messages().paginationWindow(18));
            expect(query.paginationWindow).toEqual(18);
        });

    });

    describe("The _reset() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should clear the data", function() {
            query.data = [conversation];
            query._reset();
            expect(query.data).toEqual([]);
        });

        it("Should call _checkAndPurgeCache", function() {
            spyOn(client, "_checkAndPurgeCache");
            query.data = [conversation];
            query._reset();
            expect(client._checkAndPurgeCache).toHaveBeenCalledWith([conversation]);
        });

        it("Should reset paginationWindow", function() {
            query.paginationWindow = 5000;
            query._reset();
            expect(query.paginationWindow).toEqual(15);
        });


        it("Should reset pagination properties", function() {
           query._nextServerFromId = "hey";
           query._nextDBFromId = "ho";
           query._reset();
           expect(query._nextServerFromId).toEqual('');
           expect(query._nextDBFromId).toEqual('');
        });

        it("Should reset _predicate", function() {
            query._predicate = "hey";
            query._reset();
            expect(query._predicate).toEqual(null);
        });

        it("Should trigger a reset change", function() {
            spyOn(query, "_triggerChange");
            query._reset();
            expect(query._triggerChange).toHaveBeenCalledWith({data: [], type: 'reset'});
        });
    });

    describe("The reset() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _reset and _run", function() {
          spyOn(query, "_reset");
          spyOn(query, "_run");
          query.reset();
          expect(query._reset).toHaveBeenCalledWith();
          expect(query._run).toHaveBeenCalledWith();
        });
    });

    describe("The _run() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should decrease page size without firing any requests", function() {
            query.paginationWindow = 10;
            for (var i = 0; i < 20; i++) {
                query.data.push(client.createConversation({
                    participants: ["a"],
                    distinct: false
                }));
            }
            var data = query.data;
            spyOn(query, "_fetchData");
            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "_triggerAsync");

            // Run
            query._run();

            // Posttest
            expect(query.data.length).toEqual(10);
            expect(client._checkAndPurgeCache).toHaveBeenCalledWith(data.slice(10));
            expect(query._fetchData).not.toHaveBeenCalled();
            expect(query._triggerAsync).toHaveBeenCalledWith("change", {data: []});
        });

        it("Should call _fetchData", function() {
            spyOn(query, "_fetchData");

            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [conversation];

            // Run
            query._run();

            // Posttest
            expect(client._checkAndPurgeCache).not.toHaveBeenCalled();
            expect(query._fetchData).toHaveBeenCalledWith(14);
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should not call _fetchData if the model is Conversation and pagedToEnd", function() {
            spyOn(query, "_fetchData");

            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [conversation];
            query.pagedToEnd = true;

            // Run
            query._run();

            // Posttest
            expect(query._fetchData).not.toHaveBeenCalled();
        });

        it("Should do nothing if there are no more results requested", function() {
            for (var i = 0; i < 50; i++) query.data.push(message);
            query.paginationWindow = 50;
            spyOn(query, "_fetchData");
            query._run();
            expect(query._fetchData).not.toHaveBeenCalled();

            // cleanup
            query.data = [];
        });
    });


    describe("The _processRunResults() method", function() {
        var query, requestUrl;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });
            requestUrl = query._firingRequest;
            query._firingRequest = requestUrl;
            query.isFiring = true;
        });

        afterEach(function() {
            query.destroy();
        });


        it("Should set isFiring to false if success", function() {
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 10);
            expect(query.isFiring).toBe(false);
        });

        it("Should set isFiring to false if failure", function() {
            query._processRunResults({
                success: false,
                data: new layer.LayerError({}),
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 10);
            expect(query.isFiring).toBe(false);
        });

        it("Should call _appendResults", function() {
            spyOn(query, "_appendResults");
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            }, requestUrl, 10);
            expect(query._appendResults).toHaveBeenCalledWith({
                success: true,
                data: [{id: "a"}],
                xhr: jasmine.any(Object)
            }, false);
        });


        it("Should not schedule _run if results are up to date", function() {
            spyOn(query, "_run");
            spyOn(query, "_appendResults");
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            }, requestUrl, 10);
            jasmine.clock().tick(10000);
            expect(query._run).not.toHaveBeenCalled();
            query.data = [];
        });




        it("Should not call _appendResults if request is not the most recent request", function() {
            spyOn(query, "_appendResults");
            query._firingRequest = 'fred';
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {}
            }, 'joe', 10);
            expect(query._appendResults).not.toHaveBeenCalled();
        });

        it("Should not call _appendResults if isDestroyed", function() {
            spyOn(query, "_appendResults");
            query.isDestroyed = true;
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {}
            }, 'joe', 10);
            expect(query._appendResults).not.toHaveBeenCalled();

            // Cleanup
            query.isDestroyed = false;
        });

        it("Should not clear isFiring or _firingRequest if request is not the most recent request", function() {
            spyOn(query, "_appendResults");
            query._firingRequest = 'fred';
            query.isFiring = true;
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {}
            }, 'joe', 10);
            expect(query.isFiring).toBe(true);
            expect(query._firingRequest).toEqual('fred');
        });

        it("Should set the totalSize property", function() {
             query._processRunResults({
                success: true,
                data: [responses.message1],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 10);
            expect(query.totalSize).toEqual(6);
        });

        it("Should not set pagedToEnd if the number of requested results is returned", function() {
             query._processRunResults({
                success: true,
                data: [responses.message1, responses.message1, responses.message1, responses.message1],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 4);
            expect(query.pagedToEnd).toBe(false);
        });

        it("Should set pagedToEnd if less than the number of requested results is returned", function() {
             query._processRunResults({
                success: true,
                data: [responses.message1, responses.message1, responses.message1],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 4);
            expect(query.pagedToEnd).toBe(true);
        });

        it("Should refire on client ready if it failed due to authentication", function() {
            client.off();
            query._processRunResults({
                success: false,
                status: 401,
                data: new layer.LayerError({data: {nonce: "fred"}}),
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 4);
            spyOn(query, "_run");
            client.trigger('ready');
            expect(query._run).toHaveBeenCalledWith();
            client.trigger('ready');
            expect(query._run.calls.count()).toEqual(1);
        });
    });

    describe("The _appendResults() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should register new results", function() {
            spyOn(client, "_createObject");
            spyOn(client, "getObject").and.returnValue(conversation);
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            });
            expect(client._createObject).toHaveBeenCalledWith(responses.conversation2);
        });

        it("Should update _nextDBFromId if there is data from DB", function() {
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            }, true);
            expect(query._nextDBFromId).toEqual(responses.conversation2.id);
            expect(query._nextServerFromId).toEqual('');
        });

        it("Should update _nextServerFromId if there is data from Server", function() {
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            }, false);
            expect(query._nextServerFromId).toEqual(responses.conversation2.id);
            expect(query._nextDBFromId).toEqual('');
        });

        it("Should not update _nextXXXFromId if there is no data", function() {
            query._appendResults({data: []}, false);
            query._appendResults({data: []}, true);
            expect(query._nextServerFromId).toEqual('');
            expect(query._nextDBFromId).toEqual('');
        });

        it("Should replace the data if dataType is object", function() {
            query.dataType = "object";
            var oldData = query.data = [conversation];
            conversation.createdAt.setHours(conversation.createdAt.getHours() + 1);

            // Run
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            });

            // Posttest
            expect(query.data).not.toBe(oldData);
            expect(query.data).toEqual([
                jasmine.objectContaining({
                    id: conversation.id
                }),
                jasmine.objectContaining({
                    id: responses.conversation2.id
                })
            ]);
        });

        it("Should update the data if dataType is instance", function() {
            query.dataType = "instance";
            var oldData = query.data = [conversation];

            // Run
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            });

            // Posttest
            expect(query.data).toBe(oldData);
            expect(query.data).toEqual([jasmine.any(layer.Conversation), jasmine.any(layer.Conversation)]);
        });

        it("Should put objects rather than instances if dataType is object", function() {
            query.dataType = "object";
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                    }
                }
            });
            expect(query.data[0] instanceof layer.Conversation).toBe(false);
        });

        it("Should use _getInsertIndex to position result", function() {
          var c1 = client.createConversation({ participants: ["a", "b", "c"] });
          var c2 = client.createConversation({ participants: ["b", "c", "d"] });
          var c3 = JSON.parse(JSON.stringify(responses.conversation2));
          c3.id += "f";
          c1.createdAt = new Date("2010-10-10");
          c2.createdAt = new Date("2010-10-8");
          c3.created_at = new Date("2010-10-9");
          query.data = [c1.toObject(), c2.toObject()];
          query.dataType = "object";
          spyOn(query, "_getInsertIndex").and.callFake(function(conversation, data) {
            expect(conversation).toBe(client.getConversation(c3.id));
            expect(data).toEqual([c1.toObject(), c2.toObject()]);
          }).and.returnValue(1);

          // Run
          query._appendResults({
              data: [c3],
              xhr: {
                getResponseHeader: function(name) {
                    if (name == 'Layout-Count') return 6;
                }
            }
          });

          // Posttest
          expect(query._getInsertIndex).toHaveBeenCalled();
          expect(query.data).toEqual([c1.toObject(), client.getConversation(c3.id).toObject(), c2.toObject()]);
        });
    });

    describe("The _getData() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return itself if dataType is instance", function() {
            query.dataType = "instance";
            expect(query._getData(conversation)).toBe(conversation);
        });

        it("Should return an Object if dataType is object", function() {
            query.dataType = "object";
            expect(query._getData(conversation)).not.toBe(conversation);
            expect(query._getData(conversation).id).toEqual(conversation.id);
            expect(query._getData(conversation) instanceof layer.Conversation).toBe(false);
        });
    });

    describe("The _getInstance() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return itself if its an instance", function() {
            expect(query._getInstance(conversation)).toBe(conversation);
        });

        it("Should return an instance if its an object", function() {
            expect(query._getInstance({id:conversation.id})).toBe(conversation);
        });
    });

    describe("The _getItem() method", function() {
        var query;
        afterEach(function() {
            query.destroy();
        });

        it("Should return a Message if Model is Message and Message is found", function() {
            // Setup
            var m = conversation.createMessage("Hi");
            query = client.createQuery({
                model: layer.Query.Message,
                paginationWindow: 15
            });
            query.data = [m];

            expect(query._getItem(m.id)).toBe(m);
        });

        it("Should return null if Model is Message and Message is not found", function() {
            // Setup
            var m = conversation.createMessage("Hi");
            query = client.createQuery({
                model: layer.Query.Message,
                paginationWindow: 15
            });
            query.data = [m];

            expect(query._getItem(m.id + "1")).toBe(null);
        });

        it("Should return a Conversation if Model is Conversation and Conversation is found", function() {
            query = client.createQuery({
                model: layer.Query.Conversation,
                paginationWindow: 15
            });
            query.data = [conversation];
            expect(query._getItem(conversation.id)).toBe(conversation);
        });

        it("Should return null if Model is Conversation and Conversation is not found", function() {
            query = client.createQuery({
                model: layer.Query.Conversation,
                paginationWindow: 15
            });
            query.data = [conversation];
            expect(query._getItem(conversation.id + "1")).toBe(null);
        });

        it("Should return a Message if Model is Conversation and lastMessage is found", function() {
            query = client.createQuery({
                model: layer.Query.Conversation,
                paginationWindow: 15
            });
            query.data = [conversation];
            var m = conversation.createMessage("Hi");
            conversation.lastMessage = m;
            expect(query._getItem(m.id)).toBe(m);
        });

        it("Should return null if Model is Conversation and lastMessage is not found", function() {
            query = client.createQuery({
                model: layer.Query.Conversation,
                paginationWindow: 15
            });
            query.data = [conversation];
            var m = conversation.createMessage("Hi");
            conversation.lastMessage = m;
            expect(query._getItem(m.id + "1")).toBe(null);
        });

        it("Should return an Announcement if Model is Announcement and Announcement is found", function() {
            // Setup
            query = client.createQuery({
                model: layer.Query.Announcement,
                paginationWindow: 15
            });
            query.data = [announcement];

            expect(query._getItem(announcement.id)).toBe(announcement);
        });

        it("Should return null if Model is Announcement and Announcement is not found", function() {
            // Setup
            query = client.createQuery({
                model: layer.Query.Announcement,
                paginationWindow: 15
            });
            query.data = [announcement];

            expect(query._getItem(announcement.id + "1")).toBe(null);
        });

        it("Should return an Identity if Model is Identity and Identity is found", function() {
            // Setup
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15
            });
            query.data = [identity];

            expect(query._getItem(identity.id)).toBe(identity);
        });

        it("Should return null if Model is Identity and Identity is not found", function() {
            // Setup
            query = client.createQuery({
                model: layer.Query.Identity,
                paginationWindow: 15
            });
            query.data = [identity];;

            expect(query._getItem(identity.id + "1")).toBe(null);
        });
    });

    describe("The _getIndex() method", function() {
        var query;
        beforeEach(function() {
            query = client.createQuery({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
            query.data = [conversation];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return the index of a matching ID", function() {
            expect(query._getIndex(conversation.id)).toBe(0);
        });

        it("Should return -1 if not found", function() {
            expect(query._getIndex(conversation.id + "1")).toBe(-1);
        });
    });


    describe('The _triggerChange() method', function() {
      var query;
      beforeEach(function() {
          query = client.createQuery({
              client: client,
              model: 'Message',
              paginationWindow: 15,
              dataType: "object",
              predicate: "conversation.id = '" + conversation.id + "'"
          });
      });

      afterEach(function() {
          query.destroy();
      });

      it("Should trigger the change event", function() {
        var spy = jasmine.createSpy('change-event');
        query.on('change', spy);
        query._triggerChange({
          type: 'insert'
        });
        expect(spy).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));
        expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
          type: 'insert'
        }));
      });

      it("Should trigger the change:type event", function() {
        var spy = jasmine.createSpy('change-event');
        query.on('change:insert', spy);
        query._triggerChange({
          type: 'insert'
        });
        expect(spy).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));
        expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
          type: 'insert'
        }));

      });
    });

    describe("The size property getter", function() {
      var query;
      beforeEach(function() {
          query = client.createQuery({
              client: client,
              model: 'Message',
              paginationWindow: 15,
              dataType: "object",
              predicate: "conversation.id = '" + conversation.id + "'"
          });

      });

      afterEach(function() {
          query.destroy();
      });
      it("Should have the correct size", function() {
        query.data = [conversation.createMessage("a"), conversation.createMessage("b"), conversation.createMessage("c")];
        expect(query.size).toEqual(3);
      });

      it("Should handle null data", function() {
        query.data = null;
        expect(query.size).toEqual(0);

        // cleanup
        query.data = [];
      });
    });
});
