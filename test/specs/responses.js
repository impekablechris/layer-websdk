/* eslint-disable no-undef */
var messageTemplate = {
    "id": "layer:///messages/940de862-3c96-11e4-baad-164230d1df67",
    "url": "http://localhost:9753/messages/940de862-3c96-11e4-baad-164230d1df67",
    "position": 15032697020,
    "conversation": {
        "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
        "url": "http://localhost:9753/conversations/f3cc7b32-3c92-11e4-baad-164230d1df67"
    },
    "parts": [
        {
            "id": "layer:///messages/940de862-3c96-11e4-baad-164230d1df67/parts/0",
            "mime_type": "text/plain",
            "body": "This is the message.",
            "size": 20
        },
        {
            "id": "layer:///messages/940de862-3c96-11e4-baad-164230d1df67/parts/1",
            "mime_type": "image/png",
            "content": {
                download_url: "https://storage.googleapis.com/content-prod1/9ec30af8-5591-11e4-af9e-f7a201004a3b/9326d2b7-e34a-4659-a1d9-656290e7a346/ade53880-e00f-11e5-b2ae-0242ac110090?GoogleAccessId=562313368749-gcg5vvavqprdhpnp8udipdnablc4o3hp@developer.gserviceaccount.com&Expires=1456882972&Signature=R3mnrP9OC4uCgKcZf62afC%2BTS1oLLdBs6BC0rTZc2sK8ohaczs9qkzd55xK%2BKaqSc%2FDW%2FNmXDJJs4aM0Pl3BfEI8G7ds%2BkQ3%2F4Bo6kcKavcdVVIO1cEsnI2m4JCPicQUflAlFM7H1wYbLqN%2B3dug0eL1QOin5uDqmnNbDXqKt1w%3D",
                expiration: "2016-03-02T01:42:52.290Z",
                id: "layer:///content/ade53880-e00f-11e5-b2ae-0242ac110090",
                refresh_url: "https://api.layer.com/content/ade53880-e00f-11e5-b2ae-0242ac110090",
                size: 95602,
                upload_url: null
            }
        }
    ],
    "sent_at": "2014-09-09T04:44:47+00:00",
    "sender": {
        "user_id": "12345",
        "display_name": "One through Five",
        "id": "layer:///identities/12345",
        "url": "http://localhost:9753/identities/12345"
    },
    "is_unread": true,
    "recipient_status": {
        "layer:///identities/777": "sent",
        "layer:///identities/999": "read",
        "layer:///identities/111": "delivered"
    }
};
var sampleMessage1 = JSON.parse(JSON.stringify(messageTemplate));
var sampleMessage2 = JSON.parse(JSON.stringify(messageTemplate));
var sampleMessage3 = JSON.parse(JSON.stringify(messageTemplate));
sampleMessage2.id += "2";
sampleMessage2.parts.forEach(function(part) {part.id = part.id.replace(/\/parts/, "2/parts")});
sampleMessage3.id += "3";
sampleMessage3.parts.forEach(function(part) {part.id = part.id.replace(/\/parts/, "3/parts")});

