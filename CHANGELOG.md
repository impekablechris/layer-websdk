# Web SDK Change Log

## 3.4.16

Failure to replay missed events when reconnecting the websocket will no longer start a retry loop.  If it fails, the client will get missed events the next time the query refires rather than as a live update.  This behavior can be changed back to older behavior by setting the SocketManager's static property:

```javascript
layer.Websockets.SocketManager.ENABLE_REPLAY_RETRIES = true;
```


## 3.4.15

* Address issue where websocket packets arrive out of order, and result in resync calls

## 3.4.14

* Fixes bug in support for `isPersistenceEnabled` that causes Messages not to be read correctly from IndexedDB

## 3.4.13

* Adds a `client.disconnect()` method that closes the websocket connection, and stops pinging to see if Layer's servers are reachable
* Adds a `client.reconnect()` method that restores services after a `client.disconnect()` call

## 3.4.12

Updates recovery and network detection code:

* Online Detection now makes a final ping to the server before declaring client to be offline; previously did the ping after going offline; going back online short circuited the 10 minute reconnect logic on websockets
* Websocket reconnect logic now uses exponential backoff until it hits between 8-12 minutes between retry; primarily to handle case of 429, 503 and other server problem
* IE11 test environment now chokes on unit tests against https://huh.com; also https://localhost; updates now support tests against http://localhost

## 3.4.11

Fixes Websocket reconnect logic that results in a reconnect every 10 minutes.

## 3.4.10

Changes exponential backoff jitter to vary more widely

## 3.4.9

Exponential backoff for websocket reconnects changed from a max of 30 seconds delay to a max of 10 minutes delay.

## 3.4.8

Better tracking of requests:

* REST API requests and Websocket connections now identify the version and TabID of the request
* TabID differentiates between different browser tabs (or reloads of the page) vs just reconnects from the same client

## 3.4.7

Fixes aimed at websocket stability:

* Changes exponential backoff for websocket reconnect and Replaying of missed events to start at a higher interval
* Adds client events for debugging:
  * websocket:connecting
  * websocket:disconnecting
  * websocket:replaying-events
  * websocket:scheduling-reconnect
  * websocket:schedule-reconnect
  * websocket:ignore-skipped-counter
* If multiple anomolies in a websocket connection will not attempt recovery until frequency of such errors is less than once per minute

## 3.4.6

* Fixes missed case for release `v3.4.5`

## 3.4.5

* Fixes bug in `Identity.metadata`; this is now _always_ an Object even when there is no metadata

## 3.4.4

* Fixes mismatch between Identity ID and User ID when User ID contains a `*` character

## 3.4.3

* Fixes mismatch between Identity ID and User ID when User ID contains a `~` character and auth uses `connectWithSession`

## 3.4.2

* Fixes mismatch between Identity ID and User ID when User ID contains a `~` character

## 3.4.1

* Conversations are no longer garbage collected if not referenced by a Query
* Changes Garbage Collection delay on Messages from 10 minutes to 2 hours (configurable)
* Adds `Conversation.totalMessageCount` property

## 3.4.0

* Adds markAllMessagesAsRead operation
* Calling connect when already connected is a no-op and has no effect
* Eliminates unnecessary change events from Identity that may cause the Conversation Query to generate excessive numbers of events
* Fixes bug in React Native where `atob` was `undefined`
* If the server redefines the Message Part `body`, the new body is stored and change events are triggered

## 3.3.5

* Fixes special case where websocket is CONNECTING but not yet OPEN that causes a second websocket to be openned

## 3.3.4

* Rips out Buffer and base64url decoder and fixes original decoder snippet

## 3.3.3

* Fixes bug in decoding Identity ID #156
* Fixes bug in missing Buffer object for react native #158
* Fixes bug where query.pagedToEnd is false when there is no data to load

## 3.3.2

