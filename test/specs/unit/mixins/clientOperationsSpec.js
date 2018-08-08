/*eslint-disable */
// TODO: All tests should be run with both isTrustedDevice = true and false
describe("The Client Operations Mixin", function() {
    var appId = "Fred's App";
    var userId = "93c83ec4-b508-4a60-8550-099f9c42ec1a";
    var identityToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImN0eSI6ImxheWVyLWVpdDt2PTEiLCJraWQiOiIyOWUzN2ZhZS02MDdlLTExZTQtYTQ2OS00MTBiMDAwMDAyZjgifQ.eyJpc3MiOiI4YmY1MTQ2MC02MDY5LTExZTQtODhkYi00MTBiMDAwMDAwZTYiLCJwcm4iOiI5M2M4M2VjNC1iNTA4LTRhNjAtODU1MC0wOTlmOWM0MmVjMWEiLCJpYXQiOjE0MTcwMjU0NTQsImV4cCI6MTQxODIzNTA1NCwibmNlIjoiRFZPVFZzcDk0ZU9lNUNzZDdmaWVlWFBvUXB3RDl5SjRpQ0EvVHJSMUVJT25BSEdTcE5Mcno0Yk9YbEN2VDVkWVdEdy9zU1EreVBkZmEydVlBekgrNmc9PSJ9.LlylqnfgK5nhn6KEsitJMsjfayvAJUfAb33wuoCaNChsiRXRtT4Ws_mYHlgwofVGIXKYrRf4be9Cw1qBKNmrxr0er5a8fxIN92kbL-DlRAAg32clfZ_MxOfblze0DHszvjWBrI7F-cqs3irRi5NbrSQxeLZIiGQdBCn8Qn5Zv9s";
    var cid1 = "layer:///conversations/test1",
        cid2 = "layer:///conversations/test2",
        cid3 = "layer:///conversations/test3",
        url1 = "http://localhost:9753/conversations/test1",
        url2 = "http://localhost:9753/conversations/test2",
        url3 = "http://localhost:9753/conversations/test3";
    var client, requests, userIdentity2;

    beforeEach(function() {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        jasmine.addCustomEqualityTester(mostRecentEqualityTest);
        jasmine.addCustomEqualityTester(responseTest);

        client = new layer.Client({
            appId: appId,
            url: "http://localhost:9753"
        });
        client.sessionToken = "sessionToken";

        client.user = userIdentity = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/Frodo",
            displayName: "Frodo",
            userId: "Frodo"
        });

        userIdentity2 = new layer.Identity({
            clientId: client.appId,
            id: "layer:///identities/1",
            displayName: "UserIdentity",
            userId: '1'
        });

        client.isTrustedDevice = true;

        client._clientAuthenticated();
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            callback([]);
        });
        spyOn(client.dbManager, "getObject").and.callFake(function(tableName, ids, callback) {
            callback(null);
        });
        client._clientReady();
    });

    afterEach(function() {
        client.destroy();
        jasmine.clock().uninstall();
        jasmine.Ajax.uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The _handleMarkAllReadOperation() method", function() {
        var c1, c2, c3, m1, m2, m3, m4, m5;
        beforeEach(function() {
            c1 = client.createConversation({participants:[], distinct: false});
            c2 = client.createConversation({participants:[], distinct: false});
            c3 = client.createConversation({participants:[], distinct: false});
            m1 = c1.createMessage("m1");
            m2 = c1.createMessage("m2");
            m3 = c1.createMessage("m3");
            m4 = c2.createMessage("m4");
            m5 = c2.createMessage("m5");
            [m1, m2, m3, m4, m5].forEach((m, index) => {
                m.sender = userIdentity2;
                m.position = index + 1;
                m.isRead = false;
                m.recipientStatus = {};
                m.recipientStatus[userIdentity2.id] = 'delivered';
                m.recipientStatus[client.user.id] = 'delivered';
                client._addMessage(m)
            });
            m4.position = m5.position = 1;
        });

        it("Should be called on getting a mark_all_read event", function() {
            spyOn(client, "_handleMarkAllReadOperation");

            // run
            client.trigger('websocket:operation', {
                data: {
                    method: 'Conversation.mark_all_read',
                    data: {hey: 'ho'}
                }
            });

            // Posttest
            expect(client._handleMarkAllReadOperation).toHaveBeenCalledWith({
                method: 'Conversation.mark_all_read',
                data: {hey: 'ho'}
            });
        });

        it("Should find all messages in the same conversation and update isRead if event comes from self", function() {
            client._handleMarkAllReadOperation({
                method: 'blah',
                object: {id: c1.id},
                data: {
                    position: 2,
                    identity: {id: client.user.id}
                }
            });
            expect(m1.position <= 2).toBe(true);
            expect(m1.isRead).toBe(true);

            expect(m2.position <= 2).toBe(true);
            expect(m2.isRead).toBe(true);

            expect(m3.position <= 2).not.toBe(true);
            expect(m3.isRead).not.toBe(true);

            expect(m4.isRead).toBe(false);
            expect(m5.isRead).toBe(false);
        });

        it("Should find all messages in the same conversation and update recipientStatus if event comes from others", function() {
            client._handleMarkAllReadOperation({
                method: 'blah',
                object: {id: c1.id},
                data: {
                    position: 2,
                    identity: {id: userIdentity2.id}
                }
            });
            expect(m1.position <= 2).toBe(true);
            expect(m1.recipientStatus[userIdentity2.id]).toEqual('read');

            expect(m2.position <= 2).toBe(true);
            expect(m2.recipientStatus[userIdentity2.id]).toEqual('read');

            expect(m3.position <= 2).not.toBe(true);
            expect(m3.recipientStatus[userIdentity2.id]).not.toEqual('read');

            expect(m4.recipientStatus[userIdentity2.id]).not.toEqual('read');
            expect(m5.recipientStatus[userIdentity2.id]).not.toEqual('read');
        });

        it("Should call __updateRecipientStatus when making changes to messages from others", function() {
            spyOn(m1, '__updateRecipientStatus');
            spyOn(m2, '__updateRecipientStatus');
            spyOn(m3, '__updateRecipientStatus');
            client._handleMarkAllReadOperation({
                method: 'blah',
                object: {id: c1.id},
                data: {
                    position: 2,
                    identity: {id: userIdentity2.id}
                }
            });
            expect(m1.__updateRecipientStatus).toHaveBeenCalled();
            expect(m2.__updateRecipientStatus).toHaveBeenCalled();
            expect(m3.__updateRecipientStatus).not.toHaveBeenCalled();
        });
    });
});
