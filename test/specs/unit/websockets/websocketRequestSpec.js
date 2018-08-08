/* eslint-disable */
describe("The Websocket Request Manager Class", function() {
    var socket, client, requestManager;
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

        client.user = new layer.Identity({
            clientId: client.appId,
            userId: 'Frodo',
            id: "layer:///identities/" + 'Frodo',
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

        requestManager = client.socketRequestManager;

        conversation = client._createObject(responses.conversation1).conversation;
        requests.reset();
        client.syncManager.queue = [];
        jasmine.clock().tick(1);
    });

    afterEach(function() {
        jasmine.Ajax.uninstall();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The constructor() method", function() {
        it("Should return a Websockets.RequestManager", function() {
            expect(new layer.Websockets.RequestManager({
                client: client,
                socketManager: client.socketManager
            })).toEqual(jasmine.any(layer.Websockets.RequestManager));
        });

        it("Should setup _requestCallbacks", function() {
            expect(requestManager._requestCallbacks).toEqual({});
        });

	      it("Should subscribe to call _handleResponse on message", function() {
            var tmp = layer.Websockets.RequestManager.prototype._handleResponse;
            layer.Websockets.RequestManager.prototype._handleResponse = jasmine.createSpy('handleResponse');
            var requestManager = new layer.Websockets.RequestManager({
                client: client,
                socketManager: client.socketManager
            })
            expect(layer.Websockets.RequestManager.prototype._handleResponse).not.toHaveBeenCalled();

            // Run
            client.socketManager.trigger("message", {data: {body: {}}});

            // Posttest
            expect(layer.Websockets.RequestManager.prototype._handleResponse).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));

            // Restore
            layer.Websockets.RequestManager.prototype._handleResponse = tmp;
            requestManager.destroy();
        });

        it("Should subscribe to call _reset on disconnected", function() {
            var tmp = layer.Websockets.RequestManager.prototype._reset;
            layer.Websockets.RequestManager.prototype._reset = jasmine.createSpy('handleResponse');
            var requestManager = new layer.Websockets.RequestManager({
                client: client,
                socketManager: client.socketManager
            })
            expect(layer.Websockets.RequestManager.prototype._reset).not.toHaveBeenCalled();

            // Run
            client.socketManager.trigger("disconnected");

            // Posttest
            expect(layer.Websockets.RequestManager.prototype._reset).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));

            // Restore
            layer.Websockets.RequestManager.prototype._reset = tmp;
            requestManager.destroy();
        });
    });

    describe("The _reset() method", function() {
      it("Should clear _hasCounter", function() {
        requestManager._requestCallbacks = {a: "a"};
        requestManager._reset();
        expect(requestManager._requestCallbacks).toEqual({});
      });
    });

    describe("The sendRequest() method", function() {
        beforeEach(function() {
            spyOn(client.socketManager, "send");

        });

        it("Should call the callback immediately if not connected", function() {
          spyOn(requestManager, "_isOpen").and.returnValue(false);
            var spy = jasmine.createSpy('hey');
            requestManager.sendRequest({
                data: {hey: "ho"},
                callback: spy,
            });
            expect(spy).toHaveBeenCalledWith(jasmine.any(layer.LayerError));
            expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
              success: false,
              data: {
                id: 'not_connected',
                code: 0,
                message: 'WebSocket not connected'
              }
            }));
        });

        it("Should not modify the input object", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            var body = {body: "good"};
            requestManager.sendRequest({data: body});
            expect(body).toEqual({body: "good"});
        });

        it("Should register the callback", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            requestManager._requestCallbacks = {};
            var f = function() {};
            var request = requestManager.sendRequest({
                data: {},
                callback: f,
                isChangesArray: false
            });
            expect(request).toEqual({
                request_id: jasmine.any(String),
                date: jasmine.any(Number),
                callback: f,
                isChangesArray: false,
                method: undefined,
                batchIndex: -1,
                batchTotal: -1,
                results: []
            });
        });

        it("Should correctly handle no callback", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            requestManager._requestCallbacks = {};
            requestManager.sendRequest({data: {}});
            expect(requestManager._requestCallbacks).toEqual({});
        });


        it("Should call socketManager.send", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            requestManager._requestCallbacks = {};
            requestManager.sendRequest({
                data: {hey: "ho"},
                callback: function() {}
            });
            var requestId = Object.keys(requestManager._requestCallbacks)[0];
            expect(client.socketManager.send).toHaveBeenCalledWith({
                type: "request",
                body: {
                    request_id: requestId,
                    hey: "ho"
                }
            });
        });

        it("Should call _scheduleCallbackCleanup", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            spyOn(requestManager, "_scheduleCallbackCleanup");
            requestManager.sendRequest({
                data: {hey: "ho"},
                callback: function(){}
            });
            expect(requestManager._scheduleCallbackCleanup).toHaveBeenCalledWith();
        });

        it("Should track whether changes array is expected response", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            var request = requestManager.sendRequest({
                data: {hey: "ho"},
                callback: function() {},
                isChangesArray: true
            });
            expect(request.isChangesArray).toBe(true);

            var request = requestManager.sendRequest({
                data: {hey: "ho"},
                callback: function() {}
            });
            expect(request.isChangesArray).toBe(false);
        });
    });

    describe("The cancelOperation() method", function() {
        it("Should cancel all operations of the given method name", function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            spyOn(client.socketManager, "send");
            var spy = jasmine.createSpy("callback");
            requestManager.sendRequest({
                data: {method: "hey", data: {value: 1}},
                callback: spy
            });
            requestManager.sendRequest({
                data: {method: "ho", data: {value: 2}},
                callback: spy
            });
            requestManager.sendRequest({
                data: {method: "hey", data: {value: 3}},
                callback: spy
            });
            requestManager.sendRequest({
                data: {method: "you", data: {value: 4}},
                callback: spy
            });
            expect(Object.keys(requestManager._requestCallbacks).length).toEqual(4);

            requestManager.cancelOperation("hey");
            expect(Object.keys(requestManager._requestCallbacks).length).toEqual(2);
            Object.keys(requestManager._requestCallbacks).forEach(function(requestId) {
                var request = requestManager._requestCallbacks[requestId];
                expect(typeof request.method).toEqual('string');
                expect(request.method).not.toEqual("hey");
            });
        });
    });

    describe("The _scheduleCallbackCleanup() method", function() {
        it("Should schedule a call to _runCallbackCleanup", function() {
            spyOn(requestManager, "_runCallbackCleanup");

            // Run
            requestManager._scheduleCallbackCleanup();
            expect(requestManager._runCallbackCleanup).not.toHaveBeenCalled();
            jasmine.clock().tick(60000);

            // Posttest
            expect(requestManager._runCallbackCleanup).toHaveBeenCalledWith();
        });

        it("Should do nothing if its already scheduled", function() {
            spyOn(requestManager, "_runCallbackCleanup");
            requestManager._callbackCleanupId = 5;

            // Run
            requestManager._scheduleCallbackCleanup();
            jasmine.clock().tick(60000);

            // Posttest
            expect(requestManager._runCallbackCleanup).not.toHaveBeenCalled();
        });
    });

    describe("The _runCallbackCleanup() method", function() {
        var spy1, spy2, spy3, spy4;
        beforeEach(function() {
            spyOn(requestManager, "_isOpen").and.returnValue(true);
            var now = new Date();
            var past = new Date();
            spy1 = jasmine.createSpy('spy1');
            spy2 = jasmine.createSpy('spy2');
            spy3 = jasmine.createSpy('spy3');
            spy4 = jasmine.createSpy('spy4');
            past.setHours(past.getHours() - 1);
            requestManager._requestCallbacks = {
                a: {
                    date: now.getTime(),
                    callback: spy1
                },
                b: {
                    date: past.getTime(),
                    callback: spy2,
                },
                c: {
                    date: past.getTime(),
                    callback: spy3,
                },
                d: {
                    date: now.getTime(),
                    callback: spy4
                }
            };
        });

        it("Should call _timeoutRequest if the request has expired and there have been other websocket data received", function() {
            spyOn(requestManager, "_timeoutRequest");
            client.socketManager._lastDataFromServerTimestamp = Date.now();
            requestManager._runCallbackCleanup();
            expect(requestManager._timeoutRequest).toHaveBeenCalledWith("b");
            expect(requestManager._timeoutRequest).toHaveBeenCalledWith("c");
            expect(requestManager._timeoutRequest).not.toHaveBeenCalledWith("a");
            expect(requestManager._timeoutRequest).not.toHaveBeenCalledWith("d");
        });

        it("Should reconnect and flush all requests if the request has expired and there has been no other websocket data received", function() {
            spyOn(client.socketManager, "_reconnect");
            spyOn(client.socketRequestManager, "_failAll");
            client.socketManager._lastDataFromServerTimestamp = new Date('2010-10-10').getTime();
            requestManager._runCallbackCleanup();
            expect(client.socketManager._reconnect).toHaveBeenCalledWith(false);
            expect(requestManager._failAll).toHaveBeenCalledWith();
        });

        it("Should reschedule if any requests have not timed out", function() {
            spyOn(requestManager, "_scheduleCallbackCleanup");
            client.socketManager._lastDataFromServerTimestamp =  Date.now();
            requestManager._runCallbackCleanup();
            expect(requestManager._scheduleCallbackCleanup).toHaveBeenCalledWith();
        });

        it("Should skip _scheduleCallbackCleanup if no remaining requests", function() {
            spyOn(requestManager, "_scheduleCallbackCleanup");
            client.socketManager._lastDataFromServerTimestamp =  Date.now();
            delete requestManager._requestCallbacks.a;
            delete requestManager._requestCallbacks.d;
            requestManager._runCallbackCleanup();
            expect(requestManager._scheduleCallbackCleanup).not.toHaveBeenCalled();
        });

        it("Should clear _callbackCleanupId if all events are old", function() {
          client.socketManager._lastDataFromServerTimestamp =  Date.now();
          requestManager._callbackCleanupId = 5;
          delete requestManager._requestCallbacks.a;
          delete requestManager._requestCallbacks.d;
          requestManager._runCallbackCleanup();
          expect(requestManager._callbackCleanupId).toEqual(0);
        });
    });

    describe("The _failAll() method", function() {
        var spy1, spy2, spy3, spy4;
        beforeEach(function() {
          var now = new Date();
          var past = new Date();
          spy1 = jasmine.createSpy('spy1');
          spy2 = jasmine.createSpy('spy2');
          spy3 = jasmine.createSpy('spy3');
          spy4 = jasmine.createSpy('spy4');
          past.setHours(past.getHours() - 1);
          requestManager._requestCallbacks = {
              a: {
                  date: now.getTime(),
                  callback: spy1
              },
              b: {
                  date: past.getTime(),
                  callback: spy2,
              },
              c: {
                  date: past.getTime(),
                  callback: spy3,
              },
              d: {
                  date: now.getTime(),
                  callback: spy4
              }
          };
      });

      it("Should call the callback", function() {
        requestManager._failAll();
        expect(spy1).toHaveBeenCalledWith(jasmine.objectContaining({
          success: false,
          status: 503,
          data: jasmine.objectContaining({
            id: 'socket_dead',
            message: 'Websocket appears to be dead. Reconnecting.',
            url: 'https:/developer.layer.com/docs/websdk',
            code: 0,
            status: 503,
            httpStatus: 503,
          }),
        }));
        expect(spy2).toHaveBeenCalled();
        expect(spy3).toHaveBeenCalled();
        expect(spy4).toHaveBeenCalled();
      });

      it("Should remove all requests", function() {
        requestManager._failAll();
        expect(requestManager._requestCallbacks).toEqual({});
      });

      it("Should remove all requests even if the callback throws an error", function() {
          requestManager._requestCallbacks.b.callback = function() {
            throw new Error("Doh!");
          };
          requestManager._failAll();
          expect(requestManager._requestCallbacks).toEqual({});
      });
    });

    describe("The _timeoutRequest() method", function() {
      var spy1, spy2, spy3, spy4;
      beforeEach(function() {
          var now = new Date();
          var past = new Date();
          spy1 = jasmine.createSpy('spy1');
          spy2 = jasmine.createSpy('spy2');
          spy3 = jasmine.createSpy('spy3');
          spy4 = jasmine.createSpy('spy4');
          past.setHours(past.getHours() - 1);
          requestManager._requestCallbacks = {
              a: {
                  date: now.getTime(),
                  callback: spy1
              },
              b: {
                  date: past.getTime(),
                  callback: spy2,
              },
              c: {
                  date: past.getTime(),
                  callback: spy3,
              },
              d: {
                  date: now.getTime(),
                  callback: spy4
              }
          };
      });

      it("Should call the callback", function() {
        requestManager._timeoutRequest("b");
        expect(spy2).toHaveBeenCalledWith(jasmine.objectContaining({
          success: false,
          data: jasmine.objectContaining({
            id: 'request_timeout'
          })
        }));
      });

      it("Should remove the request if the request has expired", function() {
          requestManager._timeoutRequest("b");
          expect(requestManager._requestCallbacks.a).not.toBe(undefined);
          expect(requestManager._requestCallbacks.b).toBe(undefined);
          expect(requestManager._requestCallbacks.c).not.toBe(undefined);
          expect(requestManager._requestCallbacks.d).not.toBe(undefined);
      });

      it("Should remove the request even if the callback throws an error", function() {
          requestManager._requestCallbacks.b.callback = function() {
            throw new Error("Doh!");
          };
          requestManager._timeoutRequest("b");
          expect(requestManager._requestCallbacks.b).toBe(undefined);
      });

    });

    describe("The _handleResponse() method", function() {
        var spy1, spy2;
        beforeEach(function() {

            spy1 = jasmine.createSpy('spy1');
            spy2 = jasmine.createSpy('spy2');

            requestManager._requestCallbacks = {
                a: {
                    callback: spy1
                },
                b: {
                    callback: spy2
                }
            };
        });


        it("Should not fail if no request handler", function() {
            expect(function() {
                requestManager._handleResponse({
                  data: {
                    type: 'response',
                    body: {
                        success: true,
                        request_id: "c"
                    }
                  }
                });
            }).not.toThrow();
        });

        it("Should call the request handler", function() {
            requestManager._handleResponse({
              data: {
                type: 'response',
                body: {
                    success: true,
                    request_id: "a",
                    data: {hey: "ho"}
                }
              }
            });
            expect(spy1).toHaveBeenCalledWith({
                success: true,
                data: {hey: "ho"},
                fullData: {
                    type: "response",
                    body: {
                        success: true,
                        request_id: "a",
                        data: {hey: "ho"}
                    }
                }
            });
        });

        it("Should remove the request handler", function() {
            requestManager._handleResponse({
              data: {
                type: 'response',
                body: {
                    success: true,
                    request_id: "a",
                    data: {hey: "ho"}
                }
              }
            });
            expect(requestManager._requestCallbacks.a).toBe(undefined);
        });
    });


});