* Fixes error when using jsuglify with `drop_console=true` #138
* Fixes `Client ignored identities:loaded-error` bug; this event now works as expected
* Adds handling for failure to upload Rich Content; now triggers `messages:sent-error` events due to this error preventing messages from being sent.

## 3.3.1

* Replaces base64url decoder with `base64url` npm package
* Removes Query Sync loop due to changes in server architecture
* Fixes ping operation to no longer log errors when the user is not authenticated
* Minor tweaks to timing around recovery and retry for reaching Layer Servers

## 3.3.0

* Adds telemetry for tracking performance numbers and usage.  Does not collect content or personally identifiable information.
* Fixes bug where deleting the last message in a conversation fails to provide a suitable position for the next message
* Adds a `client.syncManager` event `sync:error-will-retry` for apps that want to be notified when a request has failed, and a retry has been scheduled.  Contains a `retryCount` to help track how many retries have been performed.
* Fixes issue where repeated websocket failure causes client to switch to offline and stop retrying
* Adjustments made to exponential backoff, keeping maximum delays between retries to under one minute.

## 3.2.3

* Changes to MessagePart `body` or `mimeType` will now trigger `messageparts:change` events on the part
* Messages now listen for their MessagePart's events, and trigger `messages:change` events any time a part is changed
* Events triggered when a MessagePart finishes loading its RichContent has changed to align with this:
  * BEFORE: a `messages:change` event was triggered with `property: 'parts'` and oldValue/newValue of the change event simply refering to the `parts` array
  * AFTER: a `messages:change` event is triggered with `property: 'parts.body'`, and oldValue/newValue of
    the `body` property from before and after
* If building a React Native project, one can now use `import from 'layer-websdk/index-react-native'` for a react-native safe version.
  * NOTE: some services, like sending of files are not yet supported

Scenario:

```javacript
message.presend();
message.parts[0].body = "hello";
```

The above code will do a `presend()` which will let any appropriate Query add this unsent message to its results, and the
Query will trigger change events to allow for rerendering any time the `body` property is updated.

## 3.2.2

* Adds `layer.Client.addListenerForNewClient(callback)` allowing code to register to receive the `layer.Client` once its created
* Calling `getMessage(id, true)`, `getConversation(id, true)`, etc... will no longer throw an error if the client is not yet authenticated/ready.  It will instead wait for authentication to complete, and then load the requested resource.

## 3.2.1

* Conversation Queries now trigger change events when Conversation participants have changes

## 3.2.0

* Breaking Change (impacts few apps)
  * On destroying a Query, it was triggering `change:data`; now it triggeres `change:reset`
  * layer.SocketManager.replayEvents is now a private method; use layer.SocketManager.resync instead.

* New Features:
  * Adds `presence` property to Identity objects
    * `identities:change` events are triggered whenever `presence.status` or `presense.lastSeenAt` changes.
    * `layer.Client.isPresenceEnabled` is a new property that defaults to `true`; initialize your client with `false`
      if presence is not something your user wants to expose.
  * Adds Channels (Note: This feature is in preview mode and not ready for production applications)
    * Channel instance is `layer.Channel`
    * Channels are queried using `model: layer.Query.Channel`
    * Channels have `layer.Membership` objects representing members of the channel.
    * Members are queried using `model: layer.Query.Membership`
  * Adds `layer.Message.presend()` which allows a message that hasn't yet been sent to be added to Query results and rendered
    in a Message List driven by that Query.
* Fixes/Changes:
  * Challenge events will now be triggered any time your authentication has expired and your client's internet connection is restored.  Prevent this by calling `client.logout()`.
  * Better support for clients to reissue a `challenge` more than one time.
  * Identity change events now trigger when receiving changes via websocket
  * Prevents websocket server pings from thrashing multiple times per second
  * Fixes error where `conversation.lastMessage` was reset
  * Updates `query.totalSize` prior to triggering change events
  * Unit tests no longer choke on browsers that reject dual key indexedDB tables
  * layer.Websockets.RequestManager's `sendRequest` method now has only a single options argument
  * if authentication expires/terminates, promptly resets `client.isAuthenticated` and `client.isConnected`
  * You can now create a conversation with no participants
  * `client.getXXX(id)` methods now mostly support UUID or full Layer ID as a parameter
  * `client.connectWithSession` fixes allow it to be called to reauthenticate a Client
  * Query fixes:
    * Limits number of retries on a conversation that the server says is syncing
    * Queries retry if auth fails and is re-established
    * On destroying a Query, it was triggering `change:data`; now it triggeres `change:reset`
    * Events that report on items added to the array have fixes to the `index` field of the event



