/*eslint-disable */
describe("The SyncEvent Classes", function() {
    var client;
    var appId = "Fred's App";
    beforeEach(function() {
      jasmine.clock().install();
      client = new layer.Client({
            appId: appId,
            url: "http://localhost:9753"
      });

      client.userId = 'Frodo';
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
        client._clientReady();
    });
    afterEach(function() {
      jasmine.clock().uninstall();
      client.destroy();
    });

    describe("The SyncEvent Class", function() {
        describe("The constructor() method", function() {
            it("Should return a SyncEvent instance", function() {
                expect(new layer.SyncEvent({})).toEqual(jasmine.any(layer.SyncEvent));
            });

            it("Should initialize the operation", function() {
                expect(new layer.SyncEvent({operation: "PATCH"}).operation).toEqual("PATCH");
            });

            it("Should initialize depends", function() {
                expect(new layer.SyncEvent({depends: "DEPENDS"}).depends).toEqual("DEPENDS");
            });

            it("Should initialize target", function() {
                expect(new layer.SyncEvent({target: "target"}).target).toEqual("target");
            });

            it("Should initialize data", function() {
                expect(new layer.SyncEvent({data: "data"}).data).toEqual("data");
            });

            it("Should initialize callback", function() {
                expect(new layer.SyncEvent({callback: "callback"}).callback).toEqual("callback");
            });

            it("Should initialize an ID", function() {
              expect(new layer.SyncEvent({data: "data"}).id).toMatch(/layer:\/\/\/syncevents\/.*/);
            });

            it("Should accept an ID", function() {
              expect(new layer.SyncEvent({id: "id"}).id).toEqual("id");
            });

            it("Should generate a createdAt", function() {
              expect(new layer.SyncEvent({id: "id"}).createdAt > 0).toBe(true);
            });

            it("Should accept a createdAt", function() {
              expect(new layer.SyncEvent({createdAt: 5}).createdAt).toEqual(5);
            });
        });

        describe("The destroy() method", function() {
            var evt;
            beforeEach(function() {
                evt = new layer.SyncEvent({
                    depends: "a",
                    target: "b",
                    callback: function() {},
                    data: "c"
                });
            });

            it("Should clear depends", function() {
                evt.destroy();
                expect(evt.depends).toBe(null);
            });

            it("Should clear target", function() {
                evt.destroy();
                expect(evt.target).toBe(null);
            });

            it("Should clear data", function() {
                evt.destroy();
                expect(evt.data).toBe(null);
            });

            it("Should clear callback", function() {
                evt.destroy();
                expect(evt.callback).toBe(null);
            });
        });

        describe("The _updateData() method", function() {
            it("Should call target._getSendData if there is a target", function() {
                var c = client.createConversation({participants: ["hey"]});
                var evt = new layer.SyncEvent({
                    data: "hey",
                    target: c.id,
                    operation: "POST"
                });
                spyOn(c, "_getSendData").and.returnValue({hey: "fred"});
                evt._updateData(client);
                expect(evt.data).toEqual({hey: "fred"});
            });
        });
    });

    describe("The XHRSyncEvent Class", function() {
        describe("The _getRequestData() method", function() {
            var evt;
            beforeEach(function() {
                evt = new layer.XHRSyncEvent({
                    url: "url",
                    depends: "a",
                    target: "b",
                    callback: function() {},
                    data: "data",
                    headers: "headers",
                    method: "method"
                });
            });

            it("Should call _updateData", function() {
                spyOn(evt, "_updateData");
                evt._getRequestData(client);
                expect(evt._updateData).toHaveBeenCalledWith(client);
            });

            it("Should call _updateUrl", function() {
                spyOn(evt, "_updateUrl");
                evt._getRequestData(client);
                expect(evt._updateUrl).toHaveBeenCalledWith(client);
            });

            it("Should return expected properties", function() {
                expect(evt._getRequestData(client)).toEqual({
                    url: "url",
                    data: "data",
                    headers: "headers",
                    method: "method",
                    telemetry: null
                });
            });
        });

        describe("The _updateUrl() method", function() {
            it("Should leave data alone if no target", function() {
                var evt = new layer.XHRSyncEvent({
                    url: "hey"
                });
                evt._updateUrl();
                expect(evt.url).toEqual("hey");
            });

            it("Should update url if its a function", function() {
                var c = client.createConversation({participants: ['abc']});
                spyOn(c, "_getUrl").and.returnValue("ho");
                var evt = new layer.XHRSyncEvent({
                    url: "hey",
                    target: c.id
                });
                expect(evt.url).toEqual("hey");
                evt._updateUrl(client);
                expect(evt.url).toEqual("ho");
            });
        });

        describe("The _getCreateId() method", function() {
          it("Should get the requested ID for the new object", function() {
            var evt = new layer.XHRSyncEvent({
                url: function() {return "hey"},
                operation: "POST",
                data: {
                  id: 'doh'
                }
            });
            expect(evt._getCreateId()).toEqual('doh');
          });
        });
    });

    describe("The WebsocketSyncEvent Class", function() {
      describe("The _getCreateId() method", function() {
        it("Should get the requested ID for the new object", function() {
          var evt = new layer.WebsocketSyncEvent({
              url: function() {return "hey"},
              operation: "POST",
              data: {
                method: "Conversation.create",
                data: {
                  id: 'doh'
                }
              }
          });
          expect(evt._getCreateId()).toEqual('doh');
        });
      });
    });

    describe("The firing property", function() {
      it("Should reset to false after 15 seconds", function() {
        var evt = new layer.XHRSyncEvent({
            url: "hey"
        });
        expect(evt.isFiring).toBe(false);
        var d = new Date();
        jasmine.clock().mockDate(d);



        // Run
        evt.isFiring = true;
        expect(evt.isFiring).toBe(true);

        d.setSeconds(d.getSeconds() + 14);
        jasmine.clock().mockDate(d);
        expect(evt.isFiring).toBe(true);

        d.setSeconds(d.getSeconds() + 2);
        jasmine.clock().mockDate(d);
        expect(evt.isFiring).toBe(false);
      });
    });

    describe("The _isValidating property", function() {
      it("Should reset to false after half a second", function() {
        var evt = new layer.XHRSyncEvent({
            url: "hey"
        });
        expect(evt._isValidating).toBe(false);
        var d = new Date();
        jasmine.clock().mockDate(d);



        // Run
        evt._isValidating = true;
        expect(evt._isValidating).toBe(true);

        d.setSeconds(d.getSeconds() + 0.4);
        jasmine.clock().mockDate(d);
        expect(evt._isValidating).toBe(true);

        d.setSeconds(d.getSeconds() + 1);
        jasmine.clock().mockDate(d);
        expect(evt._isValidating).toBe(false);
      });
    });
});
