/* eslint-disable */
describe("The Websocket Socket Manager Class", function() {
    var socket, client, websocketManager;
    var appId = "Fred's App";
    var nativeWebsocket;

    beforeAll(function() {
        // Test for phantomjs websocket handling
        nativeWebsocket = window.WebSocket;
        window.WebSocket = function WebSocket(url) {
            this.url = url;
            this.close = function() {};
            this.send = function() {};
            this.addEventListener = function() {};
            this.removeEventListener = function() {};
        };
        window.WebSocket.CONNECTING = 0;
        window.WebSocket.OPEN = 1;
        window.WebSocket.CLOSING = 2;
        window.WebSocket.CLOSED = 3;
   });

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
        client.telemetryMonitor.state.records = [];
        client.onlineManager.isOnline = true;

        websocketManager = client.socketManager;

        conversation = client._createObject(responses.conversation1).conversation;
        requests.reset();
        client.syncManager.queue = [];
        jasmine.clock().tick(1);
        client.isAuthenticated = true;
        client._clientReady();
        websocketManager.connect();
        websocketManager._socket.readyState = WebSocket.OPEN;
    });

    afterEach(function() {
        jasmine.Ajax.uninstall();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        window.WebSocket = nativeWebsocket;
        layer.Client.destroyAllClients();
    });

    describe("The constructor() method", function() {
        it("Should return a WebsocketManager", function() {
            expect(new layer.Websockets.SocketManager({
                client: client
            })).toEqual(jasmine.any(layer.Websockets.SocketManager));
        });

        it("Should throw an error if no client", function() {
            expect(function() {
                new layer.Websockets.SocketManager({});
            }).toThrow();
        });

        it("Should call connect if client is authenticated", function() {
            var tmp = layer.Websockets.SocketManager.prototype.connect;
            spyOn(layer.Websockets.SocketManager.prototype, "connect");
            client.isAuthenticated = true;

            // Run
            new layer.Websockets.SocketManager({
                client: client
            });

            // Posttest
            expect(layer.Websockets.SocketManager.prototype.connect).toHaveBeenCalledWith();

            // Cleanup
            layer.Websockets.SocketManager.prototype.connect = tmp;
        });

        it("Should skip connect if client is not authenticated", function() {
            var tmp = layer.Websockets.SocketManager.prototype.connect;
            spyOn(layer.Websockets.SocketManager.prototype, "connect");
            client.isAuthenticated = false;

            // Run
            new layer.Websockets.SocketManager({
                client: client
            });

            // Posttest
            expect(layer.Websockets.SocketManager.prototype.connect).not.toHaveBeenCalled();

            // Cleanup
            layer.Websockets.SocketManager.prototype.connect = tmp;
        });

        it("Should subscribe to call connect on client authenticated", function() {
            var oldSocket = websocketManager._socket;
            client.trigger("authenticated");
            expect(oldSocket).not.toBe(websocketManager._socket);
        });
    });

    describe("The _reset() method", function() {
      // This is the one thing that Really matters.
      it("Should clear _hasZeroCounter", function() {
        websocketManager._hasZeroCounter = true;
        websocketManager._reset();
        expect(websocketManager._hasZeroCounter).toBe(false);
      });
    });

    describe("The _onlineStateChange() method", function() {
      it("Should call _reconnect(false) if online without a reset", function() {
        spyOn(websocketManager, "close");
        spyOn(websocketManager, "_reconnect");

        websocketManager._onlineStateChange({
          eventName: "online",
          isOnline: true,
          reset: false
        });

        expect(websocketManager.close).not.toHaveBeenCalled();
        expect(websocketManager._reconnect).toHaveBeenCalledWith(false);
      });

      it("Should call _reconnect(true) if online event is a reset", function() {
        spyOn(websocketManager, "_reconnect");

        websocketManager._onlineStateChange({
          eventName: "online",
          isOnline: true,
          reset: true
        });

        expect(websocketManager._reconnect).toHaveBeenCalledWith(true);
      });

      it("Should close if offline", function() {
        spyOn(websocketManager, "close");
        spyOn(websocketManager, "_reconnect");

        websocketManager._onlineStateChange({
          eventName: "online",
          isOnline: false
        });

        expect(websocketManager.close).toHaveBeenCalledWith();
        expect(websocketManager._reconnect).not.toHaveBeenCalled();
      });

    });

    describe("The _reconnect() method", function() {
      it("Should close _reset and connect if resetting", function() {
        spyOn(websocketManager, "close");
        spyOn(websocketManager, "_reset");
        spyOn(websocketManager, "connect");

        websocketManager._reconnect(true);

        expect(websocketManager.close).toHaveBeenCalledWith();
        expect(websocketManager._reset).toHaveBeenCalled();
        expect(websocketManager.connect).toHaveBeenCalled();
      });

      it("Should close and connect if not resetting", function() {
        spyOn(websocketManager, "close");
        spyOn(websocketManager, "_reset");
        spyOn(websocketManager, "connect");

        websocketManager._reconnect(false);

        expect(websocketManager.close).toHaveBeenCalledWith();
        expect(websocketManager._reset).not.toHaveBeenCalled();
        expect(websocketManager.connect).toHaveBeenCalled();
      });
    });

    describe("The connect() method", function() {
        it("Should clear state", function() {
            websocketManager._closing = true;

            // Run
            websocketManager.connect();

            // Posttest
            expect(websocketManager._closing).toEqual(false);
        });

        it("Should create a websocket connection", function() {
            websocketManager._socket = null;
            websocketManager.connect();
            expect(websocketManager._socket).toEqual(jasmine.any(WebSocket));
        });

        it("Should use the correct default url", function() {
           websocketManager._socket = null;
           websocketManager.connect();
           expect(websocketManager._socket.url).toEqual('wss://websockets.layer.com/?session_token=sessionToken&client-id=' +
           client._tabId + "&layer-xdk-version=" + client.constructor.version);
        });

        it("Should allow customization of the websocket url", function() {
            client.websocketUrl = 'wss://staging-websockets.layer.com';
            websocketManager._socket = null;
            websocketManager.connect();
            expect(websocketManager._socket.url).toEqual('wss://staging-websockets.layer.com/?session_token=sessionToken&client-id=' +
            client._tabId + "&layer-xdk-version=" + client.constructor.version);
        });

        it("Should be subscribed to websocket events", function(done) {
            spyOn(websocketManager, "_onSocketClose").and.callFake(function() {
                expect(1).toEqual(1);
                done();
            });
            websocketManager._socket = null;
            websocketManager.connect();
            websocketManager.close();
        });

        it("Should schedule _connectionFailed to be called", function() {
          websocketManager._connectionFailedId = 0;
          spyOn(websocketManager, "_connectionFailed");

          // Run
          websocketManager.connect();

          // Posttest
          expect(websocketManager._connectionFailedId).not.toEqual(0);
          expect(websocketManager._connectionFailed).not.toHaveBeenCalled();
          jasmine.clock().tick(5001);
          expect(websocketManager._connectionFailed).toHaveBeenCalledWith();
        });

        it("Should call reconnect if there is an existing socket", function() {
            spyOn(websocketManager, "_reconnect");
            websocketManager._socket = null;
            websocketManager.connect();
            expect(websocketManager._socket).not.toBe(null);
            expect(websocketManager._reconnect).not.toHaveBeenCalled();

            // Run
            websocketManager.connect();

            // Posttest
            expect(websocketManager._reconnect).toHaveBeenCalledWith();
        });

        it("Should not connect if client.disconnect() has been called", function() {
            expect(websocketManager._socket).not.toBe(null);

            // Prevents connect
            client.disconnect();
            websocketManager.connect();
            expect(websocketManager._socket).toBe(null);

            // Enables connect
            client.reconnect();
            expect(websocketManager._socket).not.toBe(null);
        });
    });

    describe("The _clearConnectionFailed() method", function() {
      it("Should clear the timeout", function() {
	        websocketManager._connectionFailedId = 10;
          websocketManager._clearConnectionFailed();
          expect(websocketManager._connectionFailedId).toEqual(0);
      });
    });

    describe("The _onOpen() method", function() {
        beforeEach(function() {
            websocketManager.isOpen = false;
            websocketManager._lostConnectionCount = 5;
        });
        it("Should do nothing if _isOpen() returns false", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(false);
            websocketManager._onOpen();
            expect(websocketManager.isOpen).toEqual(false);
        });

        it("Should reset _lostConnectionCount", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._onOpen();
            expect(websocketManager._lostConnectionCount).toEqual(0);
        });

        it("Should set isOpen", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._onOpen();
            expect(websocketManager.isOpen).toEqual(true);
        });

        it("Should trigger connected", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            spyOn(websocketManager, "trigger");

            // Run
            websocketManager._onOpen();

            // Posttest
            expect(websocketManager.trigger).toHaveBeenCalledWith("connected");
        });

        it("Should call resync if there is a Zero counter already seen", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._hasZeroCounter = true;
            websocketManager._lastTimestamp = Date.now();
            spyOn(websocketManager, "resync");

            // Run
            websocketManager._onOpen();

            // Posttest
            expect(websocketManager.resync).toHaveBeenCalledWith(websocketManager._lastTimestamp);
        });

        it("Should skip resync and call if there has not been a zero counter seen", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._hasZeroCounter = false;
            websocketManager._lastTimestamp = Date.now();
            spyOn(websocketManager, "resync");
            spyOn(websocketManager, "_reschedulePing");

            // Run
            websocketManager._onOpen();

            // Posttest
            expect(websocketManager.resync).not.toHaveBeenCalled();
            expect(websocketManager._reschedulePing).toHaveBeenCalledWith();
        });

        it("Should call _clearConnectionFailed", function() {
          spyOn(websocketManager, "_clearConnectionFailed");

          // Run
          websocketManager._onOpen();

          // Posttest
          expect(websocketManager._clearConnectionFailed).toHaveBeenCalledWith();
        });
    });

    describe("The _isOpen() method", function() {
        it("Should return false if there is no websocket", function() {
            websocketManager._socket = null;
            expect(websocketManager._isOpen()).toEqual(false);
        });

        it("Should return false if readyState != open", function() {
            websocketManager._socket.readyState = WebSocket.CLOSED;
            expect(websocketManager._isOpen()).toEqual(false);
        });

        it("Should return true if readyState == open", function() {
            websocketManager._socket.readyState = WebSocket.OPEN;
            expect(websocketManager._isOpen()).toEqual(true);
        });
    });

    describe("The _onError() method", function() {

        it("Should do nothing if _closing is true", function() {
            websocketManager._closing = true;
            websocketManager.isOpen = true;
            spyOn(websocketManager, "_onSocketClose");

            // Run
            websocketManager._onError();

            // Posttest
            expect(websocketManager._onSocketClose).not.toHaveBeenCalled();
        });

        it("Should increment _lostConnectionCount if not isOpen", function() {
            websocketManager._lostConnectionCount = 5;
            websocketManager.isOpen = false;

            // Run
            websocketManager._onError();

            // Posttest
            expect(websocketManager._lostConnectionCount).toEqual(6);
        });

        it("Should call _scheduleReconnect if not isOpen", function() {
            websocketManager.isOpen = false;
            spyOn(websocketManager, "_scheduleReconnect");

            // Run
            websocketManager._onError();

            // Posttest
            expect(websocketManager._scheduleReconnect).toHaveBeenCalledWith();
        });

        it("Should call _removeSocketEvents if not isOpen", function() {
            websocketManager.isOpen = false;
            spyOn(websocketManager, "_removeSocketEvents");

            // Run
            websocketManager._onError();

            // Posttest
            expect(websocketManager._removeSocketEvents).toHaveBeenCalledWith();
        });

        it("Should call _onSocketClose if isOpen", function() {
            websocketManager.isOpen = true;
            spyOn(websocketManager, "_onSocketClose");

            // Run
            websocketManager._onError();

            // Posttest
            expect(websocketManager._onSocketClose).toHaveBeenCalledWith();
        });

        it("Should call socket.close if isOpen", function() {
            websocketManager.isOpen = true;
            var spy = websocketManager._socket.close = jasmine.createSpy('close');

            // Run
            websocketManager._onError();

            // Posttest
            expect(spy).toHaveBeenCalledWith();
        });

        it("Should clear socket", function() {
            websocketManager.isOpen = true;

            // Run
            websocketManager._onError();

            // Posttest
            expect(websocketManager._socket).toBe(null);
        });

        it("Should call _clearConnectionFailed", function() {
          spyOn(websocketManager, "_clearConnectionFailed");

          // Run
          websocketManager._onError();

          // Posttest
          expect(websocketManager._clearConnectionFailed).toHaveBeenCalledWith();
        });
    });

    describe("The sendSignal() method", function() {
        it("Should call _socket.send", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._socket.send = jasmine.createSpy('send');
            websocketManager.sendSignal({hey: "ho"});
            expect(websocketManager._socket.send).toHaveBeenCalledWith(JSON.stringify({
                type: "signal",
                body: {hey: "ho"}
            }));
        });

        it("Should not call _socket.send if not open", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(false);
            websocketManager._socket.send = jasmine.createSpy('send');
            websocketManager.sendSignal({hey: "ho"});
            expect(websocketManager._socket.send).not.toHaveBeenCalled();
        });
    });


    describe("The getCounter() method", function() {
        it("Should call sendRequest", function() {
            spyOn(client.socketRequestManager, "sendRequest");
            websocketManager.getCounter();
            expect(client.socketRequestManager.sendRequest).toHaveBeenCalledWith({
                data: {
                    method: "Counter.read"
                },
                callback: jasmine.any(Function),
                isChangesArray: false
            });
        });


        it("Should call the callback", function() {
            var spy = jasmine.createSpy('spy');
            spyOn(client.socketRequestManager, "sendRequest").and.callFake(function(options) {
                options.callback({
                    success: true,
                    data: {counter: 5},
                    fullData: {counter: 4, data: {counter: 5}}
                });
            });

            // Run
            websocketManager.getCounter(spy);

            // Posttest
            expect(spy).toHaveBeenCalledWith(true, 5, 4);
        });

        it("Should only call once per second, and ignore more than one additional request", function() {
           spyOn(client.socketRequestManager, "sendRequest");

           // Run test
           websocketManager.getCounter();
           websocketManager.getCounter();
           websocketManager.getCounter();
           websocketManager.getCounter();
           websocketManager.getCounter();

           // Posttest
           var presenceSyncCount = client.socketRequestManager.sendRequest.calls.allArgs().filter(function(request) {
               return request[0].data.method === "Presence.sync";
            }).length;
           expect(presenceSyncCount).toEqual(0);

           jasmine.clock().tick(1000);
           presenceSyncCount = client.socketRequestManager.sendRequest.calls.allArgs().filter(function(request) {
               return request[0].data.method === "Presence.sync";
            }).length;
           expect(presenceSyncCount).toEqual(1);

           jasmine.clock().tick(10000);
           presenceSyncCount = client.socketRequestManager.sendRequest.calls.allArgs().filter(function(request) {
               return request[0].data.method === "Presence.sync";
            }).length;
           expect(presenceSyncCount).toEqual(1);
       });
    });

    describe("The resync() method", function() {
        var timestamp;
        beforeEach(function() {
            timestamp = new Date();
            timestamp.setHours(timestamp.getHours() - 1);
        });

        it("Should require a timestamp", function() {
            expect(function() {
                websocketManager.resync(false);
            }).toThrowError(layer.LayerError.dictionary.valueNotSupported);

            expect(function() {
                websocketManager.resync();
            }).toThrowError(layer.LayerError.dictionary.valueNotSupported);

            expect(function() {
                websocketManager.resync(new Date().toISOString());
            }).not.toThrow();

            expect(function() {
                websocketManager.resync(new Date().getTime());
            }).not.toThrow();
        });

        it("Should call _replayEvents", function() {
            spyOn(websocketManager, "_replayEvents");
            websocketManager.resync(timestamp);
            expect(websocketManager._replayEvents).toHaveBeenCalledWith(timestamp, jasmine.any(Function));
        });

        it("Should call _enablePresence", function() {
            spyOn(websocketManager, "_enablePresence")
            spyOn(websocketManager, "_replayEvents").and.callFake(function(timestamp, callback) {
                callback();
            });
            websocketManager.resync(timestamp);
            expect(websocketManager._enablePresence).toHaveBeenCalledWith(timestamp, jasmine.any(Function));
        });

        it("Should trigger 'synced'", function() {
            spyOn(websocketManager, "trigger");
            spyOn(websocketManager, "_enablePresence").and.callFake(function(timestamp, callback) {
                callback();
            });
            spyOn(websocketManager, "_replayEvents").and.callFake(function(timestamp, callback) {
                callback();
            });
            websocketManager.resync(timestamp);
            expect(websocketManager.trigger).toHaveBeenCalledWith("synced");
        });

        it("Should call callback", function() {
            client.socketRequestManager._reset();
            var spy = jasmine.createSpy('callback');
            websocketManager.resync(timestamp, spy);

            var requests = client.socketRequestManager._requestCallbacks;
            var request, requestId;

            // Handle the call to _replayEvents
            Object.keys(requests).forEach(function(key) {
                request = requests[key];
                requestId = key;
            });
            client.socketRequestManager._processResponse(requestId, {
                data: {
                    body: {
                        success: true,
                        data: {
                            message: "hey ho"
                        }
                    }
                }
            });

            // Handle the call to _enablePresence
            Object.keys(requests).forEach(function(key) {
                request = requests[key];
                requestId = key;
            });
            client.socketRequestManager._processResponse(requestId, {
                data: {
                    body: {
                        success: true,
                        data: {
                            changes: []
                        }
                    }
                }
            });

            expect(spy).toHaveBeenCalledWith();
        });

        it("Should cancel any/all resync operations currently inflight", function() {
            spyOn(client.socketRequestManager, "cancelOperation");
            websocketManager.resync(timestamp);
            expect(client.socketRequestManager.cancelOperation).toHaveBeenCalledWith("Event.replay");
            expect(client.socketRequestManager.cancelOperation).toHaveBeenCalledWith("Presence.sync");
        });
    });

    describe("The _replayEvents() method", function() {
        var timestamp, nexttimestamp;
        beforeEach(function() {
            timestamp = new Date();
            timestamp.setHours(timestamp.getHours() - 1); // make sure these are different from new Date() which the system might use
            nexttimestamp = new Date();
            nexttimestamp.setHours(nexttimestamp.getHours() + 1);
        });

        it("Should update _needsReplayFrom if socket is closed and _needsReplayFrom unset", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(false);
            websocketManager._needsReplayFrom = null;
            websocketManager._replayEvents(timestamp);
            expect(websocketManager._needsReplayFrom).toBe(timestamp);
        });

        it("Should NOT update _needsReplayFrom if socket is open and _needsReplayFrom unset", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._needsReplayFrom = null;
            websocketManager._replayEvents(timestamp);
            expect(websocketManager._needsReplayFrom).toBe(null);
        });

        it("Should NOT update _needsReplayFrom if socket is open and _needsReplayFrom is set", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            websocketManager._needsReplayFrom = nexttimestamp;
            websocketManager._replayEvents(timestamp);
            expect(websocketManager._needsReplayFrom).toEqual(nexttimestamp);
        });

        it("Should send Event.replay", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            spyOn(client.socketRequestManager, "sendRequest");
            websocketManager._replayEvents(timestamp, true);
            expect(client.socketRequestManager.sendRequest).toHaveBeenCalledWith({
                data: {
                    method: 'Event.replay',
                    data: {
                        from_timestamp: timestamp
                    }
                },
                callback: jasmine.any(Function),
                isChangesArray: false
            });
        });

        it("Should call sendRequest", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            spyOn(client.socketRequestManager, "sendRequest");
            websocketManager._inReplay = false;
            websocketManager._replayEvents(timestamp.toISOString());
            expect(client.socketRequestManager.sendRequest).toHaveBeenCalledWith({
                data: {
                    method: "Event.replay",
                    data: {from_timestamp: timestamp.toISOString()}
                },
                callback: jasmine.any(Function),
                isChangesArray: false
            });
        });

        it("Should call _replayEventsComplete", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            var spy = jasmine.createSpy('callback');
            spyOn(client.socketRequestManager, "sendRequest").and.callFake(function(request) {
                request.callback({success: true});
            });
            spyOn(websocketManager, "_replayEventsComplete");
            websocketManager._inReplay = false;
            websocketManager._replayEvents(timestamp, spy);
            expect(websocketManager._replayEventsComplete).toHaveBeenCalledWith(timestamp, spy, true);
        });

        it("Should just update _needsReplayFrom if offline", function() {
          spyOn(websocketManager, "_isOpen").and.returnValue(false);
          expect(websocketManager._needsReplayFrom).toBe(null);
          websocketManager._replayEvents(timestamp, false);
          expect(websocketManager._needsReplayFrom).toEqual(timestamp);
        });
    });

    describe("The _replayEventsCompleteWithRetries() method", function() {
        var callback, timestamp, nexttimestamp;
        beforeEach(function() {
            timestamp = new Date();
            timestamp.setHours(timestamp.getHours() - 1); // make sure these are different from new Date() which the system might use
            nexttimestamp = new Date();
            nexttimestamp.setHours(nexttimestamp.getHours() + 1);
            callback = jasmine.createSpy('callback');
            layer.Websockets.SocketManager.ENABLE_REPLAY_RETRIES = true;
        });

        afterEach(function() {
            layer.Websockets.SocketManager.ENABLE_REPLAY_RETRIES = false;
        });

        it("Should call callback if completely done", function() {
            websocketManager._needsReplayFrom = null;

            // Run
            websocketManager._replayEventsComplete(timestamp, callback, true);

            // Posttest
            expect(callback).toHaveBeenCalledWith();
        });

        it("Should recall _replayEvents if another round was requested", function() {
            websocketManager._needsReplayFrom = nexttimestamp;
            spyOn(websocketManager, "trigger");
            spyOn(websocketManager, "_replayEvents");

            // Run
            websocketManager._replayEventsComplete(timestamp, callback, true);

            // Posttest
            expect(callback).not.toHaveBeenCalled();
            expect(websocketManager._replayEvents).toHaveBeenCalledWith(nexttimestamp);
        });

        it("Should schedule retry _replayEvents if it failed", function() {
            websocketManager._needsReplayFrom = nexttimestamp;
            spyOn(websocketManager, "trigger");
            spyOn(websocketManager, "_replayEvents");

            // Run
            websocketManager._replayEventsComplete(timestamp, callback, false);
            expect(websocketManager._replayEvents).not.toHaveBeenCalledWith(timestamp);

            // Posttest
            jasmine.clock().tick(3000);
            expect(callback).not.toHaveBeenCalled();
            expect(websocketManager._replayEvents).toHaveBeenCalledWith(timestamp);
        });


        it("Should stop scheduling retry _replayEvents after repeated failure", function() {
            websocketManager._needsReplayFrom = nexttimestamp;
            spyOn(websocketManager, "trigger");
            spyOn(websocketManager, "_replayEvents").and.callFake(function() {
                websocketManager._replayEventsComplete(timestamp, callback, false);
            });

            // Run
            websocketManager._replayEventsComplete(timestamp, callback, false);
            jasmine.clock().tick(100000000);

            // Posttest
            expect(websocketManager._replayEvents.calls.count() < 20).toBe(true);
        });
    });

    describe("The _replayEventsCompleteWithoutRetries() method", function() {
        var callback, timestamp, nexttimestamp;
        beforeEach(function() {
            timestamp = new Date();
            timestamp.setHours(timestamp.getHours() - 1); // make sure these are different from new Date() which the system might use
            nexttimestamp = new Date();
            nexttimestamp.setHours(nexttimestamp.getHours() + 1);
            callback = jasmine.createSpy('callback');
        });

        it("Should call callback if completely done", function() {
            websocketManager._needsReplayFrom = null;

            // Run
            websocketManager._replayEventsComplete(timestamp, callback, true);

            // Posttest
            expect(callback).toHaveBeenCalledWith();
        });


        it("Should not schedule retries", function() {
            websocketManager._needsReplayFrom = nexttimestamp;
            spyOn(websocketManager, "trigger");
            spyOn(websocketManager, "_replayEvents").and.callFake(function() {
                websocketManager._replayEventsComplete(timestamp, callback, false);
            });

            // Run
            websocketManager._replayEventsComplete(timestamp, callback, false);
            jasmine.clock().tick(100000000);

            // Posttest
            expect(websocketManager._replayEvents.calls.count() ).toBe(0);
        });
    });

    describe("The syncPresence() method", function() {
        it("Should call Presence.sync with your timestamp", function() {
            var d = new Date();
            var spy = jasmine.createSpy('callback');
            spyOn(client.socketRequestManager, "sendRequest");
            websocketManager.syncPresence(d.toISOString(), spy);
            expect(client.socketRequestManager.sendRequest).toHaveBeenCalledWith({
                data: {
                    method: 'Presence.sync',
                    data: {
                        since: d.toISOString(),
                    },
                },
                callback: spy,
                isChangesArray: true
            });
        });

        it("Should call callback if invoked with your timestamp", function() {
            var d = new Date();
            var spy = jasmine.createSpy("callback");
            var request = websocketManager.syncPresence(d.toISOString(), spy);
            var response = {
                data: {
                    body: {
                        success: true,
                        data: {
                            changes: []
                        }
                    }
                }
            };
            client.socketRequestManager._processResponse(request.request_id, response);
            expect(spy).toHaveBeenCalledWith({
                success: true,
                fullData: response.data,
                data: response.data.body.data
            });
        });
    });

    describe("The _enablePresence() method", function() {
        it("Should subscribe to presence", function() {
            spyOn(client.socketRequestManager, "sendRequest");
            websocketManager._enablePresence();
            expect(client.socketRequestManager.sendRequest).toHaveBeenCalledWith({
                data: {
                    method: 'Presence.subscribe'
                },
                callback: null,
                isChangesArray: false
            });
        });

        it("Should send auto status", function() {
            spyOn(client.socketRequestManager, "sendRequest");
            websocketManager._enablePresence();
            expect(client.socketRequestManager.sendRequest).toHaveBeenCalledWith({
                data: {
                    method: 'Presence.update',
                    data: [
                        { operation: 'set', property: 'status', value: 'auto' },
                    ]
                },
                callback: null,
                isChangesArray: false
            });

            client.socketRequestManager.sendRequest.calls.reset();
            client.isPresenceEnabled = false;
            websocketManager._enablePresence();
            expect(client.socketRequestManager.sendRequest).not.toHaveBeenCalledWith({
                data: {
                    method: 'Presence.update',
                    data: [
                        { operation: 'set', property: 'status', value: 'auto' },
                    ],
                },
                callback: null,
                isChangesArray: false
            });
        });

        it("Should call syncPresence", function() {
            spyOn(websocketManager, "syncPresence");
            var time = new Date().toISOString();
            var spy = jasmine.createSpy('callback');
            websocketManager._enablePresence(time, spy);
            expect(websocketManager.syncPresence).toHaveBeenCalledWith(time, spy);

            websocketManager.syncPresence.calls.reset();
            websocketManager._enablePresence(null, spy);
            expect(websocketManager.syncPresence).not.toHaveBeenCalled();
        });
    });

    describe("The _onMessage() method", function() {
        beforeEach(function() {
            spyOn(websocketManager, "resync");
        });

        it("Should manage zero counters correctly", function() {
            // Pretest
            expect(websocketManager._hasZeroCounter).toBe(false);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // First number
            websocketManager._onMessage({data: JSON.stringify({
                counter: 6
            })});
            expect(websocketManager._hasZeroCounter).toBe(false);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // Second number
            websocketManager._onMessage({data: JSON.stringify({
                counter: 4
            })});
            expect(websocketManager._hasZeroCounter).toBe(false);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // First 0
            websocketManager._onMessage({data: JSON.stringify({
                counter: 0
            })});
            expect(websocketManager._hasZeroCounter).toBe(true);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // Third number
            websocketManager._onMessage({data: JSON.stringify({
                counter: 8
            })});
            expect(websocketManager._hasZeroCounter).toBe(true);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // Fourth number
            websocketManager._onMessage({data: JSON.stringify({
                counter: 7
            })});
            expect(websocketManager._hasZeroCounter).toBe(true);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // Second 0
            websocketManager._onMessage({data: JSON.stringify({
                counter: 0
            })});
            expect(websocketManager._hasZeroCounter).toBe(true);
            expect(websocketManager.resync).toHaveBeenCalled();
            websocketManager.resync.calls.reset();

            // Fifth number
            websocketManager._onMessage({data: JSON.stringify({
                counter: 10
            })});
            expect(websocketManager._hasZeroCounter).toBe(true);
            expect(websocketManager.resync).not.toHaveBeenCalled();

            // Third 0
            websocketManager._onMessage({data: JSON.stringify({
                counter: 0
            })});
            expect(websocketManager._hasZeroCounter).toBe(true);
            expect(websocketManager.resync).toHaveBeenCalled();
        });

        it("Should clear _lostConnectionCount", function() {
            websocketManager._lostConnectionCount = 5;
            websocketManager._onMessage({data: JSON.stringify({
                counter: 6
            })});
            expect(websocketManager._lostConnectionCount).toEqual(0);
        });


        it("Should update _lastTimestamp", function() {
            websocketManager._lastTimestamp = "fred";
            websocketManager._onMessage({data: JSON.stringify({
                timestamp: new Date("10/10/2010"),
                counter: 6
            })});
            expect(websocketManager._lastTimestamp).toEqual(new Date("10/10/2010").getTime());
        });

        it("Should not update _lastTimestamp if resync was called", function() {
            websocketManager._lastTimestamp = "fred";
            websocketManager._hasZeroCounter = true;
            websocketManager._onMessage({data: JSON.stringify({
                counter: 0,
                timestamp: "doh"
            })});
            expect(websocketManager._lastTimestamp).toEqual("fred");
        });

        it("Should trigger message event", function() {
            spyOn(websocketManager, "trigger");
            websocketManager._onMessage({data: JSON.stringify({
                timestamp: "doh",
                counter: 6,
                body: {hey: "ho"}
            })});
            expect(websocketManager.trigger).toHaveBeenCalledWith('message', {
              data: {
                timestamp: "doh",
                counter: 6,
                body: {hey: "ho"}
              }
            });
        });

        it("Should call _reschedulePing", function() {
            spyOn(websocketManager, "_reschedulePing");
            websocketManager._onMessage({data: JSON.stringify({
                timestamp: "doh",
                counter: 6
            })});
            expect(websocketManager._reschedulePing).toHaveBeenCalledWith();
        });
    });

    describe("The _reschedulePing() method", function() {
        it("Should schedule a ping request", function() {
            spyOn(websocketManager, "_ping");
            websocketManager.pingFrequency = 10;

            // Run
            websocketManager._reschedulePing();
            jasmine.clock().tick(9);
            expect(websocketManager._ping).not.toHaveBeenCalled();
            jasmine.clock().tick(2);

            // Posttest
            expect(websocketManager._ping).toHaveBeenCalledWith();
        });

        it("Should cancel any prior scheduled ping request", function() {
            spyOn(websocketManager, "_ping");
            websocketManager.pingFrequency = 10;

            // Run
            websocketManager._reschedulePing();
            jasmine.clock().tick(9);
            websocketManager._reschedulePing();
            jasmine.clock().tick(2);

            // Posttest
            expect(websocketManager._ping).not.toHaveBeenCalled();
        });
    });

    describe("The _ping() method", function() {
        it("Should not call getCounter if not connected", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(false);
            spyOn(websocketManager, "getCounter");
            websocketManager._socket.readyState = WebSocket.CLOSED;
            websocketManager._ping();
            expect(websocketManager.getCounter).not.toHaveBeenCalled();
        });

        it("Should call getCounter", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);
            spyOn(websocketManager, "getCounter");
            websocketManager._socket.readyState = WebSocket.OPEN;
            websocketManager._ping();
            expect(websocketManager.getCounter).toHaveBeenCalledWith(jasmine.any(Function));
        });

        it("Should call _reschedulePing", function() {
            spyOn(websocketManager, "_isOpen").and.returnValue(true);

            spyOn(websocketManager, "_reschedulePing");
            spyOn(websocketManager, "getCounter").and.callFake(function(callback) {
                callback();
            });
            websocketManager._socket.readyState = WebSocket.OPEN;

            // Run
            websocketManager._ping();

            // Posttest
            expect(websocketManager._reschedulePing).toHaveBeenCalledWith();
        });
    });

    describe("the close() method", function() {
        var spy;
        beforeEach(function() {
            spy = jasmine.createSpy('close');
            websocketManager._socket.close = spy;
        });

        it("Should set _closing to true", function() {
            websocketManager._closing = false;
            websocketManager.close();
            expect(websocketManager._closing).toBe(true);
        });

        it("Should not have errors if called when there is no websocket", function() {
            websocketManager._socket = null;
            expect(function() {
                websocketManager.close();
            }).not.toThrow();
        });

        it("Should call _onSocketClose", function() {
            spyOn(websocketManager, "_onSocketClose");
            websocketManager.close();
            expect(websocketManager._onSocketClose).toHaveBeenCalledWith();
        });

        it("Should call close", function() {
            websocketManager.close();
            expect(spy).toHaveBeenCalledWith();
        });

        it("Should clear the websocket", function() {
            websocketManager.close();
            expect(websocketManager._socket).toBe(null);
        });
    });

    describe("The destroy() method", function() {
        afterEach(function() {
          websocketManager = client.socketManager = new layer.Websockets.SocketManager({client: client});
        });
        it("Should call close", function() {
            spyOn(websocketManager, "close");
            websocketManager.destroy();
            expect(websocketManager.close).toHaveBeenCalledWith();
        });

        it("Should clear _nextPingId", function() {
            var spy = jasmine.createSpy('timeout');
            websocketManager._nextPingId = setTimeout(spy, 10);
            websocketManager.destroy();
            jasmine.clock().tick(100);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe("The _onSocketClose() method", function() {
        it("Should set _isOpen to false", function() {
            websocketManager.isOpen = true;
            websocketManager._onSocketClose();
            expect(websocketManager.isOpen).toBe(false);
        });

        it("Should call _scheduleReconnect if not closing", function() {
            spyOn(websocketManager, "_scheduleReconnect");
            websocketManager._closing = false;
            websocketManager._onSocketClose();
            expect(websocketManager._scheduleReconnect).toHaveBeenCalledWith();
        });

        it("Should skip _scheduleReconnect if closing", function() {
            spyOn(websocketManager, "_scheduleReconnect");
            websocketManager._closing = true;
            websocketManager._onSocketClose();
            expect(websocketManager._scheduleReconnect).not.toHaveBeenCalled();
        });

        it("Should remove all event listeners", function() {
            spyOn(websocketManager, "_removeSocketEvents");

            // Run
            websocketManager._onSocketClose();

            // Posttest
            expect(websocketManager._removeSocketEvents).toHaveBeenCalledWith();
        });


        it("Should trigger disconnected", function() {
            spyOn(websocketManager, "trigger");
            websocketManager._onSocketClose();
            expect(websocketManager.trigger).toHaveBeenCalledWith("disconnected");
        });
    });

    describe("The _removeSocketEvents() method", function() {
      it("Should remove all event listeners", function() {
        var spy = websocketManager._socket.removeEventListener = jasmine.createSpy('remove');

        // Run
        websocketManager._onSocketClose();

        // Posttest
        expect(spy).toHaveBeenCalledWith("message", websocketManager._onMessage);
        expect(spy).toHaveBeenCalledWith("close", websocketManager._onSocketClose);
        expect(spy).toHaveBeenCalledWith("open", websocketManager._onOpen);
        expect(spy).toHaveBeenCalledWith("error", websocketManager._onError);
      });
    });

    describe("The _scheduleReconnect() method", function() {
      it("Should schedule _validateSessionBeforeReconnect to be called using exponential backoff", function() {
        var tmp = layer.Util.getExponentialBackoffSeconds;
        layer.Util.getExponentialBackoffSeconds = function() {return 100;}
        websocketManager._lostConnectionCount = 10;
        spyOn(websocketManager, "_validateSessionBeforeReconnect");
        expect(websocketManager._reconnectId).toEqual(0);

        // Run
        websocketManager._scheduleReconnect();
        expect(websocketManager._reconnectId).not.toEqual(0);
        expect(websocketManager._validateSessionBeforeReconnect).not.toHaveBeenCalled();

        // Midtest
        jasmine.clock().tick(1000 * layer.Util.getExponentialBackoffSeconds(100, 10) - 1);
        expect(websocketManager._validateSessionBeforeReconnect).not.toHaveBeenCalled();

        // Posttest
        jasmine.clock().tick(10);
        expect(websocketManager._validateSessionBeforeReconnect).toHaveBeenCalled();

        // Cleanup
        layer.Util.getExponentialBackoffSeconds = tmp;
      });

      it("Should abort if destroyed or if offline", function() {
        client.onlineManager.isOnline = false;
        websocketManager._scheduleReconnect();
        expect(websocketManager._reconnectId).toEqual(0);
      });
    });

    describe("The _validateSessionBeforeReconnect() method", function() {
       it("Should validate the session", function() {
          spyOn(client, "xhr");
          websocketManager._validateSessionBeforeReconnect();
          expect(client.xhr).toHaveBeenCalledWith({
              url: "/?action=validateConnectionForWebsocket&client=" + client.constructor.version,
              sync: false,
              method: "GET"
            }, jasmine.any(Function));
       });

       xit("Should only call once every 10 minutes and ignore extra calls", function() {
            spyOn(client, "xhr");
            websocketManager._validateSessionBeforeReconnect();
            websocketManager._validateSessionBeforeReconnect();
            websocketManager._validateSessionBeforeReconnect();
            websocketManager._validateSessionBeforeReconnect();
            websocketManager._validateSessionBeforeReconnect();
            expect(client.xhr.calls.count()).toEqual(1);
            spyOn(layer.Util, "getExponentialBackoffSeconds").and.returnValue(10 * 60 * 1000 - 1);
            websocketManager._lastValidateSessionRequest = Date.now() - 10 * 60 * 1000;
            jasmine.clock().tick(10 * 60 * 1000);
            expect(client.xhr.calls.count()).toEqual(2);
            websocketManager._lastValidateSessionRequest = Date.now() - 10 * 600 * 1000;
            jasmine.clock().tick(10 * 600 * 1000);
            expect(client.xhr.calls.count()).toEqual(2);
       });

       it("Should call connect if successful", function() {
          spyOn(websocketManager, "connect");
          websocketManager._validateSessionBeforeReconnect();
          requests.mostRecent().response({
              status: 200
          });
          expect(websocketManager.connect).toHaveBeenCalledWith();
       });

       it("Should not call connect if unsuccessful", function() {
          spyOn(websocketManager, "connect");
          websocketManager._validateSessionBeforeReconnect();
          requests.mostRecent().response({
              status: 400
          });
          expect(websocketManager.connect).not.toHaveBeenCalled();
       });
    });
});