## 3.1.1

* No noteworthy changes

## 3.1.0

* Removes the `layer.Client` plugin system which was unused
* Refactoring of how Client adds management of additional resources
* Renaming/file moving for all model classes
* Refactoring of how Queries for each additional resources are handled.
* Refactors retry logic and ping logic; adds debug info to ping requests
* Refactors Messages to allow subclassing; add `layer.Message.ConversationMessage` class for use within Conversations

## 3.0.3

* Adds a `defer` function that defers execution without using `setTimeout` but uses a `setTimeout` fallback.
* Fixes the `move` event for `layer.Query`.

## 3.0.2

* Fixes error in `npm publish`

## 3.0.1

* Fixes to issue that caused fast infinite retry loop.
* Fixes to Conversation Query that correctly ignores results
  from out-of-date requests.

## 3.0.0

### Major new Feature

* Identities
  * Layer now supports an Identity object, represented here as a `layer.Identity` class containing a User ID, Identity ID, Display Name and an Avatar URL.
  * Message sender is now represented using an Identity Object
  * Conversation participants is now an array of Identity Objects
  * Identities can be queried to find all of the users that the authenticated user is following.
    * A user is "followed" by your user if they have either been in a conversation together, or a `followIdentity` request has been issued for that user.
  * layer.Client.user is now an Identity representing the authenticated user
  * Persistence supports Identities

Identities can be created in two ways:

1. When your server creates an Identity Token during authentication, it can specify the `display_name` and `avatar_url` for your user.  This will create and/up update any Identity object managed by Layer's servers.
2. Layer's Server API has operations for creating and updating Identity objects

For more information, see https://docs.layer.com/reference/server_api/identities.out

### Breaking Changes

#### 1. Conversation.participants

Any code that iterates over the `participants` property of a Conversation, looking at each User ID will find that these are no longer User IDs.  They are Identity objects.  You can get the User IDs as follows:

```javascript
var userIds = conversation.participants.map(function(identity) {
  return identity.userId;
});
```

But perhaps what you really want are display names for these users:

```javascript
var displayNames = conversation.participants.map(function(identity) {
  return identity.displayName;
});
```

#### 2. User IDs vs Identity IDs

While WebSDK APIs continue to accept User IDs and translate them to Identity IDs, its recommended that Identity IDs be used rather than User IDs.  An Identity ID can be derived from a User ID using:

```javascript
var identityId = 'layer:///identities/' + encodeURIComponent(userId);
```

Anyone looking to talk directly to the server using the Client API will need to change to Identity IDs.

### Minor Changes and fixes

* Queries on Messages where the server reports that the server is still syncing no longer fires `server-syncing-state` events, and no longer
  changes `isFiring` to `false` between polling the server to see if its done.  Instead it keeps `isFiring` as `true` and fire no events and
  provides no results _until_ the server has completed and provided some data.
* Persistence
  * Optimizations and fewer errors logged for IndexedDB write operations
  * Fixes handling of Private windows for Safari and Firefox
  * Fixes handling of downgrading to older WebSDK version
  * Persisting the Session Token if `isTrustedDevice` is `true` should now work more reliably.
  * IndexedDB should no longer persist locally created objects if the object was rejected by the server.
  * Users no longer get individual databases; there is only a single database and wipes all data from prior user on logging in as new user.
  * Fixes IndexedDB issue where on creating a Distinct Conversation, if the server returns a new object with a new ID, the locally persisted Conversation didn't get purged and replaced with the new Conversation from the server.
