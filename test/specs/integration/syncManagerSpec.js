/*eslint-disable */
describe("SyncManager Integration Tests", function() {
    var socket, client, syncManager, request;
    var appId = "Fred's App";

    beforeEach(function() {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        client = new layer.Client({
            appId: appId,
            url: "http://localhost:9753",
            isTrustedDevice: false
        });
        client.sessionToken = "sessionToken";
        client.user = new layer.Identity({
            clientId: client.appId,
            userId: "Frodo",
            id: "layer:///identities/" + "Frodo",
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
        conversation = client._createObject(responses.conversation1).conversation;
        requests.reset();
        client.syncManager.queue = [];
        jasmine.clock().tick(1);
        syncManager = new layer.SyncManager({
            client: client,
            onlineManager: client.onlineManager,
            socketManager: client.socketManager,
            requestManager: client.socketRequestManager
        });
        client.onlineManager.isOnline = true;
       client.socketManager._socket = {
            send: function() {},
            addEventListener: function() {},
            removeEventListener: function() {},
            close: function() {},
            readyState: WebSocket.OPEN
        };
        request = new layer.XHRSyncEvent({
            method: "POST",
            data: {hey: "ho"},
            target: "fred",
            callback: function() {}
        });
        syncManager.queue = [request];

    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    it("Should schedule a retry after a service unavailable error", function() {
        var tmp = layer.Util.getExponentialBackoffSeconds;
        spyOn(layer.Util, "getExponentialBackoffSeconds").and.returnValue(5);
        spyOn(syncManager, "_processNextRequest");
        syncManager._xhrError({
            success: false,
            status: 503,
            request: request,
            data: {}
        });

        jasmine.clock().tick(4999);
        expect(syncManager._processNextRequest).not.toHaveBeenCalled();

        jasmine.clock().tick(2);
        expect(syncManager._processNextRequest).toHaveBeenCalled();

        expect(request.retryCount).toEqual(1);
        expect(syncManager.queue).toEqual([request]);

        while(request.retryCount < layer.SyncManager.MAX_RETRIES) {
            syncManager._xhrError({
                success: false,
                status: 503,
                request: request,
                data: {}
            });
            jasmine.clock().tick(5002);
            client.onlineManager.isOnline = true;
        }

        syncManager._xhrError({
            success: false,
            status: 503,
            request: request,
            data: {}
        });

        expect(syncManager.queue).toEqual([]);

        // Restore
        layer.Util.getExponentialBackoffSeconds = tmp;
    });


});