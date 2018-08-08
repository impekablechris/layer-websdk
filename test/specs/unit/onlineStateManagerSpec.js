/* eslint-disable */
describe("The OnlineStateManager Class", function() {
    var socket, client;
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
        getObjectsResult = [];
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectsResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;


        conversation = client._createObject(responses.conversation1).conversation;
        requests.reset();
        client.syncManager.queue = [];
        jasmine.clock().tick(1);

        socket = client.socketManager;
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
        it("Should copy in object parameters", function() {
            var manager = this.onlineManager = new layer.OnlineStateManager({
              socketManager: socket
            });

            expect(manager.socketManager).toBe(socket);
            manager.destroy();
        });

        it("Should listen for websocket messages", function() {
            var manager = this.onlineManager = new layer.OnlineStateManager({
              socketManager: socket
            });
            spyOn(manager, "_connectionListener");

            // Run
            socket.trigger("message", {data: {body: {}}});

            // Posttest
            expect(manager._connectionListener).toHaveBeenCalledWith({status: "connection:success"});
            manager.destroy();
        });

        it("Should listen for xhr success responses", function() {
            var manager = client.onlineManager;
            spyOn(manager, "_connectionListener");

            // Run
            layer.xhr({
                url: "test"
            });
            requests.mostRecent().response({
                status: 200
            });

            // Posttest
            expect(manager._connectionListener).toHaveBeenCalledWith(jasmine.objectContaining({
                target: jasmine.any(Object),
                status: "connection:success"
            }));
        });

        it("Should listen for xhr failure responses", function() {

            var manager = client.onlineManager;
            spyOn(manager, "_connectionListener");

            // Run
            layer.xhr({
                url: "test"
            });
            requests.mostRecent().response({
                status: 0
            });

            // Posttest
            expect(manager._connectionListener).toHaveBeenCalledWith(jasmine.objectContaining({
                target: jasmine.any(Object),
                status: "connection:error"
            }));
        });
    });

    describe("The stop() method", function() {
      var manager;
      beforeEach(function() {
          manager = this.onlineManager = new layer.OnlineStateManager({
            socketManager: socket
          });
      });

      afterEach(function() {
          manager.destroy();
      });

      it("Should set isClientReady to false", function() {
        manager.isClientReady = true;
        manager.stop();
        expect(manager.isClientReady).toBe(false);
      });

      it("Should set isOnline to false", function() {
        manager.isOnline = true;
        manager.stop();
        expect(manager.isOnline).toBe(false);
      });

      it("Should trigger disconnected", function() {
        spyOn(manager, "trigger");
        manager.isOnline = true;
        manager.stop();
        expect(manager.trigger).toHaveBeenCalledWith("disconnected");
      });

      it("Should call _changeToOffline", function() {
        spyOn(manager, "_changeToOffline");
        manager.stop();
        expect(manager._changeToOffline).toHaveBeenCalledWith();
      });

      it("Should cancel all polling", function() {
        spyOn(manager, "_clearCheck");
        manager.stop();
        expect(manager._clearCheck).toHaveBeenCalledWith();
      });
    });

    describe("The _handleOnlineEvent() method", function() {
        var manager;
        beforeEach(function() {
            manager = this.onlineManager = new layer.OnlineStateManager({
              socketManager: socket
            });
        });

        afterEach(function() {
            manager.destroy();
        });

        it("Should call checkOnlineStatus", function() {
            spyOn(manager, "checkOnlineStatus");
            manager._handleOnlineEvent();
            expect(manager.checkOnlineStatus).toHaveBeenCalledWith();
        });

        it("Should reset offlineCounter if browser is online", function() {
            manager.offlineCounter = 5;
            manager._handleOnlineEvent();
            expect(manager.offlineCounter).toEqual(0);
        });
    });

    describe("Path A: Initialization", function() {
        describe("The start() method", function() {
            var manager;
            beforeEach(function() {
                manager = this.onlineManager = new layer.OnlineStateManager({
                  socketManager: socket
                });
            });

            afterEach(function() {
                manager.destroy();
            });

            it("Should call checkOnlineStatus", function() {
              spyOn(manager, "checkOnlineStatus");
              manager.start();
              expect(manager.checkOnlineStatus).toHaveBeenCalledWith();
            });

            it("Should set isOnline to true", function() {
              expect(manager.isOnline).toBe(false);
              manager.start();
              expect(manager.isOnline).toBe(true);
            });

            it("Should set isClientReady to true", function() {
                manager.isClientReady = false;
                manager.start();
                expect(manager.isClientReady).toBe(true);
            });
        });

        describe("The checkOnlineStatus() method", function() {
            var manager;
            beforeEach(function() {
                manager = this.onlineManager = new layer.OnlineStateManager({
                  socketManager: socket
                });
            });

            afterEach(function() {
                manager.destroy();
            });

            it("Should ping the ping endpoint", function() {
                manager.checkOnlineStatus();
                var url = requests.mostRecent().url;
                expect(url.indexOf(client.url + '/ping?client=' + client.constructor.version)).toEqual(0);
            });

            it("Should call _connectionListener", function() {
                spyOn(manager, "_connectionListener");

                // Run 1
                manager.checkOnlineStatus();
                requests.mostRecent().response({status: 200});
                expect(manager._connectionListener).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'connection:success' }));

                // Run 2
                manager._connectionListener.calls.reset();
                manager.checkOnlineStatus();
                requests.mostRecent().response({status: 401});
                expect(manager._connectionListener).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'connection:success' }));

                // Run 3
                manager._connectionListener.calls.reset();
                manager.checkOnlineStatus();
                requests.mostRecent().response({status: 0});
                expect(manager._connectionListener).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'connection:error' }));
            });

            // Integration test which depends upon _connectionListener updating isOnline
            it("Should update isOnline and callback with the result", function() {
                var spy = jasmine.createSpy('spy');
                manager.isOnline = false;
                spyOn(manager, "_onlineExpiring")

                // Run 1
                manager.checkOnlineStatus(spy);
                requests.mostRecent().response({status: 200});
                expect(spy).toHaveBeenCalledWith(true);
                expect(manager.isOnline).toEqual(true);
                expect(manager._onlineExpiring).not.toHaveBeenCalled();

                // Run 2
                spy.calls.reset();
                manager.checkOnlineStatus(spy);
                requests.mostRecent().response({status: 401});
                expect(spy).toHaveBeenCalledWith(true);
                expect(manager.isOnline).toEqual(true);
                expect(manager._onlineExpiring).not.toHaveBeenCalled();

                // Run 3
                spy.calls.reset();
                manager.checkOnlineStatus(spy);
                requests.mostRecent().response({status: 0});
                expect(spy).toHaveBeenCalledWith(false);
                expect(manager.isOnline).toEqual(true);
                expect(manager._onlineExpiring).toHaveBeenCalled();
            });

            it("Should be fine without a callback", function() {
                manager.isOnline = false;
                manager.checkOnlineStatus();

                // Run
                expect(function() {
                    requests.mostRecent().response({status: 200});
                }).not.toThrow();
            });
        });

        describe("The _connectionListener() method", function() {
            var manager;
            beforeEach(function() {
                manager = this.onlineManager = new layer.OnlineStateManager({
                  socketManager: socket
                });
            });

            afterEach(function() {
                manager.destroy();
            });

            it("Should trigger connected if success event and was offline", function() {
                manager.isOnline = false;
                manager.offlineCounter = 100;
                spyOn(manager, "trigger");

                // Run
                manager._connectionListener({status: "connection:success"});

                // Posttest
                expect(manager.trigger).toHaveBeenCalledWith("connected", {offlineDuration: jasmine.any(Number)});
                expect(manager.isOnline).toBe(true);
                expect(manager.offlineCounter).toEqual(0);
            });

            it("Should NOT trigger successful if success event and was online", function() {
                manager.isOnline = true;
                spyOn(manager, "trigger");

                // Run
                manager._connectionListener({status: "connection:success"});

                // Posttest
                expect(manager.trigger).not.toHaveBeenCalled();
            });

            it("Should reschedule _onlineExpiring whether online or not if success event", function() {
                manager.isOnline = false;
                spyOn(manager, "_onlineExpiring");
                spyOn(manager, "_clearCheck").and.callThrough();

                // Run 1
                manager._connectionListener({status: "connection:success"});
                expect(manager._onlineExpiring).not.toHaveBeenCalled();
                jasmine.clock().tick(100 * 1000);
                expect(manager._onlineExpiring).toHaveBeenCalled();
                expect(manager._clearCheck).toHaveBeenCalled();

                // Run 2
                manager._onlineExpiring.calls.reset();
                manager._clearCheck.calls.reset();
                manager.isOnline = true;
                manager._connectionListener({status: "connection:success"});
                expect(manager._onlineExpiring).not.toHaveBeenCalled();
                jasmine.clock().tick(100 * 1000);
                expect(manager._onlineExpiring).toHaveBeenCalled();
                expect(manager._clearCheck).toHaveBeenCalled();

                // Run 3: Should not call _onlineExpiring repeatedly:
                manager._onlineExpiring.calls.reset();
                manager._clearCheck.calls.reset();
                manager.isOnline = true;
                manager._connectionListener({status: "connection:success"});
                jasmine.clock().tick(1);
                manager._connectionListener({status: "connection:success"});
                jasmine.clock().tick(1);
                manager._connectionListener({status: "connection:success"});
                expect(manager._onlineExpiring).not.toHaveBeenCalled();
                jasmine.clock().tick(100 * 1000);
                expect(manager._onlineExpiring.calls.count()).toEqual(1);
                expect(manager._clearCheck.calls.count()).toEqual(3);
            });

            it("Should call _onlineExpiring() if unsuccess event and was online", function() {
                manager.isOnline = true;
                spyOn(manager, "_onlineExpiring");

                // Run
                manager._connectionListener({status: "connection:error"});

                // Posttest
                expect(manager._onlineExpiring).toHaveBeenCalledWith();
            });

            it("Should call _scheduleNextOnlineCheck() if unsuccess event and was offline", function() {
                manager.isOnline = false;
                spyOn(manager, "_scheduleNextOnlineCheck");

                // Run
                manager._connectionListener({status: "connection:error"});

                // Posttest
                expect(manager._scheduleNextOnlineCheck).toHaveBeenCalledWith();
            });
        });
    });

    describe("Path C: Offline handling", function() {
        describe("The _scheduleNextOnlineCheck() method", function() {
            var manager;
            beforeEach(function() {
                manager = this.onlineManager = new layer.OnlineStateManager({
                socketManager: socket,
                isOnline: false,
                isClientReady: true
                });
            });

            afterEach(function() {
                manager.destroy();
            });

            it("Should call _clearCheck", function() {
                spyOn(manager, "_clearCheck");
                manager._scheduleNextOnlineCheck();
                expect(manager._clearCheck).toHaveBeenCalledWith();
            });

            it("Should schedule checkOnlineStatus to be called based on getExponentialBackoffSeconds", function() {
                spyOn(manager, "checkOnlineStatus");
                var tmp = layer.Util.getExponentialBackoffSeconds;
                spyOn(layer.Util, "getExponentialBackoffSeconds").and.returnValue(50);
                manager.isOnline = false;
                client.socketManager.isOpen = true;

                // Run
                manager._scheduleNextOnlineCheck();
                jasmine.clock().tick(50 * 1000 - 1);
                expect(manager.checkOnlineStatus).not.toHaveBeenCalled();

                // Posttest
                jasmine.clock().tick(2);
                expect(manager.checkOnlineStatus).toHaveBeenCalled();
                expect(layer.Util.getExponentialBackoffSeconds).toHaveBeenCalledWith(manager.maxOfflineWait, 3);

                // Restore
                layer.Util.getExponentialBackoffSeconds = tmp;
            });

            it("Should set onlineCheckId", function() {
                manager.onlineCheckId = 0;
                manager._scheduleNextOnlineCheck();
                expect(manager.onlineCheckId > 0).toBe(true);
            });
        });

        describe("The _onlineExpiring() method", function() {
            var manager;
            beforeEach(function() {
                manager = this.onlineManager = new layer.OnlineStateManager({
                  socketManager: socket
                });
                spyOn(manager, "_onlineExpired");
            });

            afterEach(function() {
                manager.destroy();
            });

            it("Should call _onlineExpired if request fails", function() {
                manager._onlineExpiring();
                requests.mostRecent().response({status: 0});
                expect(manager._onlineExpired).toHaveBeenCalledWith();
            });

            it("Should not call _onlineExpired if request successful", function() {
                manager._onlineExpiring();
                requests.mostRecent().response({status: 200});
                expect(manager._onlineExpired).not.toHaveBeenCalled();
            });

            it("Should not call _onlineExpired if request fails and _isOnlineExpiring is false", function() {
                manager._onlineExpiring();
                manager._isOnlineExpiring = false;
                requests.mostRecent().response({status: 0});
                expect(manager._onlineExpired).not.toHaveBeenCalled();
            });

            it("Should clear _isOnlineExpiring when done", function() {
                manager._onlineExpiring();
                expect(manager._isOnlineExpiring).toBe(true);
                requests.mostRecent().response({status: 0});
                expect(manager._isOnlineExpiring).toBe(false);

                manager._onlineExpiring();
                expect(manager._isOnlineExpiring).toBe(true);
                requests.mostRecent().response({status: 200});
                expect(manager._isOnlineExpiring).toBe(false);
            });
        });

        describe("The _onlineExpired() method", function() {
          var manager;
          beforeEach(function() {
              manager = this.onlineManager = new layer.OnlineStateManager({
                socketManager: socket
              });
          });

          afterEach(function() {
              manager.destroy();
          });

          it("Should clear the timeout", function() {
            spyOn(manager, "_clearCheck");
            manager._onlineExpired();
            expect(manager._clearCheck).toHaveBeenCalledWith();
          });

          it("Should call _changeToOffline", function() {
            spyOn(manager, "_changeToOffline");
            manager._onlineExpired();
            expect(manager._changeToOffline).toHaveBeenCalledWith();
          });

          it("Should schedule continued tests", function() {
            spyOn(manager, "_scheduleNextOnlineCheck");
            manager._onlineExpired();
            expect(manager._scheduleNextOnlineCheck).toHaveBeenCalledWith();
          });
        });


        describe("The _changeToOffline() method", function() {
          var manager;
          beforeEach(function() {
              manager = this.onlineManager = new layer.OnlineStateManager({
                socketManager: socket
              });
              manager.isOnline = true;
          });

          afterEach(function() {
              manager.destroy();
          });

          it("Should set isOnline to false", function() {
            manager._changeToOffline();
            expect(manager.isOnline).toBe(false);
          });

          it("Should set trigger disconnected", function() {
            spyOn(manager, "trigger");
            manager._changeToOffline();
            expect(manager.trigger).toHaveBeenCalledWith("disconnected");
          });

          it("Should not trigger if already offline", function() {
            manager.isOnline = false;
            spyOn(manager, "trigger");
            manager._changeToOffline();
            expect(manager.trigger).not.toHaveBeenCalled();
          });
        });
    });
});