* React Native community should see fixes around `window.postMessage()` usage.  Note that we do not support React Native yet, but will respond to simple requests.
* Apps using `Component.on(a, b, obj)` can have `obj._layerEventSubscriptions = []`. All calls to `on` will push the Component into `obj._layerEventSubscriptions` so that `obj` can find all of the components it needs to unsubscribe from to be garbage collected.
* FileReader access now prefixed by `window` to support oddly configured server based tests
* Adds `client.getTypingState(conversationId)` which can be used on opening a Conversation to see if there is someone already typing into that Conversation.
* Adds a `move` event for `layer.Query` for when a result has been resorted from an old position to a new position.
* Fixes infinite retry loop on `Event.replay`
* Logging: Now uses correct console operation
* layer.Conversation now throws errors when trying to create a Conversation while not authenticated


## 2.0.X

Any further changes to the 2.0 branch will not be tracked in this version of the changelogs.

## 2.0.4

 * Queries on Messages where the server reports that the server is still syncing data for that Conversation will no longer fire events with new data, nor change `isFiring` to `false` until the server indicates that its done and the user's data is fully available on the server.  Instead the Query keeps `isFiring` as `true` and only fires a `data` event when the server is ready and has delivered correct data.
 * Fixes to persisting the Session Token if `isTrustedDevice` is `true`

## 2.0.3

* Fixes for Private Browsing windows (Firefox & Safari)
* Fixes handling of downgrading to older version of DB/WebSDK

## 2.0.1 & 2.0.2

