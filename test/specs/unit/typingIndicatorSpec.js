/*eslint-disable */
describe("The Typing Indicator Classes", function() {
    var appId = "Fred's App";

    var conversation,
        client,
        convId = "layer:///conversations/myconv",
        johnIdentity,
        janeIdentity,
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

        johnIdentity = new layer.Identity({
            client: client,
            userId: "JohnDoh",
            id: "layer:///identities/JohnDoh",
            displayName: "John Doh"
        });
        client._addIdentity(johnIdentity);

        janeIdentity = new layer.Identity({
            client: client,
            userId: "JaneDoh",
            id: "layer:///identities/JaneDoh",
            displayName: "Jane Doh"
        });
        client._addIdentity(janeIdentity);

        client._clientAuthenticated();
        getObjectsResult = [];
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectsResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        client.socketManager._socket = {
            close: function() {},
            send: function() {},
            removeEventListener: function() {},
            readyState: typeof WebSocket != "undefined" ? WebSocket.CONNECTING : 2
        };

        var convData = JSON.parse(JSON.stringify(responses.conversation1));
        convData.id = convId;
        conversation = client._createObject(convData);

        requests.reset();
        client.syncManager.queue = [];
        jasmine.clock().tick(1);
    });

    afterEach(function() {
        client.destroy();
        jasmine.Ajax.uninstall();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The TypingIndicatorListener class", function() {
        describe("The constructor() method", function() {
            it("Should setup state", function() {
                var listener = client._typingIndicators;
                expect(listener.state).toEqual({});
            });

            it("Should connect to client ready", function() {
                var listener = client._typingIndicators;
                spyOn(listener, "_clientReady");
                client.isReady = false;
                client._clientReady();
                expect(listener._clientReady).toHaveBeenCalledWith();
            });
        });

        describe("The _clientReady() method", function() {
            var listener;
            beforeEach(function() {
                listener = client._typingIndicators;
                listener.userId = "";
                listener._websocket = null;
                client.socketManager.off(null,null,listener);
                clearTimeout(listener._pollId);
                listener._pollId = 0;
            });

            afterEach(function() {
                listener.destroy();
            });

            it("Should set the userId", function() {
                listener._clientReady(client);
                expect(listener.user).toBe(client.user);
            });

            it("Should subscribe to the websocket", function() {
                spyOn(listener, "_handleSocketEvent");
                listener._clientReady(client);
                client.socketManager.trigger("message", {data: {"hey": "ho"}});
                expect(listener._handleSocketEvent).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));
                expect(listener._handleSocketEvent).toHaveBeenCalledWith(jasmine.objectContaining({
                  data: {
                    hey: "ho"
                  },
                  eventName: "message"
                }));
            });

            it("Should start the poller", function() {
                spyOn(listener, "_startPolling");
                listener._clientReady(client);
                expect(listener._startPolling).toHaveBeenCalledWith();
            });
        });

        describe("The _isRelevantEvent() method", function() {
            var listener, evt;
            beforeEach(function() {
                listener = client._typingIndicators;
                client._clientReady();
                evt = {
                    type: "signal",
                    body: {
                        type: "typing_indicator",
                        data: {
                            sender: {
                                user_id: client.user.userId + "1",
                                id: client.user.id + "1"
                            },
                            action: layer.TypingIndicators.STARTED
                        }
                    }
                };
            });

            afterEach(function() {
                listener.destroy();
            });

            it("Should return true if all is setup correctly", function() {
                expect(listener._isRelevantEvent(evt)).toBe(true);
            });

            it("Should return false if not a signal", function() {
                evt.type = "signal2";
                expect(listener._isRelevantEvent(evt)).toBe(false);
            });

            it("Should return false if not a typing indicator", function() {
                evt.body.type = "presence";
                expect(listener._isRelevantEvent(evt)).toBe(false);
            });

            it("Should return false if sent by this user", function() {
                evt.body.data.sender = {
                    user_id: client.user.userId,
                    id: client.user.id
                };
                expect(listener._isRelevantEvent(evt)).toBe(false);
            });
        });

        describe("The _handleSocketEvent() method", function() {
            var listener, evt;
            beforeEach(function() {
                listener = client._typingIndicators;
                client._clientReady();
                evt = {
                    type: "signal",
                    body: {
                        type: "typing_indicator",
                        object: {
                            id: conversation.id
                        },
                        data: {
                            action: layer.TypingIndicators.STARTED,
                            sender: {
                                user_id: "JohnDoh",
                                id: "layer:///identities/JohnDoh"
                            }
                        }
                    }
                };
            });

            afterEach(function() {
                listener.destroy();
            });

            it("Should add state for a new Conversation", function() {
                listener._handleSocketEvent({data: evt});
                expect(listener.state).toEqual({
                    "layer:///conversations/myconv": {
                        users: {
                            "layer:///identities/JohnDoh": {
                                startTime: jasmine.any(Number),
                                state: layer.TypingIndicators.STARTED,
                                identity: johnIdentity
                            }
                        },
                        typing: ['layer:///identities/JohnDoh'],
                        paused: []
                    }
                });
            });

            it("Should update state for a Conversation", function() {
                listener._handleSocketEvent({data: evt});
                evt.body.data.action = layer.TypingIndicators.PAUSED;
                listener._handleSocketEvent({data: evt});
                expect(listener.state).toEqual({
                    "layer:///conversations/myconv": {
                        users: {
                            "layer:///identities/JohnDoh": {
                                startTime: jasmine.any(Number),
                                state: layer.TypingIndicators.PAUSED,
                                identity: johnIdentity
                            }
                        },
                        typing: [],
                        paused: ['layer:///identities/JohnDoh']
                    }
                });
            });

            it("Should remove state for a Conversation", function() {
                listener._handleSocketEvent({data: evt});
                evt.body.data.action = layer.TypingIndicators.FINISHED;
                listener._handleSocketEvent({data: evt});
                expect(listener.state).toEqual({
                    "layer:///conversations/myconv": {
                        users: {
                        },
                        typing: [],
                        paused: []
                    }
                });
            });

            it("Should trigger typing-indicator-change event", function() {
                spyOn(listener, "trigger");
                listener._handleSocketEvent({data: evt});
                expect(listener.trigger).toHaveBeenCalledWith("typing-indicator-change", {
                    conversationId: conversation.id,
                    typing: [johnIdentity.toObject()],
                    paused: []
                });
            });
        });

        describe("The _startPolling() method", function() {
            var listener;
            beforeEach(function() {
                listener = client._typingIndicators;
                clearTimeout(listener._pollId);
                listener._pollId = 0;
            });

            afterEach(function() {
                listener.destroy();
            });

            it("Should start polling if its not already polling", function() {
                expect(listener._pollId).toEqual(0);
                spyOn(listener, "_poll");
                listener._startPolling();
                jasmine.clock().tick(10000);
                expect(listener._poll).toHaveBeenCalledWith();
            });

            it("Should do nothing if already polling", function() {
                listener._startPolling();
                var pollId = listener._pollId;
                listener._startPolling();
                expect(listener._pollId).toEqual(pollId);
            });
        });

        describe("The _poll() method", function() {
            var listener, state;
            beforeEach(function() {
                listener = client._typingIndicators;
                client._clientReady();
                listener.state = {
                    "layer:///conversations/myconv": {
                        users: {
                            "layer:///identities/JohnDoh": {
                                startTime: Date.now(),
                                state: layer.TypingIndicators.PAUSED,
                                identity: johnIdentity
                            },
                            "layer:///identities/JaneDoh": {
                                startTime: Date.now() - 1000000,
                                state: layer.TypingIndicators.STARTED,
                                identity: janeIdentity
                            }
                        },
                        typing: ["layer:///identities/JaneDoh"],
                        paused: ["layer:///identities/JohnDoh"]
                    },
                    "layer:///conversations/myconv2": {
                        users: {
                            "layer:///identities/JohnMoh": {
                                startTime: Date.now() - 1000000,
                                state: layer.TypingIndicators.PAUSED,
                                identity: client.getIdentity('JohnMoh', true)
                            },
                            "layer:///identities/JaneMoh": {
                                startTime: Date.now() - 1000000,
                                state: layer.TypingIndicators.STARTED,
                                identity: client.getIdentity('JaneMoh', true)
                            }
                        },
                        typing: ["layer:///identities/JaneMoh"],
                        paused: ["layer:///identities/JohnMoh"]
                    }
                };
            });

            afterEach(function() {
                listener.destroy();
            });

            it("Should remove users who have not been updated lately", function() {
                listener._poll();
                expect(listener.state).toEqual({
                    "layer:///conversations/myconv": {
                        users: {
                            "layer:///identities/JohnDoh": {
                                startTime: jasmine.any(Number),
                                state: layer.TypingIndicators.PAUSED,
                                identity: johnIdentity
                            }
                        },
                        typing: [],
                        paused: ["layer:///identities/JohnDoh"]
                    },
                    "layer:///conversations/myconv2": {
                        users: {

                        },
                        typing: [],
                        paused: []
                    }
                });
            });

            it("Should trigger typing-indicator-change when removing users", function() {
                spyOn(listener, "trigger");
                listener._poll();
                expect(listener.trigger).toHaveBeenCalledWith("typing-indicator-change", {
                    typing: [],
                    paused: [johnIdentity.toObject()],
                    conversationId: "layer:///conversations/myconv"
                });

                expect(listener.trigger).toHaveBeenCalledWith("typing-indicator-change", {
                    typing: [],
                    paused: [],
                    conversationId: "layer:///conversations/myconv2"
                });
            });
        });

        describe("The getState() method", function() {
            var listener, state;
            beforeEach(function() {
                listener = client._typingIndicators;
                client._clientReady();
                client._addIdentity(janeIdentity);
                client._addIdentity(johnIdentity);
                listener.state = {
                    "layer:///conversations/myconv": {
                        users: {
                            "layer:///identities/JohnDoh": {
                                startTime: Date.now(),
                                state: layer.TypingIndicators.PAUSED,
                                identity: johnIdentity
                            },
                            "layer:///identities/JaneDoh": {
                                startTime: Date.now() - 1000000,
                                state: layer.TypingIndicators.STARTED,
                                identity: janeIdentity
                            }
                        },
                        typing: ["layer:///identities/JaneDoh"],
                        paused: ["layer:///identities/JohnDoh"]
                    },
                    "layer:///conversations/myconv2": {
                        users: {
                            "layer:///identities/JohnDoh": {
                                startTime: Date.now() - 1000000,
                                state: layer.TypingIndicators.PAUSED,
                                identity: client.getIdentity('JohnDoh')
                            },
                            "layer:///identities/JaneDoh": {
                                startTime: Date.now() - 1000000,
                                state: layer.TypingIndicators.STARTED,
                                identity: client.getIdentity('JaneDoh')
                            }
                        },
                        typing: ["layer:///identities/JaneDoh"],
                        paused: ["layer:///identities/JohnDoh"]
                    }
                };
            });

            afterEach(function() {
                listener.destroy();
            });

            it("Should return the typing state for the specified Conversation", function() {
                expect(listener.getState("layer:///conversations/myconv2").typing[0]).toEqual(janeIdentity.toObject());
                expect(listener.getState("layer:///conversations/myconv2").paused[0]).toEqual(johnIdentity.toObject());

                expect(listener.getState("layer:///conversations/myconv2")).toEqual({
                    typing: [janeIdentity.toObject()],
                    paused: [johnIdentity.toObject()]
                });
            });

            it("Should return reasonable result if Conversation not found", function() {
                expect(listener.getState("layer:///conversations/myconv2222")).toEqual({
                    typing: [],
                    paused: []
                });
            });
        });
    });

    describe("The TypingListener class", function() {
        var input, listener;

        beforeEach(function() {
            input = document.createElement("input");
            listener = client.createTypingListener(input);
        });

        afterEach(function() {
            listener.destroy();
        });

        describe("The constructor() method", function() {
            it("Should have an input", function() {
                expect(listener.input).toBe(input);
            });

            it("Should have a clientId", function() {
                expect(listener.clientId).toBe(client.appId);
            });

            it("Should have a TypingPublisher", function() {
                expect(listener.publisher).toEqual(jasmine.any(layer.TypingIndicators.TypingPublisher));
            });

            it("Should call setInput", function() {
                var tmp = layer.TypingIndicators.TypingListener.prototype.setInput;
                layer.TypingIndicators.TypingListener.prototype.setInput = jasmine.createSpy('setInput');
                var listener2 = client.createTypingListener(input);
                expect(layer.TypingIndicators.TypingListener.prototype.setInput).toHaveBeenCalledWith(input);

                // Cleanup
                layer.TypingIndicators.TypingListener.prototype.setInput = tmp;
                listener2.destroy();
            });
        });

        describe("The _removeInput() method", function() {
          it("Should call removeEventListener", function() {
            var input = listener.input = {
                removeEventListener: jasmine.createSpy('remove')
            };
            listener._removeInput(input);
            expect(input.removeEventListener).toHaveBeenCalledWith("keypress", listener._handleKeyPress);
            expect(input.removeEventListener).toHaveBeenCalledWith("keydown", listener._handleKeyDown);
          });

          it("Should set input to null", function() {
            listener.input = {
                removeEventListener: jasmine.createSpy('remove')
            };
            listener._removeInput(listener.input);
            expect(listener.input).toBe(null);
          });
        });

        describe("The setInput() method", function() {
          it("Should add event handlers", function() {
            var listener2 = client.createTypingListener();
            input = {
                addEventListener: jasmine.createSpy('listener'),
                removeEventListener: jasmine.createSpy('remove')
            };
            listener2.setInput(input);
            expect(input.addEventListener).toHaveBeenCalledWith("keypress", listener2._handleKeyPress);
            expect(input.addEventListener).toHaveBeenCalledWith("keydown", listener2._handleKeyDown);

            // Cleanup
            listener2.destroy();
          });

          it("Should set listener.input", function() {
            var listener2 = client.createTypingListener();
            input = {
                addEventListener: jasmine.createSpy('listener'),
                removeEventListener: jasmine.createSpy('remove')
            };
            listener2.setInput(input);
            expect(listener2.input).toBe(input);
          });

          it("Should call _removeInput", function() {
            var oldInput = {
                addEventListener: jasmine.createSpy('listener'),
                removeEventListener: jasmine.createSpy('remove')
            };
            var listener2 = client.createTypingListener(oldInput);
            spyOn(listener2, "_removeInput");
            input = {
                addEventListener: jasmine.createSpy('listener'),
                removeEventListener: jasmine.createSpy('remove')
            };
            listener2.setInput(input);
            expect(listener2._removeInput).toHaveBeenCalledWith(oldInput);
          });
        });

        describe("The destroy() method", function() {
            it("Should remove event handlers", function() {
                var input = listener.input = {
                    removeEventListener: jasmine.createSpy('remove')
                };
                listener.destroy();
                expect(input.removeEventListener).toHaveBeenCalledWith("keypress", listener._handleKeyPress);
                expect(input.removeEventListener).toHaveBeenCalledWith("keydown", listener._handleKeyDown);
            });

            it("Should destroy the publisher", function() {
                listener.destroy();
                expect(listener.publisher.isDestroyed).toBe(true);
            });

            it("Should remove references to the dom", function() {
                listener.destroy();
                expect(listener.input).toEqual(null);
            });
        });

        describe("The setConversation() method", function() {
            it("Should update the conversation property", function() {
                var conversation = client.createConversation({participants: ["a"]});
                listener.setConversation(conversation);
                expect(listener.conversation).toBe(conversation);
            });

            it("Should call publisher.setConversation", function() {
                spyOn(listener.publisher, "setConversation");
                var conversation = client.createConversation({participants: ["a"]});
                listener.setConversation(conversation);
                expect(listener.publisher.setConversation).toHaveBeenCalledWith(conversation);
            });

            it("Should not call publisher.setConversation if no change", function() {
                var conversation = client.createConversation({participants: ["a"]});
                listener.setConversation(conversation);
                spyOn(listener.publisher, "setConversation");

                // Run
                listener.setConversation(conversation);

                // Posttest
                expect(listener.publisher.setConversation).not.toHaveBeenCalled();
            });
        });

        describe("The _handleKeyPress() method", function() {
            it("Should send STARTED if input is non-empty", function() {
                spyOn(listener, "send");
                input.value = "fred";
                listener._handleKeyPress();
                jasmine.clock().tick(51);
                expect(listener.send).toHaveBeenCalledWith(layer.TypingIndicators.STARTED);
            });

            it("Should send FINISHED if input is empty", function() {
                spyOn(listener, "send");
                input.value = "";
                listener._handleKeyPress();
                jasmine.clock().tick(51);
                expect(listener.send).toHaveBeenCalledWith(layer.TypingIndicators.FINISHED);
            });

            it("Should call only once in 50ms", function() {
                spyOn(listener, "send");
                listener._handleKeyPress();
                listener._handleKeyPress();
                listener._handleKeyPress();
                listener._handleKeyPress();
                jasmine.clock().tick(51);
                expect(listener.send.calls.count()).toEqual(1);
                listener._handleKeyPress();
                jasmine.clock().tick(51);
                expect(listener.send.calls.count()).toEqual(2);
            });
        });

        describe("The _handleKeyDown() method", function() {
            beforeEach(function() {
                spyOn(listener, "_handleKeyPress");
            });

            it("Should respond to 8", function() {
                listener._handleKeyDown({keyCode: 8});
                expect(listener._handleKeyPress).toHaveBeenCalled();
            });

            it("Should respond to 13", function() {
                listener._handleKeyDown({keyCode: 13});
                expect(listener._handleKeyPress).toHaveBeenCalled();
            });

            it("Should respond to 46", function() {
                listener._handleKeyDown({keyCode: 46});
                expect(listener._handleKeyPress).toHaveBeenCalled();
            });

            it("Should ignore 45", function() {
                listener._handleKeyDown({keyCode: 45});
                expect(listener._handleKeyPress).not.toHaveBeenCalled();
            });
        });

        describe("The send() method", function() {
            it("Should call publisher.setState", function() {
                spyOn(listener.publisher, "setState");
                listener.send("fred");
                expect(listener.publisher.setState).toHaveBeenCalledWith("fred");
            });
        });
    });

    describe("The TypingPublisher class", function() {
        var publisher;

        beforeEach(function() {
            publisher = client.createTypingPublisher();
            publisher.setConversation(conversation);
        });

        afterEach(function() {
            publisher.destroy();
        });

        describe("The constructor() method", function() {
            it("Should have a clientId", function() {
                expect(publisher.clientId).toBe(client.appId);
            });

            it("Should start as FINISHED", function() {
                expect(publisher.state).toEqual(layer.TypingIndicators.FINISHED);
            });
        });

        describe("The setConversation() method", function() {
            it("Should update the conversation property", function() {
                publisher.setConversation(conversation);
                expect(publisher.conversation).toBe(conversation);
            });

            it("Should update the conversation property with an Object", function() {
                publisher.setConversation({id: conversation.id});
                expect(publisher.conversation).toBe(conversation);
            });

            it("Should update to null", function() {
                publisher.setConversation(null);
                expect(publisher.conversation).toBe(null);
            });

            it("Should call setState FINISHED on the old Conversation", function() {
                var hadConversation;
                spyOn(publisher, "setState").and.callFake(function() {
                    hadConversation = publisher.conversation;
                });
                var conversation2 = client.createConversation({participants: ["f"]});
                publisher.setConversation(conversation2);
                expect(publisher.setState).toHaveBeenCalledWith(layer.TypingIndicators.FINISHED);
                expect(hadConversation).not.toBe(conversation2);
            });

            it("Should end with a FINISHED state", function() {
                publisher.state = layer.TypingIndicators.STARTED;
                var conversation2 = client.createConversation({participants: ["f"]});
                publisher.setConversation(conversation2);
                expect(publisher.state).toEqual(layer.TypingIndicators.FINISHED);
            });
        });

        describe("The setState() method", function() {

            it("Should do nothing if state changed but no conversation", function() {
                publisher.state = layer.TypingIndicators.PAUSED;
                publisher.conversation = null;
                spyOn(publisher, "_send");
                spyOn(publisher, "_scheduleNextMessage");
                spyOn(publisher, "_startPauseLoop");

                // Run
                publisher.setState(layer.TypingIndicators.STARTED);

                // Posttest
                expect(publisher._send).not.toHaveBeenCalled();
                expect(publisher._scheduleNextMessage).not.toHaveBeenCalled();
                expect(publisher._startPauseLoop).not.toHaveBeenCalled();
            });

            it("Should schedule state to be resent if no state change and last send call was recent", function() {
                publisher.state = layer.TypingIndicators.PAUSED;
                publisher.conversation = conversation;
                publisher._lastMessageTime = Date.now() - 500;
                spyOn(publisher, "_scheduleNextMessage");
                spyOn(publisher, "_send");
                spyOn(publisher, "_startPauseLoop");

                // Run
                publisher.setState(layer.TypingIndicators.PAUSED);

                // Posttest
                expect(publisher._send).not.toHaveBeenCalled();
                expect(publisher._scheduleNextMessage).toHaveBeenCalledWith(layer.TypingIndicators.PAUSED);
                expect(publisher._startPauseLoop).toHaveBeenCalled();
            });

            it("Should call _send if no state change and last send call was old", function() {
                publisher.state = layer.TypingIndicators.PAUSED;
                publisher.conversation = conversation;
                publisher._lastMessageTime = Date.now() - 50000;
                spyOn(publisher, "_scheduleNextMessage");
                spyOn(publisher, "_startPauseLoop");
                spyOn(publisher, "_send");

                // Run
                publisher.setState(layer.TypingIndicators.PAUSED);

                // Posttest
                expect(publisher._send).toHaveBeenCalledWith(layer.TypingIndicators.PAUSED);
                expect(publisher._scheduleNextMessage).not.toHaveBeenCalled();
                expect(publisher._startPauseLoop).toHaveBeenCalled();
            });

            it("Should do nothing if no state change and last send call was old but state is FINISHED", function() {
                publisher.state = layer.TypingIndicators.FINISHED;
                publisher.conversation = conversation;
                publisher._lastMessageTime = Date.now() - 50000;
                spyOn(publisher, "_scheduleNextMessage");
                spyOn(publisher, "_send");
                spyOn(publisher, "_startPauseLoop");

                // Run
                publisher.setState(layer.TypingIndicators.FINISHED);

                // Posttest
                expect(publisher._send).not.toHaveBeenCalled();
                expect(publisher._scheduleNextMessage).not.toHaveBeenCalled();
                expect(publisher._startPauseLoop).not.toHaveBeenCalled();
            });

            it("Should clear the old pause loop", function() {
                publisher._pauseLoopId = 500;
                publisher.state = layer.TypingIndicators.PAUSED;

                // Run
                publisher.setState(layer.TypingIndicators.PAUSED);

                // Posttest
                expect(publisher._pauseLoopId).not.toEqual(500);
                expect(publisher._pauseLoopId).not.toEqual(0);
            });
        });

        describe("The _startPauseLoop() method", function() {
            it("Should degrade a STARTED state to PAUSED after sufficient delay", function() {
                publisher.state = layer.TypingIndicators.STARTED;
                spyOn(publisher, "setState");

                // Run
                publisher._startPauseLoop();

                // Midtest
                expect(publisher.setState).not.toHaveBeenCalled();
                jasmine.clock().tick(2000);
                expect(publisher.setState).not.toHaveBeenCalled();

                // Posttest
                jasmine.clock().tick(1000);
                expect(publisher.setState).toHaveBeenCalledWith(layer.TypingIndicators.PAUSED);
            });

            it("Should degrade a PAUSED state to FINISHED after sufficient delay", function() {
                publisher.state = layer.TypingIndicators.PAUSED;
                spyOn(publisher, "setState");

                // Run
                publisher._startPauseLoop();

                // Midtest
                expect(publisher.setState).not.toHaveBeenCalled();
                jasmine.clock().tick(2000);
                expect(publisher.setState).not.toHaveBeenCalled();

                // Posttest
                jasmine.clock().tick(1000);
                expect(publisher.setState).toHaveBeenCalledWith(layer.TypingIndicators.FINISHED);
            });
        });

        describe("The _scheduleNextMessage() method", function() {

            it("Should set a delay that is 2500 after last message sent and then send the message take 1", function() {
                publisher._lastMessageTime = Date.now();
                publisher.state = layer.TypingIndicators.STARTED;
                spyOn(publisher, "_send");

                // Run
                publisher._scheduleNextMessage(layer.TypingIndicators.STARTED);
                jasmine.clock().tick(2498);

                expect(publisher._send).not.toHaveBeenCalled();
                jasmine.clock().tick(5);

                // Posttest
                expect(publisher._send).toHaveBeenCalledWith(layer.TypingIndicators.STARTED);
            });

            it("Should set a delay that is 2500 after last message sent and then send the message take 2", function() {
                publisher._lastMessageTime = Date.now() - 2000;
                publisher.state = layer.TypingIndicators.STARTED;
                spyOn(publisher, "_send");

                // Run
                publisher._scheduleNextMessage(layer.TypingIndicators.STARTED);
                jasmine.clock().tick(498);
                expect(publisher._send).not.toHaveBeenCalled();
                jasmine.clock().tick(5);

                // Posttest
                expect(publisher._send).toHaveBeenCalledWith(layer.TypingIndicators.STARTED);
            });

            it("Should set a delay that is 2500 after last message sent and then send the message take 3", function() {
                publisher._lastMessageTime = Date.now() - 2400;
                publisher.state = layer.TypingIndicators.STARTED;
                spyOn(publisher, "_send");

                // Run
                publisher._scheduleNextMessage(layer.TypingIndicators.STARTED);
                jasmine.clock().tick(98);
                expect(publisher._send).not.toHaveBeenCalled();
                jasmine.clock().tick(5);

                // Posttest
                expect(publisher._send).toHaveBeenCalledWith(layer.TypingIndicators.STARTED);
            });

            it("Should do nothing if the states no longer match", function() {
                publisher._lastMessageTime = Date.now();
                publisher.state = layer.TypingIndicators.STARTED;
                spyOn(publisher, "_send");

                // Run
                publisher._scheduleNextMessage(layer.TypingIndicators.PAUSED);
                jasmine.clock().tick(2501);

                // Posttest
                expect(publisher._send).not.toHaveBeenCalled();
            });

            it("Should cancel any existing scheduled sends", function() {
                publisher._lastMessageTime = Date.now();
                publisher.state = layer.TypingIndicators.STARTED;
                spyOn(publisher, "_send");

                // Run
                publisher._scheduleNextMessage(layer.TypingIndicators.STARTED);
                jasmine.clock().tick(2000);
                jasmine.clock().mockDate(new Date(Date.now() + 2000));

                publisher._scheduleNextMessage(layer.TypingIndicators.STARTED);
                jasmine.clock().tick(601);

                // Posttest
                expect(publisher._send).toHaveBeenCalledWith(layer.TypingIndicators.STARTED);
                expect(publisher._send.calls.count()).toEqual(1);
            });
        });

        describe("The _send() method", function() {
            beforeEach(function() {
                client.socketManager._socket = {
                    send: jasmine.createSpy('send'),
                    removeEventListener: function() {},
                    close: function() {},
                    readyState: typeof WebSocket != "undefined" ? WebSocket.OPEN : 1
                };
            });

            it("Should send a message if there is a valid conversation, and open websocket", function() {
                publisher._send(layer.TypingIndicators.STARTED);
                expect(client.socketManager._socket.send).toHaveBeenCalledWith(JSON.stringify({
                    'type': 'signal',
                    'body': {
                      'type': 'typing_indicator',
                      'object': {
                        'id': conversation.id,
                      },
                      'data': {
                        'action': layer.TypingIndicators.STARTED,
                      }
                    }
                }));
            });

            it("Should do nothing for a temp id", function() {
                publisher.conversation = client.createConversation({participants: ["abc"]});
                publisher._send(layer.TypingIndicators.STARTED);
                expect(client.socketManager._socket.send).not.toHaveBeenCalled();
            });
        });

        describe("The destroy() method", function() {
            it("Should cancel any _scheduleId tasks", function() {
                publisher._scheduleNextMessage(layer.TypingIndicators.STARTED);
                spyOn(publisher, "_send");
                publisher.destroy();
                jasmine.clock().tick(5001);
                expect(publisher._send).not.toHaveBeenCalled();
            });

            it("Should cancel any _pauseLoopId tasks", function() {
                publisher.setState(layer.TypingIndicators.STARTED);
                spyOn(publisher, "setState");
                publisher.destroy();
                jasmine.clock().tick(5001);
                expect(publisher.setState).not.toHaveBeenCalled();

            });

        });
    });
});