sampleMessage2.parts[0].body += "2";
sampleMessage3.parts[0].body += "3";
sampleMessage2.recipient_status["layer:///identities/777"] = "delivered";
sampleMessage3.recipient_status["layer:///identities/777"] = "read";
responses = {
    error1: {
        "message": "Body cannot be blank.",
        "data": {
            "property": "body"
        },
        "type": "missing",
        "code": 401,
        "id": "you-are-frelled",
        "url": "http://localhost:9753"
    },

    conversation1: {
        "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
        "url": "http://localhost:9753/conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
        "created_at": "2014-09-15T04:44:47+00:00",
        "last_message": sampleMessage1,
        "participants": [
            {user_id: "1234", id: "layer:///identities/1234", url: "http://localhost:9753/identities/1234", display_name: "one two three four", avatar_url: ""},
            {user_id: "5678", id: "layer:///identities/5678", url: "http://localhost:9753/identities/5678", display_name: "five six seven eight", avatar_url: ""},
        ],
        "distinct": true,
        "unread_message_count": 3,
        "metadata": {
            "favorite": "true",
            "background_color": "#3c3c3c"
        }
    },
    conversation2: {
        "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df68",
        "url": "http://localhost:9753/conversations/f3cc7b32-3c92-11e4-baad-164230d1df68",
        "created_at": "2014-09-15T04:44:47+00:00",
        "last_message": sampleMessage2,
        "participants": [
            {user_id: "777", id: "layer:///identities/777", url: "http://localhost:9753/identities/777", display_name: "Sevens", avatar_url: ""},
            {user_id: "999", id: "layer:///identities/999", url: "http://localhost:9753/identities/999", display_name: "Nines", avatar_url: ""},
            {user_id: "111", id: "layer:///identities/111", url: "http://localhost:9753/identities/111", display_name: "Ones", avatar_url: ""},
        ],
        "distinct": true,
        "unread_message_count": 3,
        "metadata": {
            "favorite": "true",
            "background_color": "#3c3c3c"
        }
    },
    channel1: {
        "id": "layer:///channels/f3cc7b32-3c92-11e4-baad-164230d1df68",
        "url": "http://localhost:9753/channels/f3cc7b32-3c92-11e4-baad-164230d1df68",
        "created_at": "2014-09-15T04:44:47+00:00",
        "name": "just a channel",
        "metadata": {
            "favorite": "true",
            "background_color": "#3c3c3c"
        },
        "membership": {
            "is_member": true
        }
    },
    channel2: {
        "id": "layer:///channels/f3cc7b32-3c92-11e4-baad-164230d1df33",
        "url": "http://localhost:9753/channels/f3cc7b32-3c92-11e4-baad-164230d1df33",
        "created_at": "2014-09-15T04:44:47+00:00",
        "name": "another a channel",
        "metadata": {
            "favorite": "false",
            "background_color": "#3c3c3c"
        },
        "membership": {
            "is_member": true
        }
    },
    message1: sampleMessage2,
    message2: sampleMessage3,
    announcement: {
       "id": "layer:///announcements/b40de862-3c96-11e4-baad-164230d1df67",
      "url": "http://localhost:9753/announcements/b40de862-3c96-11e4-baad-164230d1df67",
      "position": 15032697020,
      "parts": [
          {
              "id": "layer:///announcements/b40de862-3c96-11e4-baad-164230d1df67/parts/0",
              "mime_type": "text/plain",
              "body": "This is the message.",
              "size": 20
          }
      ],
      "sent_at": "2014-09-09T04:44:47+00:00",
      "sender": {
        "user_id": "admin",
        "display_name": "Lord Master the Admin",
        "id": "layer:///identities/admin",
        "url": "http://localhost:9753/identities/admin"
      },
      "is_unread": true,
      "recipient_status": {
          "layer:///identities/777": "sent"
      }
    },
    useridentity: {
        id: "layer:///identities/frodo-the-dodo",
        user_id: "frodo-the-dodo",
        display_name: "Frodo The Dodo",
        first_name: "Frodo",
        last_name: "Dodo",
        metadata: {}
    },
    membership1: {
        "id": "layer:///channels/f3cc7b32-3c92-11e4-baad-164230d1df68/members/FrodoTheDodo",
        "url": "http://localhost:9753/channels/f3cc7b32-3c92-11e4-baad-164230d1df68/members/FrodoTheDodo",
        "channel": {
            "id": "layer:///channels/f3cc7b32-3c92-11e4-baad-164230d1df68",
            "url": "https://api.layer.com/channels/f3cc7b32-3c92-11e4-baad-164230d1df68",
            "name": "Channel Name"
        },
        "identity": {
            "id": "layer:///identities/FrodoTheDodo",
            "url": "https://api.layer.com/identities/FrodoTheDodo",
            "display_name": "Frodo is a Dodo",
            "first_name": "Frodo",
            "last_name": "Dodo"
        },
        "role": "user",
        "joined_at": "2014-09-15T04:44:47+00:00"
    },
    membership2: {
        "id": "layer:///channels/uuid/members/user_id2",
        "url": "https://api.layer.com/channels/uuid/members/user_id2",
        "channel": {
            "id": "layer:///channels/f3cc7b32-3c92-11e4-baad-164230d1df68",
            "url": "https://api.layer.com/channels/f3cc7b32-3c92-11e4-baad-164230d1df68",
            "name": "Channel Name"
        },
        "identity": {
            "id": "layer:///identities/FrodoTheDodo2",
            "url": "https://api.layer.com/identities/FrodoTheDodo2",
            "display_name": "Frodo is a Dodo2",
            "first_name": "Frodo2",
            "last_name": "Dodo2"
        },
        "role": "user",
        "joined_at": "2014-09-15T04:44:47+00:00"
    }
};

