/*eslint-disable */
describe("The Channel Class", function() {
    var appId = "Fred's App";

    var channel,
        userIdentity1,
        userIdentity2,
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
        userIdentity1 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/1",
            displayName: "1",
            userId: "1"
        });
        userIdentity2 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/2",
            displayName: "2",
            userId: "2"
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

        channel = client._createObject(responses.channel1);
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
      it("Should register the channel", function() {
        expect(client.getChannel(channel.id)).toBe(channel);
      });
    });

    describe("The destroy() method", function() {
      /* Waiting for Spec to Complete */
      xit("Should clear the membership", function() {
            // Pretest
            var m = channel.membership;
            expect(m).not.toBe(null);

            // Run
            channel.destroy();

            // Posttest
            expect(channel.membership).toBe(null);
        });

        it("Should call _removeChannel", function() {
            // Setup
            spyOn(client, "_removeChannel");

            // Run
            channel.destroy();

            // Posttest
            expect(client._removeChannel).toHaveBeenCalledWith(channel);
        });


        it("Should fire a destroy event", function() {
            // Setup
            spyOn(channel, "trigger");

            // Run
            channel.destroy();

            // Posttest
            expect(channel.trigger).toHaveBeenCalledWith("destroy");
        });
    });

    describe("The send() method", function() {
      it("Should be chainable", function() {
          // Run
          expect(channel.send()).toBe(channel);
      });

      it("Should call client.sendSocketRequest", function() {
          // Setup
          spyOn(client, "sendSocketRequest");
          channel.syncState = layer.Constants.SYNC_STATE.NEW;

          // Run
          channel.send();

          // Posttest
          expect(client.sendSocketRequest).toHaveBeenCalledWith({
              method: 'POST',
              body: {},
              sync: {
                depends: channel.id,
                target: channel.id
              }
            }, jasmine.any(Function));
      });

      it("Should set the message position", function() {
        var message = channel.createMessage("Hello");
        expect(message.position).toBe(0);
        channel.send(message);
        expect(message.position > 0).toBe(true);
      });
    });

    describe("The _getSendData() method", function() {
      it("Should return the current state of the data in a create format", function() {
        var channel = new layer.Channel({
          client: client,
          metadata: {hey: "ho"},
          name: "Frodo is a Dodo"
        });
        expect(channel._getSendData()).toEqual({
          method: 'Channel.create',
          data: {
            members: [client.user.id],
            metadata: {hey: "ho"},
            id: channel.id,
            name: "Frodo is a Dodo"
          }
        });
      });

      it("Should return null if no metadata", function() {
        var channel = new layer.Channel({
          members: [userIdentity1, client.user],
          client: client,
          name: "Frodo is a Dodo"
        });
        expect(channel._getSendData()).toEqual({
          method: 'Channel.create',
          data: {
            members: [userIdentity1.id, client.user.id],
            id: channel.id,
            name: "Frodo is a Dodo",
            metadata: null
          }
        });
      });
    });

    describe("The _createResultConflict() method", function() {
      it("Should call _createSuccess if given a channel", function() {
        var returnedChannel = {};
        channel = new layer.Channel({client: client});
        spyOn(channel, "trigger");
        spyOn(channel, "_createSuccess");
        channel._createResultConflict({data: returnedChannel});
        expect(channel._createSuccess).toHaveBeenCalledWith(returnedChannel);
        expect(channel.trigger).not.toHaveBeenCalled();
      });

      it("Should trigger sent-error and mark it as NEW if not given a channel", function() {
        channel = new layer.Channel({client: client});
        spyOn(channel, "trigger");
        spyOn(channel, "_createSuccess");
        channel._createResultConflict({data: null});
        expect(channel.trigger).toHaveBeenCalledWith('channels:sent-error', {error: {data: null}});
        expect(channel._createSuccess).not.toHaveBeenCalled();
        expect(channel.isNew()).toBe(true);
      });
    });

    describe("The name property", function() {
      it("Should be setable if new", function() {
        channel = new layer.Channel({client: client});
        channel.name = "fred";
        expect(channel.name).toEqual("fred");
      });

      it("Should throw error if setting it when not new", function() {
        channel = new layer.Channel({client: client});
        channel.syncState = layer.Constants.SYNC_STATE.SYNCED;
        expect(function() {
          channel.name = "fred";
        }).toThrowError(layer.LayerError.dictionary.permissionDenied);
        expect(layer.LayerError.dictionary.permissionDenied).toEqual(jasmine.any(String));
        expect(channel.name).not.toEqual("fred");
      });

      it("Should trigger change events when set", function() {
        channel = new layer.Channel({client: client});
        spyOn(channel, "_triggerAsync");

        channel.name = "fred";
        expect(channel._triggerAsync).toHaveBeenCalledWith('channels:change', {
          property: 'name',
          oldValue: '',
          newValue: 'fred'
        });
      });
    });

    describe("The _populateFromServer() method", function() {
        var channel, c;
        beforeEach(function() {
            c = JSON.parse(JSON.stringify(responses.channel2));
            channel = new layer.Channel({client: client});
            jasmine.clock().tick(1);
        });

        it("Should copy in all channel properties", function() {
            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(channel.id).toEqual(c.id);
            expect(channel.url).toEqual(c.url);
            expect(channel.name).toEqual(c.name);
            expect(channel.metadata).toEqual(c.metadata);
            expect(channel.createdAt).toEqual(new Date(c.created_at));

            /* WAITING FOR SPEC TO COMPLETE
            expect(channel.membership).toEqual(jasmine.any(layer.Membership));
            expect(channel.membership).toBe(client.getMember(c.membership.id));
            */
        });

        it("Should trigger change events if not new", function() {
            // Setup
            channel.syncState = layer.Constants.SYNC_STATE.SYNCED;
            spyOn(channel, "_triggerAsync");

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(channel._triggerAsync).toHaveBeenCalledWith("channels:change", jasmine.any(Object));
        });

        it("Should trigger ID change events", function() {
            // Setup
            spyOn(channel, "_triggerAsync");
            var initialId = channel.id;

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(channel._triggerAsync)
                .toHaveBeenCalledWith('channels:change', {
                    oldValue: initialId,
                    newValue: channel.id,
                    property: 'id',
                });
        });

        it("Should trigger name change events", function() {
          // Setup
            channel.name = 'a';
            spyOn(channel, "_triggerAsync");

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(channel._triggerAsync)
                .toHaveBeenCalledWith('channels:change', {
                    oldValue: 'a',
                    newValue: c.name,
                    property: 'name',
                });

        });

        /* TODO Waiting for SPEC Complete */
        xit("Should setup membership", function() {
            // Setup
            client._models.members = {};

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(client._models.members[channel.membership.id]).toEqual(jasmine.any(layer.Membership));
            expect(channel.membership).toEqual(jasmine.any(layer.Membership));
        });

        /* TODO Waiting for SPEC Complete */
        xit("Should setup membership from string", function() {
            // Setup
            var mid = c.membership.id;
            client._models.members = {};
            client._createObject(c.membership);
            c.membership = mid;

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(channel.membership).toEqual(jasmine.any(layer.Membership));
            expect(channel.membership).toBe(client._models.members[mid]);
        });

        it("Should call client._addChannel", function() {
            // Setup
            spyOn(client, "_addChannel");

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(client._addChannel).toHaveBeenCalledWith(channel);
        });

        it("Should set isCurrentParticipant", function() {
            // Setup
            channel.isCurrentParticipant = false;

            // Run
            channel._populateFromServer(c);

            // Posttest
            expect(channel.isCurrentParticipant).toBe(true);

            // Rerun
            c.membership = null;
            channel._populateFromServer(c);
            expect(channel.isCurrentParticipant).toBe(false);
        });
    });

    describe("The _createResult() method", function() {
      it("Should trigger trigger channels:sent if successful", function() {
        spyOn(channel, "_triggerAsync");
        channel._createResult({success: true, data: {
          id: channel.id
        }});
        expect(channel._triggerAsync).toHaveBeenCalledWith('channels:sent', {
          result: layer.Channel.CREATED
        });
      });

      it("Should return conflict object if conflict and trigger channels:sent", function() {
        spyOn(channel, "_triggerAsync");
        channel._createResult({success: false, data: {
          id: 'conflict',
          data: {
            id: "layer:///channels/frodo-brodo",
            metadata: {
              deathTo: "Frodo",
              longLive: "Sauruman"
            }
          }
        }});
        expect(channel._triggerAsync).toHaveBeenCalledWith('channels:sent', {
          result: layer.Channel.FOUND
        });
        expect(channel.metadata).toEqual({
          deathTo: "Frodo",
          longLive: "Sauruman"
        });
        expect(channel.id).toEqual("layer:///channels/frodo-brodo");
        expect(layer.Channel.FOUND.length > 0).toBe(true);
      });

      it("Should trigger trigger channels:sent-error if errors", function() {
        spyOn(channel, "trigger");
        channel._createResult({success: false, data: {
          id: 'doh!'
        }});
        expect(channel.trigger).toHaveBeenCalledWith('channels:sent-error', {
          error: {
            id: 'doh!'
          }
        });
      });


      it("Should do nothing if isDestroyed", function() {
        spyOn(channel, "_triggerAsync");
        channel.isDestroyed = true;
        channel._createResult({success: true, data: {status: "Doh!"}});
        expect(channel._triggerAsync).not.toHaveBeenCalled();
      });
    });

    /* TODO Waiting for SPEC Complete */
    describe("The addMembers() method", function() {
      it("Should fire off an xhr call", function() {
        spyOn(channel, "_xhr");
        channel.addMembers(['a', 'b', 'c']);
        expect(channel._xhr).toHaveBeenCalledWith({
          url: '/members/a',
          method: 'PUT'
        });
        expect(channel._xhr).toHaveBeenCalledWith({
          url: '/members/b',
          method: 'PUT'
        });
        expect(channel._xhr).toHaveBeenCalledWith({
          url: '/members/c',
          method: 'PUT'
        });
      });

      it("Should append items to _members and not fire a request if its new", function() {
        var channel = client.createChannel({
          name: "FrodoTheDodo"
        });
        channel.addMembers([userIdentity2]);
        expect(channel._members).toEqual([userIdentity2.id]);
        expect(requests.mostRecent()).toBe(undefined);
      });
    });

    /* TODO Waiting for SPEC Complete */
    describe("The removeMembers() method", function() {
      it("Should fire off an xhr call", function() {
        spyOn(channel, "_xhr");
        channel.removeMembers(['a', 'b', 'c']);
        expect(channel._xhr).toHaveBeenCalledWith({
          url: '/members/a',
          method: 'DELETE'
        });
        expect(channel._xhr).toHaveBeenCalledWith({
          url: '/members/b',
          method: 'DELETE'
        });
        expect(channel._xhr).toHaveBeenCalledWith({
          url: '/members/c',
          method: 'DELETE'
        });
      });

      it("Should remove items from _members and not fire a request if its new", function() {
        var channel = client.createChannel({
          name: "FrodoTheDodo",
          members: [userIdentity1, userIdentity2]
        });
        channel.removeMembers([userIdentity2]);
        expect(channel._members).toEqual([userIdentity1.id]);
        expect(requests.mostRecent()).toBe(undefined);
      });
    });

    describe("The join() method", function() {
      it("Should call addMembers", function() {
        spyOn(channel, "addMembers");
        channel.join();
        expect(channel.addMembers).toHaveBeenCalledWith([client.user.id]);
      });
    });

    describe("The leave() method", function() {
      it("Should call removeMembers", function() {
        spyOn(channel, "removeMembers");
        channel.leave();
        expect(channel.removeMembers).toHaveBeenCalledWith([client.user.id]);
      });
    });

    describe("The getMember() method", function() {
      it("Should return a cached member", function() {
        var m = client._createObject(responses.membership1);
        expect(channel.getMember(m.identity.id)).toBe(m);
      });

      it("Should return an empty member that is loading", function() {
        var m = channel.getMember(responses.membership1.identity.id, true);
        expect(m).toEqual(jasmine.any(layer.Membership));
        expect(m.syncState).toEqual(layer.Constants.SYNC_STATE.LOADING);
      });
    });

    describe("The delete() method", function() {
      it("Should call _delete", function() {
        spyOn(channel, "_delete");
        channel.delete();
        expect(channel._delete).toHaveBeenCalledWith('');
      });
    });

    describe("The _deleteResult() method", function() {
      it("Should load the channel if error", function() {
        spyOn(client, "xhr");
        channel._deleteResult({
          success: false,
          data: {
            id: "Doh!"
          }
        }, channel.id);
        expect(client.xhr).toHaveBeenCalledWith({
          method: "GET",
          url: channel.url,
          sync: false
        }, jasmine.any(Function));
      });

      it("Should not load the channel if error is not_found", function() {
        spyOn(client, "xhr");
        channel._deleteResult({
          success: false,
          data: {
            id: "not_found"
          }
        });
        expect(client.xhr).not.toHaveBeenCalled();
      });

    });

    describe("The create() method", function() {
      it("Should throw error if no client", function() {
        expect(function() {
          layer.Channel.create({
            name: "Argh"
          });
        }).toThrowError(layer.LayerError.dictionary.clientMissing);

      });

      it("Should return a Channel", function() {
        expect(layer.Channel.create({
          client: client,
          name: "FrodoIsLame"
        })).toEqual(jasmine.any(layer.Channel));
      });

      it("Should have suitable properties", function() {
        var channel = layer.Channel.create({
          client: client,
          name: "FrodoIsLame",
          metadata: {
            subtopic: {
              whoIsCool: "Sauruman"
            }
          }
        });
        expect(channel.metadata).toEqual({
          subtopic: {
              whoIsCool: "Sauruman"
            }
        });
        expect(channel.name).toEqual("FrodoIsLame");
        expect(channel._sendDistinctEvent).toBe(null);
      });

      it("Should return a matching Channel with different metadata", function() {
        var channel2 = layer.Channel.create({
          client: client,
          name: channel.name,
          metadata: {
            subtopic: {
              whoIsCool: "Sauruman2"
            }
          }
        });

        expect(channel2).toBe(channel);
        expect(channel2.metadata).not.toEqual({
          subtopic: {
              whoIsCool: "Sauruman"
            }
        });
        expect(channel2.metadata).toEqual(channel.metadata);
        expect(channel._sendDistinctEvent).not.toBe(null);
        expect(channel._sendDistinctEvent.result).toEqual(layer.Channel.FOUND_WITHOUT_REQUESTED_METADATA);
        expect(layer.Channel.FOUND_WITHOUT_REQUESTED_METADATA.length > 0).toBe(true);
        expect(channel._sendDistinctEvent.target).toBe(channel2);
      });

      it("Should return a matching Channel with same metadata", function() {
        var channel2 = layer.Channel.create({
          client: client,
          name: channel.name,
          metadata: channel.metadata
        });

        expect(channel2).toBe(channel);

        expect(channel._sendDistinctEvent).not.toBe(null);
        expect(channel._sendDistinctEvent.result).toEqual(layer.Channel.FOUND);
        expect(layer.Channel.FOUND.length > 0).toBe(true);
        expect(channel._sendDistinctEvent.target).toBe(channel2);
      });
  });
});