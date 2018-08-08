/*eslint-disable */
describe("The AnnouncementsQuery Class", function() {
    var appId = "Fred's App";

    var conversation,
        announcement,
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
          model: layer.Query.Announcement
        });
        conversation = client._createObject(responses.conversation1);
        announcement = client._createObject(responses.announcement);

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

    it("Should be an AnnouncementQuery", function() {
      expect(query.constructor.prototype.model).toEqual(layer.Query.Announcement);
    });

    describe("The _fetchData() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = client.createQuery({
                client: client,
                model: layer.Query.Announcement,
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

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._fetchData(140);
            expect(requests.mostRecent().url).toEqual(client.url + "/announcements?page_size=140");

            // Test 2
            query._nextServerFromId = "howdy";
            query._fetchData(140);
            expect(requests.mostRecent().url).toEqual(client.url + "/announcements?page_size=140&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadAnnouncements");

          // Test 1
          query._fetchData(141);
          expect(client.dbManager.loadAnnouncements).toHaveBeenCalledWith('', 141, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._fetchData(141);
          expect(client.dbManager.loadAnnouncements).toHaveBeenCalledWith('howdy', 141, jasmine.any(Function));
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
            }), "announcements?page_size=47", 47);
        });
    });

});
