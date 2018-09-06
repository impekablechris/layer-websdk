/*eslint-disable */

describe("The Client Authenticator Requests", function() {
    var appId = "layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";

    var client, requests, WS;

    beforeAll(function() {
        jasmine.addCustomEqualityTester(mostRecentEqualityTest);
        jasmine.addCustomEqualityTester(responseTest);
        WS = window.WebSocket;
        window.WebSocket = function() {
            this.send = function() {};
            this.addEventListener = function() {};
            this.removeEventListener = function() {};
            this.close = function() {};
            this.readyState = WebSocket.OPEN;
        };
    });

    afterAll(function() {
        window.WebSocket = WS;
    });

    beforeEach(function() {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;

        client = new layer.Client({
            appId: appId,
            reset: true,
            url: "https://duh.com"
        });
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

        client._initComponents();
        client._clientAuthenticated();
        client._clientReady();
        requests.reset();
    });

    afterEach(function(done) {

        jasmine.clock().uninstall();
        setTimeout(function() {
            jasmine.Ajax.uninstall();
            client.destroy();
            done();
        },1);
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The sendSocketRequest() method", function() {
        it("Should create a SyncEvent with a body if sync is empty", function() {
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                sync: {}
            });
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.objectContaining({
                data: "Hey!"
            }));
        });

        it("Should create a WebsocketSyncEvent if sync is empty", function() {
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                sync: {}
            });
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.any(layer.WebsocketSyncEvent));
        });

        it("Should create a SyncEvent with specified callback if sync is empty", function() {
            var callback = function() {};
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                sync: {}
            }, callback);
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.objectContaining({
                callback: callback
            }));
        });

        it("Should create a SyncEvent with specified method if sync is empty", function() {
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                method: "PUT",
                sync: {}
            });
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.objectContaining({
                operation: "PUT"
            }));
        });

        it("Should create a SyncEvent with specified target if sync is true", function() {
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                sync: {
                    target: "Fred!"
                }
            });
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.objectContaining({
                target: "Fred!"
            }));
        });

        it("Should create a SyncEvent with specified depends if sync is true", function() {
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                sync: {
                    depends: ["Fred!"]
                }
            });
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.objectContaining({
                depends: ["Fred!"]
            }));
        });

        it("Should call socketRequestManager.sendRequest if sync is false with isChangesArray", function() {
            var callback = function() {};
            spyOn(client.socketRequestManager, "sendRequest");
            client.sendSocketRequest({
                body: "Hey!",
                sync: false,
                isChangesArray: true
            }, callback);
            expect(client.socketRequestManager.sendRequest)
                .toHaveBeenCalledWith({
                    isChangesArray: true,
                    data: jasmine.objectContaining({body: "Hey!"}),
                    callback: callback
                });
        });

        it("Should create a SyncEvent with specified depends if sync is true with isChangesArray", function() {
            spyOn(client.syncManager, "request");
            client.sendSocketRequest({
                body: "Hey!",
                sync: {
                    depends: ["Fred!"]
                },
                isChangesArray: true
            });
            expect(client.syncManager.request).toHaveBeenCalledWith(jasmine.objectContaining({
                depends: ["Fred!"],
                returnChangesArray: true
            }));
        });

        it("Should call socketRequestManager.sendRequest if sync is false", function() {
            var callback = function() {};
            spyOn(client.socketRequestManager, "sendRequest");
            client.sendSocketRequest({
                body: "Hey!",
                sync: false
            }, callback);
            expect(client.socketRequestManager.sendRequest)
                .toHaveBeenCalledWith({
                    data: jasmine.objectContaining({body: "Hey!"}),
                    callback: callback,
                    isChangesArray: false
                });
        });

        it("Should call _connect if wantsToAuthenticate but not authenticated", function() {
            spyOn(client, "_connect");

            // Run 1
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client.isAuthenticated = false;
            client.sendSocketRequest({
                body: "Hey!",
                sync: {
                    depends: ["Fred!"]
                },
                isChangesArray: true
            });
            expect(client._connect).toHaveBeenCalled();
            client._connect.calls.reset();

            // Run 2
            client._wantsToBeAuthenticated = false;
            client._wantsToBeConnected = true;
            client.isAuthenticated = false;
            client.sendSocketRequest({
                body: "Hey!",
                sync: {
                    depends: ["Fred!"]
                },
                isChangesArray: true
            });
            expect(client._connect).not.toHaveBeenCalled();
            client._connect.calls.reset();

            // Run 2
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client.isAuthenticated = true;
            client.sendSocketRequest({
                body: "Hey!",
                sync: {
                    depends: ["Fred!"]
                },
                isChangesArray: true
            });
            expect(client._connect).not.toHaveBeenCalled();
        });
    });

    describe("The xhr() method", function() {
        it("Should call _xhrFixRelativeUrls if non-sync request", function() {
            // Setup
            spyOn(client, "_xhrFixRelativeUrls");

            // Run
            client.xhr({url: "/conversations"});

            // Posttest
            expect(client._xhrFixRelativeUrls).toHaveBeenCalledWith("/conversations");
        });

        it("Should call _xhrFixRelativeUrls if sync request without target", function() {
            // Setup
            spyOn(client, "_xhrFixRelativeUrls");

            // Run
            client.xhr({
              url: "/conversations",
              sync: {}
            });

            // Posttest
            expect(client._xhrFixRelativeUrls).toHaveBeenCalledWith("/conversations");
        });

        it("Should not call _xhrFixRelativeUrls if sync request with target", function() {
            // Setup
            spyOn(client, "_xhrFixRelativeUrls");

            // Run
            client.xhr({
              url: "/conversations",
              sync: {
                target: "hey"
              }
            });

            // Posttest
            expect(client._xhrFixRelativeUrls).not.toHaveBeenCalled();
        });

        xit("Should call _xhrFixHeaders", function() {
            // Setup
            spyOn(client, "_xhrFixHeaders");
            var options = {url: "/conversations", headers: {hey: "ho"}};
            // Run
            client.xhr(options);

            // Posttest
            expect(client._xhrFixHeaders).toHaveBeenCalledWith({hey: "ho"});
        });

        xit("Should call _xhrFixHeaders", function() {
            // Setup
            spyOn(client, "_xhrFixHeaders");

            // Run
            client.xhr({url: "/conversations", headers: {hey: "ho"}});

            // Posttest
            expect(client._xhrFixHeaders).toHaveBeenCalledWith({hey: "ho"});
        });

        xit("Should add withCredentials to options", function() {
            // Setup
            var options = {};

            // Run
            client.xhr(options);

            // Posttest
            expect(options.withCredentials).toBe(true);
        });

        xit("Should set method to GET if unspecified", function() {
            // Setup
            var options = {};

            // Run
            client.xhr(options);

            // Posttest
            expect(options.method).toEqual("GET");
        });

        xit("Should use the provided method", function() {
            // Setup
            var options = {method: "POST"};

            // Run
            client.xhr(options);

            // Posttest
            expect(options.method).toEqual("POST");
        });

        xit("Should call _nonsyncXhr if sync is false", function() {
            spyOn(client, "_nonsyncXhr");
            var callback = function callback() {};
            client.xhr({url: "", sync: false}, callback);
            expect(client._nonsyncXhr).toHaveBeenCalled();
        });

        xit("Should call _syncXhr if sync is true", function() {
            spyOn(client, "_syncXhr");
            var callback = function callback() {};
            client.xhr({url: "", sync: true}, callback);
            expect(client._syncXhr).toHaveBeenCalled();
        });

        it("Should call _syncXhr if sync is empty", function() {
            spyOn(client, "_syncXhr");
            var callback = function callback() {};
            client.xhr({url: "https://api.layer.com"}, callback);
            expect(client._syncXhr).toHaveBeenCalled();
        });
    });

    describe("The _syncXhr() method", function() {
        beforeEach(function() {
            client.sessionToken = 'sessionToken';
            spyOn(client.syncManager, "isOnline").and.returnValue(true);
        });

        it("Should fire a correct call to xhr", function() {
            // Run
            client._syncXhr({url: "fred", method: "POST", headers: {}});

            // Posttest
            expect(requests.mostRecent()).toEqual(jasmine.objectContaining({
                url: "fred",
                method: "POST",
                requestHeaders: {
                    authorization: 'Layer session-token="sessionToken"'
                }
            }));
        });

        it("Should call _connect if wantsToAuthenticate but not authenticated", function() {
            spyOn(client, "_connect");

            // Run 1
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client.isAuthenticated = false;
            client._syncXhr({url: "fred", method: "POST", headers: {}});
            expect(client._connect).toHaveBeenCalled();
            client._connect.calls.reset();

            // Run 2
            client._wantsToBeAuthenticated = false;
            client._wantsToBeConnected = true;
            client.isAuthenticated = false;
            client._syncXhr({url: "fred", method: "POST", headers: {}});
            expect(client._connect).not.toHaveBeenCalled();
            client._connect.calls.reset();

            // Run 2
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client.isAuthenticated = true;
            client._syncXhr({url: "fred", method: "POST", headers: {}});
            expect(client._connect).not.toHaveBeenCalled();
        });
    });

    describe("The _nonsyncXhr() method", function() {

        it("Should call _xhrResult with the callback", function() {
            // Setup
            spyOn(client, "_xhrResult");

            var callback = function callback() {}
            var response = {
                status: 200,
                responseText: JSON.stringify({doh: "a deer"})
            };

            // Run
            client._nonsyncXhr({url: ""}, callback);
            requests.mostRecent().response(response);

            // Posttest
            expect(client._xhrResult).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    status: 200,
                    data: {doh: "a deer"},
                    success: true
                }),
                jasmine.any(Function)
            );
        });

        it("Should retry once", function() {
            var callback = function callback() {}
            client._nonsyncXhr({url: "test"}, callback, 0);
            spyOn(client, "_nonsyncXhr");
            var response = {
                status: 503,
                responseText: JSON.stringify({id: "fred"})
            };

            // Run
            requests.mostRecent().response(response);
            expect(client._nonsyncXhr).not.toHaveBeenCalled();

            jasmine.clock().tick(1001);
            expect(client._nonsyncXhr).toHaveBeenCalledWith({url: "test", headers: {}}, callback, 1);
        });

        it("Should retry twice", function() {
            var callback = function callback() {}
            client._nonsyncXhr({url: "test"}, callback, 1);
            spyOn(client, "_nonsyncXhr");
            var response = {
                status: 503,
                responseText: JSON.stringify({id: "fred"})
            };

            // Run
            requests.mostRecent().response(response);
            expect(client._nonsyncXhr).not.toHaveBeenCalled();

            jasmine.clock().tick(1001);
            expect(client._nonsyncXhr).toHaveBeenCalledWith({url: "test", headers: {}}, callback, 2);
        });

        it("Should retry thrice", function() {
            var callback = function callback() {}
            client._nonsyncXhr({url: "test"}, callback, 2);
            spyOn(client, "_nonsyncXhr");
            var response = {
                status: 503,
                responseText: JSON.stringify({id: "fred"})
            };

            // Run
            requests.mostRecent().response(response);
            expect(client._nonsyncXhr).not.toHaveBeenCalled();

            jasmine.clock().tick(1001);
            expect(client._nonsyncXhr).toHaveBeenCalledWith({url: "test", headers: {}}, callback, 3);
        });

        it("Should stop retrying", function() {
            var callback = function callback() {}
            client._nonsyncXhr({url: "test"}, callback, 3);
            spyOn(client, "_nonsyncXhr");
            var response = {
                status: 503,
                responseText: JSON.stringify({id: "fred"})
            };

            // Run
            requests.mostRecent().response(response);
            expect(client._nonsyncXhr).not.toHaveBeenCalled();

            jasmine.clock().tick(1001);
            expect(client._nonsyncXhr).not.toHaveBeenCalled();
        });

        it("Should call the syncManager", function() {
            var callback = jasmine.createSpy('callback');
            spyOn(client.syncManager, "request");
            client._syncXhr({url: "test"}, callback, 0);
            expect(client.syncManager.request.calls.argsFor(0)[0] instanceof layer.XHRSyncEvent).toBe(true);
            expect(client.syncManager.request.calls.argsFor(0)[0].url).toEqual("test");
        });

        it("Should call _xhrResult with the original callback", function() {
            var callback = jasmine.createSpy('callback');
            spyOn(client.syncManager, "request");
            spyOn(client, "_xhrResult");
            client._syncXhr({url: "test"}, callback, 0);
            client.syncManager.request.calls.argsFor(0)[0].callback({status: 200});
            expect(client._xhrResult).toHaveBeenCalledWith({status: 200}, callback);
        });
    });



    describe("The _xhrFixAuth() method", function() {
        it("Should add an auth header if we have a session token", function() {
            client.sessionToken = "sessionToken";
            var headers = {};
            client._xhrFixAuth(headers);
            expect(headers).toEqual({authorization: 'Layer session-token="sessionToken"'});
        });

        it("Should do nothing if we do not have a session token", function() {
            client.sessionToken = "";
            var headers = {};
            client._xhrFixAuth(headers);
            expect(headers).toEqual({});
        });
    });

    describe("The _xhrFixRelativeUrls() method", function() {
        it("Should accept an absolute url", function() {
            // Run
            var url = client._xhrFixRelativeUrls("https://duh2.com/conversations");

            // Posttest
            expect(url).toEqual("https://duh2.com/conversations");
        });

        it("Should convert to absolute url", function() {
            // Run
            var url = client._xhrFixRelativeUrls("conversations");

            // Posttest
            expect(url).toEqual(client.url + "/conversations");
        });
    });

    describe("The _xhrFixHeaders() method", function() {
        it("Should set content-type to application/json if no content-type", function() {
            // Setup
            var headers = {};

            // Run
            client._xhrFixHeaders(headers);

            // Posttest
            expect(headers["content-type"]).toEqual("application/json");
        });

        it("Should replace upper case headers with lower case", function() {
            // Setup
            var headers = {'Hey-HO': "Doh"};

            // Run
            client._xhrFixHeaders(headers);

            // Posttest
            expect(headers).toEqual({
                "hey-ho": "Doh",
                "content-type": "application/json",
                "layer-xdk-version": client.constructor.version,
                "client-id": client._tabId,
                accept: "application/vnd.layer+json; version=2.0"
            });
            expect(client.constructor.version.length > 0).toBe(true);
            expect(client._tabId.length > 0).toBe(true);
        });

        it("Should pass through lower case headers", function() {
            // Setup
            var headers = {'hey-ho': "Doh"};

            // Run
            client._xhrFixHeaders(headers);

            // Posttest
            expect(headers).toEqual({
                "hey-ho": "Doh",
                "content-type": "application/json",
                "layer-xdk-version": client.constructor.version,
                "client-id": client._tabId,
                accept: "application/vnd.layer+json; version=2.0"
            });
        });

        it("Should pass through content-type if provided", function() {
            // Setup
            var headers = {'Content-Type': "text/mountain"};

            // Run
            client._xhrFixHeaders(headers);

            // Posttest
            expect(headers).toEqual({
                "content-type": "text/mountain",
                accept: "application/vnd.layer+json; version=2.0",
                "layer-xdk-version": client.constructor.version,
                "client-id": client._tabId,
            });
        });
    });

    describe("The _xhrResult() method", function() {
        it("Should abort if destroyed", function() {
            // Setup
            client.isDestroyed = true;
            var callback = jasmine.createSpy('callback');

            // Run
            client._xhrResult({success: true}, callback);

            // Posttest
            expect(callback).not.toHaveBeenCalled();
            client.isDestroyed = false;
        });

        it("Should call the callback with success", function() {
            // Setup
            var callback = jasmine.createSpy('callback');

            // Run
            client._xhrResult({
                success: true,
                data: {doh: "a deer"}
            }, callback);

            // Posttest
            expect(callback).toHaveBeenCalledWith({
                success: true,
                data: {doh: "a deer"}});
        });

        it("Should call the callback without success", function() {
            // Setup
            var callback = jasmine.createSpy('callback');
            spyOn(client, "_generateError");

            // Run
            client._xhrResult({
                success: false,
                data: {doh: "a deer"}
            }, callback);

            // Posttest
            expect(callback).toHaveBeenCalledWith({
                success: false,
                data: {doh: "a deer"}});
        });

        it("Should call _generateError if success if false", function() {
            // Setup
            spyOn(client, "_generateError");

            // Run
            client._xhrResult({
                success: false,
                data: {doh: "a deer"}
            });

            // Posttest
            expect(client._generateError).toHaveBeenCalledWith({
                success: false,
                data: {doh: "a deer"}
            });
        });

        it("Should clear isAuthenticated and isReady on getting a 401", function() {
            client.isAuthenticated = true;
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client.isReady = true;
            client._xhrResult({
                success: false,
                status: 401,
                data: {
                    id: "fred",
                    data: {
                        nonce: "sense"
                    }
                }
            });

            expect(client.isAuthenticated).toBe(false);
            expect(client.isReady).toBe(false);
        });

        it("Should clear localStorage sessionToken on getting a 401", function() {
          client.isAuthenticated = true;
          client._wantsToBeAuthenticated = true;
          client._wantsToBeConnected = true;
          localStorage[layer.Constants.LOCALSTORAGE_KEYS.SESSIONDATA + client.appId] = "Frodo and Gollum Kissing in a Tree";
          client._xhrResult({
              success: false,
              status: 401,
              data: {
                  id: "fred",
                  data: {
                      nonce: "sense"
                  }
              }
          });

          expect(localStorage[layer.Constants.LOCALSTORAGE_KEYS.SESSIONDATA + client.appId]).toBe(undefined);
        });

        it("Should call _authenticate on getting a 401 if wants to be authenticated", function() {
            // Setup
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client._lastChallengeTime = client.TimeBetweenReauths - 1;
            spyOn(client, "_authenticate");

            // Run Test 1
            client._xhrResult({
                success: false,
                status: 401,
                data: {
                    id: "fred",
                    data: {
                        nonce: "sense"
                    }
                }
            });
            expect(client._authenticate).toHaveBeenCalledWith("sense");
            client._authenticate.calls.reset();

            // Run Test 2
            client._wantsToBeAuthenticated = false;
            client._wantsToBeConnected = true;
            client._lastChallengeTime = 0;
            client._xhrResult({
                success: false,
                status: 401,
                data: {
                    id: "fred",
                    data: {
                        nonce: "sense"
                    }
                }
            });
            expect(client._authenticate).not.toHaveBeenCalled();

            // Run Test 3
            client._wantsToBeAuthenticated = true;
            client._wantsToBeConnected = true;
            client._lastChallengeTime = Date.now() - 100;
            client._xhrResult({
                success: false,
                status: 401,
                data: {
                    id: "fred",
                    data: {
                        nonce: "sense"
                    }
                }
            });
            expect(client._authenticate).not.toHaveBeenCalled();
        });

        it("Should call not _authenticate on getting a 401 if not authenticated", function() {
            // Setup
            client.isAuthenticated = false;
            spyOn(client, "_authenticate");

            // Run
            client._xhrResult({
                success: false,
                status: 401,
                data: {
                    id: "fred",
                    data: {
                        nonce: "sense"
                    }
                }
            });

            // Posttest
            expect(client._authenticate).not.toHaveBeenCalled();
        });
    });

    describe("The _generateError() method", function() {
        it("Should return an error", function() {
            // Setup
            var results = {
                data: {
                    id: "fred"
                }
            };

            // Run
            client._generateError(results);

            // Posttest
            expect(results.data).toEqual(jasmine.any(layer.LayerError));
            expect(results.data.id).toEqual("fred");
        });
    });

    describe("The Push Token Methods", function() {
      beforeEach(function() {
        spyOn(client.syncManager, "isOnline").and.returnValue(true);
      });

      it("Should have a working registerIOSPushToken() method", function() {
        var callback = jasmine.createSpy('callback');
        client.registerIOSPushToken({
          token: "a",
          deviceId: "b",
          iosVersion: "c",
          bundleId: "d"
        }, callback);

        expect(requests.mostRecent()).toEqual(jasmine.objectContaining({
          url: client.url + "/push_tokens",
          method: "POST",
          params: JSON.stringify({
           token: "a",
           type: "apns",
           device_id: "b",
           ios_version: "c",
           apns_bundle_id: "d"
          })
        }));

        var response = {
            status: 200,
            responseText: JSON.stringify({doh: "a deer"})
        };
        requests.mostRecent().response(response);
        expect(callback).toHaveBeenCalledWith({doh: "a deer"});
      });

      it("Should have a working registerAndroidPushToken() method", function() {
        var callback = jasmine.createSpy('callback');
        client.registerAndroidPushToken({
          token: "a",
          deviceId: "b",
          senderId: "c"
        }, callback);

        expect(requests.mostRecent()).toEqual(jasmine.objectContaining({
          url: client.url + "/push_tokens",
          method: "POST",
          params: JSON.stringify({
           token: "a",
           type: "gcm",
           device_id: "b",
           gcm_sender_id: "c"
          })
        }));

        var response = {
            status: 200,
            responseText: JSON.stringify({doh: "a deer"})
        };
        requests.mostRecent().response(response);
        expect(callback).toHaveBeenCalledWith({doh: "a deer"});

      });

      it("Should have a working unregisterPushToken() method", function() {
        var callback = jasmine.createSpy('callback');
        client.unregisterPushToken("a", callback);

        expect(requests.mostRecent()).toEqual(jasmine.objectContaining({
          url: client.url + "/push_tokens/a",
          method: "DELETE"
        }));

        var response = {
            status: 200,
            responseText: JSON.stringify({doh: "a deer"})
        };
        requests.mostRecent().response(response);
        expect(callback).toHaveBeenCalledWith({doh: "a deer"});

      });

    });
});
