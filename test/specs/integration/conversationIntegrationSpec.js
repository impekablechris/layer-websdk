/*eslint-disable */
describe("Conversation Integration Tests", function() {
    var socket, client, syncManager, request;
    var appId = "Fred's App";
    var userIdentity;

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
          isFullIdentity: true
        });

        client._clientAuthenticated();
        conversation = client._createObject(JSON.parse(JSON.stringify(responses.conversation1)));

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

        userIdentity = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/6",
            displayName: "6",
            userId: "6"
        });
        request = new layer.XHRSyncEvent({
            method: "POST",
            data: {hey: "ho"},
            target: "fred",
            callback: function() {}
        });

        jasmine.clock().tick(1);
        requests.reset();
        syncManager.queue = [request];
        client.syncManager.queue = [];
        client._clientReady();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });


    it("Should reload participants on error and refire a conversations:change event", function() {
      syncManager.queue = [];

      // Run replaceParticipant and have it fail
      conversation.replaceParticipants([client.user.userId, userIdentity.userId]);
      requests.mostRecent().response({
        status: 500,
        data: {}
      });

      // Run Conversation.load
      spyOn(conversation, "_triggerAsync");
      requests.mostRecent().response({
        status: 200,
        responseText: JSON.stringify(responses.conversation1)
      });


      // Posttest
      expect(conversation._triggerAsync).toHaveBeenCalledWith("conversations:change", jasmine.objectContaining({
        oldValue: [client.user, userIdentity],
        newValue: client._fixIdentities(responses.conversation1.participants),
        property: "participants"
      }));
    });

    it("Should reload metadata on error and refire a conversations:change event", function() {
      var initialMetadata = JSON.parse(JSON.stringify(responses.conversation1.metadata));
      initialMetadata.hey = "ho";

      // Run setMetadataProperties and have it fail
      conversation.setMetadataProperties({hey: "ho"});
      requests.mostRecent().response({
        status: 500,
        data: {}
      });

      // Run Conversation.load
      spyOn(conversation, "_triggerAsync");
      requests.mostRecent().response({
        status: 200,
        responseText: JSON.stringify(responses.conversation1)
      });


      // Posttest
      expect(conversation._triggerAsync).toHaveBeenCalledWith("conversations:change", jasmine.objectContaining({
        oldValue: initialMetadata,
        newValue: responses.conversation1.metadata,
        property: "metadata"
      }));
    });

});