var mostRecentEqualityTest =  function(a, b) {
    if (a && a.constructor.toString().match(/FakeXMLHttpRequest\(\)/)) {
        if (a.url != b.url) {
            debugger;
            return false;
        }
        if (b.data && a.params != JSON.stringify(b.data)) {
            debugger;
            return false;
        }
        var ha = JSON.parse(JSON.stringify(a.requestHeaders));
        var hb = b.headers || b.requestHeaders;
        if (!hb.accept) delete ha.accept;
        if (hb && !compareObj(ha, hb)) {
            debugger;
            return false;
        }
        if (b.method && a.method != b.method) {
            debugger;
            return false;
        }
        return true;
    }
};

var compareObj = function(a, b) {
    var aKeys = Object.keys(a).sort();
    var bKeys = Object.keys(b).sort();
    if (aKeys.join(",") != bKeys.join(",")) return false;
    var aObj = {}, bObj = {};
    aKeys.forEach(function(k) { aObj[k] = a[k];});
    bKeys.forEach(function(k) { bObj[k] = b[k];});
    return JSON.stringify(aObj) == JSON.stringify(bObj);
}

var responseTest =  function(a, b) {
        if (a instanceof layer.LayerError && b instanceof layer.LayerError) {
            if (a.code != b.code) {
                debugger;
                return false;
            }
            if (a.httpStatus != b.httpStatus) {
                debugger;
                return false;
            }
            if (a.errType != b.errType) {
                debugger;
                return false;
            }
            if (b.message instanceof RegExp) {
                if (!b.message.test(a.message)) {
                    debugger;
                    return false;
                }
            } else if (b.message) {
                if (a.message != b.message) {
                    debugger;
                    return false;
                }
            } else {
                if (!a.message) {
                    debugger;
                    return false;
                }
            }
            if (b.url instanceof RegExp) {
                if (!b.url.test(a.url)) {
                    debugger;
                    return false;
                }
            } else if (b.url) {
                if (a.url != b.url) {
                    debugger;
                    return false;
                }
            } else {
                if (!a.url.match(/http\:\/\/.+/)) {
                    debugger;
                    return false;
                }
            }
            if (b.data && JSON.stringify(a.data) != JSON.stringify(b.data)) {
                debugger;
                return false;
            }

            return true;
        }
};

var isDbEnabled = undefined;
var testDbEnabled = function(callback) {
    if (isDbEnabled !== undefined) return callback(isDbEnabled);
    var db;
    function deleteTables(callback) {
        try {
            var request = window.indexedDB.deleteDatabase('layer-test');
            request.onsuccess = request.onerror = callback;
        } catch(e) {
            callback();
        }
    }

    function createTable(callback) {
        const request = window.indexedDB.open('layer-test', 1);
        request.onupgradeneeded = function(evt) {
            db = evt.target.result;
            try {
                const store = db.createObjectStore('test-table', { keyPath: 'id' });
                store.createIndex('my-index', ['a', 'b'], { unique: false });
                store.transaction.oncomplete = callback;
            } catch (e) {
                callback();
            }
        }
    }

    function queryTable(callback) {
        try {
            const query = window.IDBKeyRange.bound(['', 0], ['', 1000]);
            var trans = db.transaction(['test-table'], 'readonly');
            trans.objectStore('test-table')
            .index('my-index')
            .openCursor(query, 'prev')
            .onsuccess = function(evt) {
                callback(true);
            };
            trans.onerror = function(evt) {
                callback(false);
            }
        } catch(e) {
            callback(false);
        }
    }

    deleteTables(function() {
        createTable(function() {
            queryTable(function(result) {
                isDbEnabled = result;
                callback(result);
            });
        });
    });
};