Sorting out NPM Publish issues :-(

## 2.0.0

#### Breaking Changes

##### 1. Authentication Changes

Previously you could instantiate a layer.Client with a userId and it would automatically authenticate.
This is no longer supported; now you create a layer.Client, and when you are ready, you call `client.connect(userId)`.

```javascript
var client = new layer.Client({
    appId: "layer:///apps/staging/YOUR-APP-ID",
    isTrustedDevice: false
});

client.connect('Frodo-the-Dodo');
```

An optiona also exists to provide a session token that you have obtained yourself:

```
client.connectWithSession('Frodo-the-Dodo', mySessionToken);
```

Neither `sessionToken` nor `userId` are supported in the layer.Client constructor.

Furthermore, note that the `client.login()` method is removed. User `client.connect()` instead.

##### 2. Create Conversation

Previously, the following shorthand was supported:

```javascript
client.createConversation([participant1, participant2, etc...]);
```

This is no longer supported; only the longhand format is supported:

```javascript
client.createConversation({
    participants: [participant1, participant2, etc...]
});
```

##### 3. MessageParts Strings, Blobs and Base64 Encoding

The encoding property has been removed from layer.MessagePart.  If the server tells us that a MessagePart is base64 encoded, it will be turned into a Blob before your application sees it.  Any place your code expected a base64 string will now receive a Blob.

You can control which MIME Types are turned into Strings, and which are turned into Blobs using the new `layer.MessagePart.TextualMimeTypes` static property, which defaults to treating any MIME Type matching `text/*` or `application/json` as string and everything else as a Blob.  The following example adds a new type to be treated as a String:

```javascript
layer.MessagePart.TextualMimeTypes.push('application/location');
```

This change means that when you receive an Image, you no longer need to write code that handles both the case of it being a small enough image to be sent as a base64 encoded `body` string that you have to decode AND the case of it being Rich Content, downloaded, and delivered as a Blob.  Now data is delivered in a consistent manner.

##### 4. layer.Query no longer defaults to a model of Conversation

This was an oversight that has been corrected; if you created a Query with:

```javascript
var conversationQuery = client.createQuery({});
```
You will need to update to:
```javascript
var conversationQuery = client.createQuery({
  model: layer.Query.Conversation
});
```

##### 5. layer.User has been removed

This class was deprecated in `v1.0`.  Now its gone.  `v2.0` will introduce `layer.Identity`.

#### Major new Features

* Announcements
  * Introduces the `layer.Announcement` class
  * You can now Query for Announcements sent to your users
* Persistence (this is still considered experimental and must be explicitly enabled)
  * IndexedDB can store all Conversations, Messages and Announcements if the `layer.Client.isTrustedDevice` property is set to `true`, and `layer.Client.isPersistenceEnabled` is set to `true`.
  * Applications can now run entirely offline, populating `layer.Query` data using IndexedDB databases.
* Deleting Messages and Conversations from my devices, but not from other users devices:
  * In addition to calling `conversation.delete(layer.Constants.DELETION_MODE.ALL)` and `message.delete(layer.Constants.DELETION_MODE.ALL)`, you can now delete Messages and Conversation from your user's devices Only using `layer.Constants.DELETION_MODE.MY_DEVICES`.
  * `layer.Conversation.leave()` can be called to remove yourself as a participant and remove the Conversation from your devices.

#### Minor Changes

* No more `temp_layer:///` IDs, no more ID change events
  * Sending a Message will no longer result in a `messages:change` event that contains a change to the Message ID; the Message ID that is assigned when creating the Message will be accepted by the server.
  * Conversations may still get an ID change event in the case where a Distinct Conversation is created, and a matching Distinct Conversation is found on the server.
* Deduplication
  * If a response is not received to a request to create a Conversation or Message, it will be retried with deduplication support to insure that if it was created before, a duplicate is not created on retry.
* layer.Message
  * `layer.Message.getConversation()` now supports a boolean parameter to load from server if Conversation is not cached.
* layer.Client Authentication Changes
  * Client initialization no longer takes a `userId` parameter, and no longer immediately begins the authentication process
  * Client initialization no longer takes a `sessionToken` parameter
  * `layer.Client.connect` is now called to start authentication
  * `layer.Client.connectWithSession` can also be used to startup the client, if you already have a Session Token.
  * `layer.Client.login` has been removed; see `layer.Client.connect` instead
  * `layer.Client.logout(callback)` now takes a callback so that you can wait for all async activities to complete before navigating away.
* layer.MessagePart has changed in the following ways:
  * The encoding property is removed
  * `MessagePart.body` will always be either a String or a Blob; it will never be base64 encoded.  Base64 encoded data will be transformed to string or Blob before your application receives it.
  * Adds static property `layer.MessagePart.TextualMimeTypes` which stores an array of strings and regular expressions used to test if a MIME Type represents textual data.
  * Any textual MessagePart will have a `body` that is `null` (Rich Content which hasn't been fetched via `part.fetchContent()`) or a String.
  * Any non-textual MessagePart will have a `body` that is `null` (Rich Content which hasn't been fetched via `part.fetchContent()`) or a Blob)
  * Note that these rules apply regardless of whether the MessagePart size is less than or greater than 2KB, and regardless of whether its transmitted
    as base64 data.  This means any renderer has only to test for `null` or a value to handle its content.
* layer.OnlineStateManager: Now starts managing isOnline state as soon as `client.connect()` or `client.connectWithSession()` are called.

#### Bug Fixes

* Caching Fixes
  * Updates Caching to uncache any Messages and Conversations that aren't part of any Query's results 10 minutes (configurable) after websocket event announces their arrival.
  * Removes Conversation.lastMessage from cache once its no longer a query result.
  * Fixes cache cleanup on deleting a Query.

## 1.0.12

* JSDuck fixes

## 1.0.11

* Fixes bug in Query retry when server is syncing
* Adds `server-syncing-state` event to layer.Query to notify app when Query is waiting for more data, and when it is done getting more data.

## 1.0.10

* Destroying a Query now notifies any view using it that its data has been cleared. (WEB-1106)
* Websocket URL can now be customized via client.websocketUrl property

## 1.0.9

* Uses new server side support to retry any Query for Messages on a Conversation that is still syncing,
and is delivering fewer than the requested number of Messages. (WEB-1053)

## 1.0.8

* Disable Query Retry by default

## 1.0.7

* Improves logic around reconnecting websockets to validate that the session is still valid.
* Removes tests for Message `ffffffff....` which were used to validate the session is still valid.

## 1.0.6

* Query will retry when no data is detected in case the server has not yet received data for this user.

## 1.0.5

* Fixes bug in layer.Content.refreshContent where expiration is improperly set
* Fixes bug in layer.Query when `dataType` is layer.Query.ObjectDataType which fails to update data for a `messages:read` event

## 1.0.4

* Fixes parsing of Identity Token to handle URL Encoded strings

## 1.0.3

* Fixes support for Query.dataType == layer.Query.InstanceDataType in handling Message ID change events.

## 1.0.2

* Fixes support for the `sessionToken` in the constructor; broken with the introduction of the `isTrustedDevice` property. This is used as part of the [Alternate Authentication Process](https://developer.layer.com/docs/websdk#the-alternate-authentication-process).


## 1.0.1

* Adds isTrustedDevice property to layer.Client which defaults to false. If this is false, session tokens will NOT be written to localStorage, and will not be restored next time the page reloads.
  * Support for Deletion with either layer.Constants.DELETION_MODE.MY_DEVICES or .Constants.DELETION_MODE.ALL (delete for all users or just for me).  Note that deleting for just me doesn't remove me as a participant, which means that new Messages will cause the Conversation to reappear.
  * The `messages:read` event has been removed. Please use the `messages:change` event instead.

## 1.0.0

* Updated version number and language from beta to GA

## 0.9.3

* Minor bug fix to layer.Query

## 0.9.2

#### Public API Changes

* layer.Conversation
  * The `delete` method now requires a layer.Constant.DELETION_MODE argument and no longer supports Boolean arguments.
* Adds `isNew` `isSaving`, `isSynced` and `isSaved` methods; these will show up as properties when calling toObject().
* layer.Message
  * The `recipientStatus` property now returns layer.RECEIPT_STATE.PENDING for any recipient to whom the Message has not yet been sent
  * The `getImageURLs` method has been removed.
  * The `delete` method now requires a layer.Constant.DELETION_MODE argument and no longer supports Boolean arguments.
  * Adds `isNew` `isSaving`, `isSynced` and `isSaved` methods; these will show up as properties when calling toObject().
  * Removes the `isSending` property; use `isSaving` instead; `isSaving` will show up as a property for immutable objects.
* layer.MessagePart
  * The `fetchContent` method now triggers an `content-loaded-error` event if it fails to load the Content (content has expired for example, and must be refreshed)
* layer.Query
  * Now runs query as soon as client is ready (for queries created prior to Ready).
* layer.TypingIndicators.TypingListener
  * Now has a setInput method that can be used to change what input the Listener is monitoring when sending
    typing indicators to other users.
* layer.Client
  * Adds registerIOSPushToken() method for push notification support in hybrid apps
  * Adds registerAndroidPushToken() method for push notification support in hybrid apps
  * Adds unregisterPushToken() method
* layer.User
  * Flagged as a private class; it is recommended that you not use this until `v1.1` which will have Identity Management.

#### Bug Fixes

* A round of memory leak fixes

## 0.9.1

#### Bug Fixes

* layer.MessagePart now loads new Rich Content downloadUrl and expiration dates whenever Query reloads the Message.

#### Public API Changes

* layer.Query
  * The `dataType` property is now set with static properties, either layer.Query.InstanceDataType or layer.Query.ObjectDataType
  * A `paginationWindow` property larger than the maximum page size that then automatically loads multiple pages is no longer supported.  A paginationWindow larger than the maximum page size will be automatically adjusted to the maximum page size (a value of 500 will be changed to `query.data.length + 100` if its too large)
  * There is now a `totalSize` property reporting on the total number of results of the query there are on the server.
  * There is now a `size` property reporting on the total number of results of the query have been loaded from the server.
  * Previously you subscribe to `change` event and check the `evt.type` for values of `data`, `insert`, `remove`, `reset` and `property`.
    This still works, but now you can *also* choose to subscribe to `change:data`, `change:insert`, `change:remove`, `change:reset` and `change:property`.
* layer.TypingIndicators.TypingListener
  * Change to constructor parameters.  If using `client.createTypingListener` then it does not affect you
* layer.TypingIndicators.TypingPublisher
  * Change to constructor parameters.  If using `client.createTypingPublisher` then it does not affect you

#### Fixes

* Fixes issues with websocket reconnect logic

## 0.9.0 Public Beta Launch

#### Public API Changes

* layer.Client.createConversation now defaults to creating Distinct Conversations.


## 0.1.4

#### Public API Changes

* layer.Client
  * Now has an `online` event for reporting on whether it is or is not connected to the server.
  * Now clears all queries and reloads their data from the server if disconnected more than 30 hours

## 0.1.3

#### Public API Changes

* layer.Message
  * Now has an `isSending` property
  * Removes the `isLoaded` method
  * Adds the `isLoading` property
* layer.Conversation
  * Removes the `isLoaded` method
  * Adds the `isLoading` property
* layer.Client
  * Now supports a logLevel property with enhanced logging support
  * Adds `messages:notify` event which can be used to help drive desktop notifications more reliably than the `messages:add` event.

#### Fixes

* Fixes to error handling in websocket requests that timeout

## 0.1.2

#### Public API Changes

* layer.MessagePart
   * Now has a `hasContent` property
   * `loadContent()` method has been renamed to fetchContent
   * `fetchContent` now triggers a messages:change event on completion.
   * `content` property has been removed; this is now a private property
   * layer.MessagePart now has a `url` property; returns "" if url has expired.
   * `url` will be set asynchronously by calling `fetchContent()`
     This url will be to a resource cached in the browser.
   * `url` will be set asynchronously by calling `layer.MessagePart.fetchStream()`.
      This url will point to a remote resource, but this is an expiring URL.
   * The expiring url will be cleared when it has expired, requiring another
   call to fetchStream():
```
   function render(part) {}
    if (part.url) {
      return "<img src='{part.url}' />";
    } else {
      part.fetchStream(() => this.rerender());
      return "<img src='' />";
    }
  }
```
* layer.Client now provides a layer.Client.getMessagePart(id) method

#### Fixes

* Fixes to read receipts; no longer sends read receipt if already marked as read
* Fixes to Websocket reconnect logic insures that missed events are requested

## 0.1.1

#### Public API Changes

* `authenticated-expired` event has been replaced with `deauthenticated` event.
* layer.Query and layer.QueryBuilder now support a `sortBy` property which allows for sorting by `lastMessage.sentAt` or `createdAt`.
* Removes option to use XHR instead of websocket for sending messages and conversations
* `message.sendReceipt('read')` now sets the `isRead` property.
* Websocket PATCH events will load the object from the server if it isn't already cached; patch events are not emitted locally but the conversations:add/messages:add event will trigger showing the current state of the newly loaded object.
* Message.sentBy will now always have a value, even if the message is not yet sent.
* Message.isSending property has been added
* Fixes to layer.Query enable Message Queries to populate with the Conversation's lastMessage while waiting for the rest of the messages to load.
* Fixes to layer.Query now ignore any response but the most recent response (occurs when quickly changing between query predicates)


## 0.1.0

#### Public API Changes

* `client.getObject()` is now a protected method; use `client.getConversation()` or `client.getMessage()` instead
* `client.getConversation(id)` no longer loads the Conversation from the server if its not cached; `client.getConversation(id, true)` WILL load the Conversation from the server if its not cached.
* `client.getMessage(id)` no longer loads the Message from the server if its not cached; `client.getMessage(id, true)` WILL load the Message from the server if its not cached.