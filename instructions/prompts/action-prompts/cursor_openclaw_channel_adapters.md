 Prompt 1: Push notification channels (ntfy, Pushover, Gotify)

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - All channel adapters implement IChannelAdapter from channel-adapter.interface.ts
  - Adapters live in src/gateway/channels/adapters/
  - ntfy, pushover, and gotify are already declared in ChannelName and CATALOG_CHANNEL_NAMES
    as catalog stubs. Promote them to full adapter implementations.
  - These are outbound-only notification channels. They do not receive inbound messages
    from end users. parseInbound() always returns null. sendMessage() POSTs to the service API.
  - Reference: look at src/gateway/channels/adapters/slack-adapter.ts for the class shape
    and src/gateway/channels/channel-adapter.interface.ts for IChannelAdapter.

  TASK: Create three adapter files and register them.

  --- FILE: src/gateway/channels/adapters/ntfy-adapter.ts ---
  ntfy is a self-hosted or cloud push notification service (ntfy.sh).
  - env vars: NTFY_BASE_URL (default: https://ntfy.sh), NTFY_TOPIC, NTFY_TOKEN (optional bearer auth)
  - sendMessage(): POST to ${NTFY_BASE_URL}/${NTFY_TOPIC} with body = text,
    headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${token}` (if set) }
  - formatForChannel(): plain text, max 4096 chars, single chunk
  - parseInbound(): always return null
  - validateWebhook(): always return true (no inbound webhooks)
  - checkConfigured(): NTFY_TOPIC must be set

  --- FILE: src/gateway/channels/adapters/pushover-adapter.ts ---
  Pushover delivers notifications to iOS/Android via their API.
  - env vars: PUSHOVER_TOKEN (app API token), PUSHOVER_USER (user/group key)
  - sendMessage(): POST https://api.pushover.net/1/messages.json
    body (form-encoded): token, user, message=text (max 1024 chars), title="Carina"
  - formatForChannel(): trim to 1024 chars, single chunk
  - parseInbound(): always return null
  - validateWebhook(): always return true
  - checkConfigured(): both PUSHOVER_TOKEN and PUSHOVER_USER must be set

  --- FILE: src/gateway/channels/adapters/gotify-adapter.ts ---
  Gotify is a self-hosted push notification server.
  - env vars: GOTIFY_URL (base URL of server), GOTIFY_TOKEN (app token)
  - sendMessage(): POST ${GOTIFY_URL}/message
    body (JSON): { title: "Carina", message: text, priority: 5 }
    header: X-Gotify-Key: ${GOTIFY_TOKEN}
  - formatForChannel(): plain text, max 4000 chars
  - parseInbound(): always return null
  - validateWebhook(): always return true
  - checkConfigured(): both GOTIFY_URL and GOTIFY_TOKEN must be set

  REGISTRATION:
  In src/gateway/channels/channel-registry.ts, import all three adapters and
  register them alongside existing adapters. Follow the exact registration
  pattern used for existing adapters in that file.

  In src/gateway/channels/catalog-channel-specs.ts, remove ntfy, pushover,
  and gotify from CATALOG_STUB_CHANNELS and add CatalogChannelSpec entries
  for each with the env vars listed above.

  Add config keys to src/config/index.ts (or wherever channel config lives)
  for: ntfy.baseUrl, ntfy.topic, ntfy.token; pushover.token, pushover.user;
  gotify.url, gotify.token.

  TESTS:
  Create src/gateway/channels/adapters/ntfy-adapter.test.ts,
  pushover-adapter.test.ts, gotify-adapter.test.ts.
  Each test file must cover:
  - sendMessage() calls the correct endpoint with correct headers/body
  - parseInbound() returns null for any input
  - checkConfigured() returns false when required env vars missing
  Use vitest. Mock fetch/http calls. Do not make real network requests.

  ---
  Prompt 2: Facebook Messenger + Instagram (Meta Graph API)

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'messenger' is already in ChannelName and CATALOG_CHANNEL_NAMES as a stub.
  - 'instagram' needs to be added to ChannelName and registered.
  - Both use the Meta (Facebook) Graph API. They share the same webhook verification
    mechanism and almost identical message structures. Build them in the same file
    or as two thin classes sharing a shared MetaGraphBase helper.
  - Reference adapter pattern: src/gateway/channels/adapters/telegram-adapter.ts
  - Reference webhook validation: src/gateway/channels/adapters/slack-adapter.ts
  - Reference adapter pattern: src/gateway/channels/adapters/telegram-adapter.ts
  - Reference webhook validation: src/gateway/channels/adapters/slack-adapter.ts

  MESSENGER ADAPTER: src/gateway/channels/adapters/messenger-adapter.ts
  API: Meta Graph API v20.0
  - env vars: MESSENGER_PAGE_ACCESS_TOKEN, MESSENGER_VERIFY_TOKEN, MESSENGER_APP_SECRET
  - Webhook endpoint: POST /webhooks/messenger
  - Webhook verification (GET /webhooks/messenger):
    Query params: hub.mode=subscribe, hub.verify_token, hub.challenge
    If hub.verify_token matches MESSENGER_VERIFY_TOKEN, respond with hub.challenge
  - validateWebhook(): verify X-Hub-Signature-256 header using MESSENGER_APP_SECRET:
    expected = 'sha256=' + HMAC-SHA256(rawBody, APP_SECRET)
  - parseInbound(raw): entry[0].messaging[0] -> extract:
    id: messaging.message.mid
    externalUserId: messaging.sender.id
    conversationId: messaging.sender.id (Messenger threads are 1:1 with sender PSID)
    text: messaging.message.text
    isDirect: true (Messenger is always DM)
    isMention: false
    isCommand: text.startsWith('/')
    attachments: messaging.message.attachments[] mapped to Attachment[]
  - sendMessage(): POST https://graph.facebook.com/v20.0/me/messages
    body: { recipient: { id: conversationId }, message: { text: chunk } }
    query: access_token=PAGE_ACCESS_TOKEN
  - formatForChannel(): max 2000 chars per chunk
  - createRouter(): mount webhook GET (challenge) and POST (message) handlers

  INSTAGRAM ADAPTER: src/gateway/channels/adapters/instagram-adapter.ts
  Identical to Messenger except:
  - channel name: 'instagram'
  - env vars: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET
  - Webhook endpoint: POST /webhooks/instagram
  - entry[0].messaging[0].message comes from Instagram Business accounts
  - conversationId: messaging.sender.id (Instagram-scoped user ID)
  - sendMessage(): POST https://graph.facebook.com/v20.0/me/messages
    body: { recipient: { id: conversationId }, message: { text: chunk } }
    query: access_token=INSTAGRAM_ACCESS_TOKEN

  TYPE CHANGES:
  In channel-adapter.interface.ts, add 'instagram' to ChannelName union type.
  In catalog-channel-specs.ts, add 'instagram' to CatalogChannelName, remove
  'messenger' from CATALOG_STUB_CHANNELS, add CatalogChannelSpec entries for both.

  REGISTRATION:
  Register both adapters in channel-registry.ts.
  Add config keys: messenger.pageAccessToken, messenger.verifyToken, messenger.appSecret;
  instagram.accessToken, instagram.verifyToken, instagram.appSecret.

  TESTS: messenger-adapter.test.ts, instagram-adapter.test.ts
  - parseInbound() correctly extracts sender ID, text, attachments from raw webhook body
  - validateWebhook() passes with correct HMAC, fails with wrong signature
  - GET challenge verification returns hub.challenge when verify_token matches
  - sendMessage() POSTs to correct Graph API endpoint with correct body

  ---
  Prompt 3: Twitter/X Direct Messages

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'twitter' or 'twitter-x' does not yet exist in ChannelName. Add it as 'twitter'.
  - Twitter/X DM uses the Twitter API v2 DM endpoints.
  - OAuth 2.0 App-Only or OAuth 1.0a User Context required for DMs.
  - Reference adapter: src/gateway/channels/adapters/slack-adapter.ts (webhook pattern)

  FILE: src/gateway/channels/adapters/twitter-adapter.ts

  env vars:
    TWITTER_BEARER_TOKEN       - App-Only Bearer Token (for reading)
    TWITTER_API_KEY            - OAuth 1.0a API Key
    TWITTER_API_SECRET         - OAuth 1.0a API Secret
    TWITTER_ACCESS_TOKEN       - OAuth 1.0a Access Token (user context)
    TWITTER_ACCESS_TOKEN_SECRET - OAuth 1.0a Access Token Secret
    TWITTER_WEBHOOK_ENV        - Twitter webhook environment name (e.g. "production")
    TWITTER_CONSUMER_SECRET    - for CRC webhook validation

  Webhook registration and CRC challenge:
  - Twitter Account Activity API sends a GET with crc_token query param to /webhooks/twitter
  - Response must be: { response_token: 'sha256=' + HMAC-SHA256(crc_token, CONSUMER_SECRET) }
  - This is the validateWebhook() / createRouter() GET handler

  parseInbound(raw):
    raw is a Twitter Account Activity event body (JSON)
    Check raw.direct_message_events[0]:
      id: dm_event.id
      externalUserId: dm_event.message_create.sender_id
      conversationId: dm_event.message_create.sender_id (reply to sender)
      text: dm_event.message_create.message_data.text
      isDirect: true
      isMention: false
      isCommand: text.startsWith('/')
    Skip if sender_id matches the bot's own ID (TWITTER_BOT_USER_ID env var) to avoid loops.

  sendMessage(conversationId, text):
    Use Twitter API v2 POST /2/dm_conversations/with/:participant_id/messages
    body: { text: chunk }
    Auth: OAuth 1.0a signed request using API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_TOKEN_SECRET
    Implement a minimal OAuth 1.0a signing function (or use the 'oauth-1.0a' npm package).
    Max 10000 chars per DM. formatForChannel(): split at 10000 chars.

  createRouter():
    GET /webhooks/twitter -> CRC challenge response
    POST /webhooks/twitter -> parse inbound DM events, route to Carina

  TYPE CHANGES:
  Add 'twitter' to ChannelName in channel-adapter.interface.ts.
  Add to catalog-channel-specs.ts with env vars listed above.
  Add config in src/config/index.ts: twitter.bearerToken, twitter.apiKey,
  twitter.apiSecret, twitter.accessToken, twitter.accessTokenSecret,
  twitter.consumerSecret, twitter.botUserId, twitter.webhookEnv.

  TESTS: twitter-adapter.test.ts
  - CRC challenge responds correctly with HMAC-SHA256 of crc_token
  - parseInbound() extracts DM sender and text, skips bot's own messages
  - sendMessage() calls the correct v2 endpoint with OAuth 1.0a auth header
  - formatForChannel() splits messages longer than 10000 chars

  ---
  Prompt 4: Rocket.Chat and Cisco Webex

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'rocketchat' is already in ChannelName and CATALOG_CHANNEL_NAMES as a stub.
  - 'webex' needs to be added to ChannelName.
  - Both are business messaging platforms with webhook integrations.
  - Reference: src/gateway/channels/adapters/slack-adapter.ts

  --- ROCKET.CHAT: src/gateway/channels/adapters/rocketchat-adapter.ts ---

  env vars:
    ROCKETCHAT_URL             - Base URL (e.g. https://chat.example.com)
    ROCKETCHAT_BOT_USER_ID     - Bot user ID
    ROCKETCHAT_BOT_AUTH_TOKEN  - Bot auth token
    ROCKETCHAT_WEBHOOK_SECRET  - Optional: shared secret for validating incoming webhooks

  Inbound webhooks:
    Rocket.Chat Outgoing Webhook sends POST to /webhooks/rocketchat
    Payload structure: { _id, channel_id, channel_name, user_id, user_name, text, ... }
    validateWebhook(): if ROCKETCHAT_WEBHOOK_SECRET set, verify X-RocketChat-Signature header
      signature = HMAC-SHA256(rawBody, WEBHOOK_SECRET) in hex
    parseInbound(raw):
      Skip if raw.bot (boolean) is true - avoid echo loops
      id: raw._id or raw.message_id
      externalUserId: raw.user_id
      conversationId: raw.channel_id
      text: raw.text
      isDirect: raw.channel_name === 'direct'
      isMention: /@carina\b/i.test(text)
      isCommand: text.startsWith('/')
      senderName: raw.user_name

  sendMessage(conversationId, text):
    POST ${ROCKETCHAT_URL}/api/v1/chat.postMessage
    headers: X-Auth-Token: BOT_AUTH_TOKEN, X-User-Id: BOT_USER_ID
    body: { channel: conversationId, text: chunk }
    Max 40000 chars per chunk.

  createRouter(): POST /webhooks/rocketchat

  --- WEBEX: src/gateway/channels/adapters/webex-adapter.ts ---

  env vars:
    WEBEX_BOT_TOKEN       - Webex Bot access token
    WEBEX_WEBHOOK_SECRET  - Shared secret set when registering webhook

  Webhook validation:
    Webex signs payload with X-Spark-Signature header (HMAC-SHA1 of rawBody using WEBHOOK_SECRET)
    validateWebhook(): compare X-Spark-Signature to sha1 HMAC

  parseInbound(raw):
    raw is a Webex webhook event: { id, resource, event, data }
    Only handle resource='messages', event='created'
    Fetch actual message: GET https://webexapis.com/v1/messages/${data.id}
      header: Authorization: Bearer BOT_TOKEN
    From fetched message:
      id: message.id
      externalUserId: message.personId
      conversationId: message.roomId
      text: message.text (strip leading @BotName mention if present)
      isDirect: message.roomType === 'direct'
      isMention: message.mentionedPeople includes bot's own personId
      isCommand: text.startsWith('/')
    Skip if message.personId === bot's own ID

  sendMessage(conversationId, text):
    POST https://webexapis.com/v1/messages
    header: Authorization: Bearer BOT_TOKEN
    body: { roomId: conversationId, text: chunk }
    Max 7439 chars.

  createRouter(): POST /webhooks/webex

  TYPE CHANGES:
  Add 'webex' to ChannelName union.
  Remove 'rocketchat' from CATALOG_STUB_CHANNELS.
  Add CatalogChannelSpec entries for both in catalog-channel-specs.ts.
  Add config: rocketchat.url, rocketchat.botUserId, rocketchat.botAuthToken,
    rocketchat.webhookSecret; webex.botToken, webex.webhookSecret.

  TESTS: rocketchat-adapter.test.ts, webex-adapter.test.ts
  Each must cover: parseInbound extracts correct fields, validateWebhook
  passes/fails on valid/invalid HMAC, sendMessage calls correct endpoint,
  bot echo loop is skipped.

  ---

  sendMessage(conversationId, text):
    POST https://webexapis.com/v1/messages
    header: Authorization: Bearer BOT_TOKEN
    body: { roomId: conversationId, text: chunk }
    Max 7439 chars.

  createRouter(): POST /webhooks/webex

  TYPE CHANGES:
  Add 'webex' to ChannelName union.
  Remove 'rocketchat' from CATALOG_STUB_CHANNELS.
  Add CatalogChannelSpec entries for both in catalog-channel-specs.ts.
  Add config: rocketchat.url, rocketchat.botUserId, rocketchat.botAuthToken,
    rocketchat.webhookSecret; webex.botToken, webex.webhookSecret.

  TESTS: rocketchat-adapter.test.ts, webex-adapter.test.ts
  Each must cover: parseInbound extracts correct fields, validateWebhook
  passes/fails on valid/invalid HMAC, sendMessage calls correct endpoint,
  bot echo loop is skipped.

  ---
  Prompt 5: KakaoTalk and Zalo

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'kakaotalk' is already in ChannelName and CATALOG_CHANNEL_NAMES as a stub.
  - 'zalo' needs to be added to ChannelName.
  - Both are major Asian messaging platforms (South Korea / Vietnam).
  - Reference: src/gateway/channels/adapters/telegram-adapter.ts

  --- KAKAOTALK: src/gateway/channels/adapters/kakaotalk-adapter.ts ---

  KakaoTalk uses KakaoTalk Business API (for business accounts) / KakaoTalk Channel.
  Webhook approach via KakaoTalk Chatbot API.

  env vars:
    KAKAOTALK_API_KEY     - KakaoTalk business API key
    KAKAOTALK_BOT_ID      - KakaoTalk bot/channel ID
    KAKAOTALK_WEBHOOK_SECRET - for validating inbound requests

  Inbound:
    POST /webhooks/kakaotalk
    KakaoTalk sends JSON: { userRequest: { user: { id, type }, utterance, ... }, ... }
    parseInbound(raw):
      const req = raw.userRequest
      id: req.callbackId or generate from timestamp
      externalUserId: req.user.id
      conversationId: req.user.id (KakaoTalk chatbot is always 1:1)
      text: req.utterance
      isDirect: true
      isMention: false
      isCommand: text.startsWith('/')
      senderName: req.user.properties?.nickname

  sendMessage(conversationId, text):
    KakaoTalk chatbot responses are synchronous - the bot replies inline in the webhook response.
    Store pending replies keyed by conversationId. When the webhook handler calls sendMessage,
    buffer the text. The webhook POST handler reads the buffered text and returns it as the
    KakaoTalk response JSON: { version: "2.0", template: { outputs: [{ simpleText: { text: chunk } }] } }
    This is the KakaoTalk Skill Server pattern.
    Max 1000 chars per simpleText output.

  createRouter(): POST /webhooks/kakaotalk - handles inbound, calls router, returns buffered reply.

  --- ZALO: src/gateway/channels/adapters/zalo-adapter.ts ---

  Zalo OA (Official Account) API.

  env vars:
    ZALO_APP_ID          - Zalo app ID
    ZALO_APP_SECRET      - Zalo app secret (for webhook verification)
    ZALO_OA_ACCESS_TOKEN - OA access token for sending messages
    ZALO_REFRESH_TOKEN   - For refreshing OA access token

  Webhook verification:
    Zalo sends POST with MAC validation header: mac = HMAC-SHA256(app_id + data + app_secret)
    validateWebhook(): verify by computing MAC from raw body fields

  parseInbound(raw):
    Zalo event: { event_name, timestamp, sender: { id }, recipient: { id }, message: { msg_id, text } }
    Only handle event_name = 'user_send_text'
    id: message.msg_id
    externalUserId: sender.id
    conversationId: sender.id
    text: message.text
    isDirect: true
    isMention: false
    isCommand: text.startsWith('/')

  sendMessage(conversationId, text):
    POST https://openapi.zalo.me/v3.0/oa/message/cs
    header: access_token: OA_ACCESS_TOKEN
    body: { recipient: { user_id: conversationId }, message: { text: chunk } }
    Max 2000 chars per message.

  createRouter(): POST /webhooks/zalo

  TYPE CHANGES:
  Add 'zalo' to ChannelName.
  Remove 'kakaotalk' from CATALOG_STUB_CHANNELS.
  Add CatalogChannelSpec for both.
  Config: kakaotalk.apiKey, kakaotalk.botId, kakaotalk.webhookSecret;
    zalo.appId, zalo.appSecret, zalo.oaAccessToken, zalo.refreshToken.

  TESTS: kakaotalk-adapter.test.ts, zalo-adapter.test.ts
  - KakaoTalk: parseInbound extracts utterance/user; synchronous reply buffer returns correct JSON structure
  - Zalo: parseInbound extracts message text; validateWebhook MAC check passes/fails correctly

  ---
  Prompt 6: Threema, Wire, Keybase

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'threema' and 'keybase' are in ChannelName and CATALOG_CHANNEL_NAMES as stubs.
  - 'wire' needs to be added to ChannelName.
  - All three are privacy-focused messaging platforms. Integration uses their
    official bot APIs or server-side bridges.
  - Reference: src/gateway/channels/adapters/telegram-adapter.ts

  --- THREEMA: src/gateway/channels/adapters/threema-adapter.ts ---

  Threema Gateway (gateway.threema.ch) - allows bots to send/receive messages via HTTP API.
  Uses Threema's end-to-end encrypted gateway with a dedicated gateway ID (starts with *).

  env vars:
    THREEMA_GATEWAY_ID     - Gateway Threema ID (e.g. *CARINA01)
    THREEMA_GATEWAY_SECRET - Gateway API secret
    THREEMA_PRIVATE_KEY    - Ed25519 private key (hex) for E2E decryption (optional: basic mode)

  Mode: Use Threema Gateway "basic mode" (no client-side E2E, server handles encryption).

  Webhook:
    POST /webhooks/threema
    Threema sends form-encoded POST: from=SENDER_ID&to=GATEWAY_ID&text=...&nonce=...&box=...&mac=...
    validateWebhook(): verify mac = HMAC-SHA256(from + to + nonce + gateway_secret)
    parseInbound(raw):
      id: raw.msgid or nonce
      externalUserId: raw.from (sender's Threema ID)
      conversationId: raw.from
      text: raw.text (basic mode; in E2E mode decrypt box with private key)
      isDirect: true
      isMention: false
      isCommand: text.startsWith('/')

  sendMessage(conversationId, text):
    POST https://msgapi.threema.ch/send_simple
    form-encoded: from=GATEWAY_ID, secret=GATEWAY_SECRET, to=conversationId, text=chunk
    Max 3500 chars.

  createRouter(): POST /webhooks/threema

  --- WIRE: src/gateway/channels/adapters/wire-adapter.ts ---

  Wire for enterprises uses the Wire Bot API or Wire SSO.
  For self-hosted Wire or Wire for Business, use the Wire BEagle (Bot API).

  env vars:
    WIRE_BOT_CLIENT_ID     - Wire bot client ID
    WIRE_BOT_TOKEN         - Wire bot auth token
    WIRE_BOT_SECRET        - For validating inbound webhook signatures
    WIRE_API_BASE          - Wire API base URL (default: https://prod-nginz-https.wire.com)

  Webhook:
    POST /webhooks/wire
    Wire delivers events as JSON: { type, conversation, from, data: { content, ... } }
    validateWebhook(): verify Authorization header matches BOT_SECRET
    parseInbound(raw):
      Only handle type = 'conversation.otr-message-add' or 'conversation.message-add'
      id: raw.id or raw.data.id
      externalUserId: raw.from
      conversationId: raw.conversation
      text: raw.data.content or raw.data.text
      isDirect: raw.data.recipient_mode === 'direct' (or default to group)
      isMention: /@carina\b/i.test(text)
      isCommand: text.startsWith('/')

  sendMessage(conversationId, text):
    POST ${WIRE_API_BASE}/bot/messages
    header: Authorization: Bearer BOT_TOKEN, Client-Id: BOT_CLIENT_ID
    body: { type: 'conversation.message-add', conversation: conversationId, text: chunk }
    Max 8000 chars.

  createRouter(): POST /webhooks/wire

  --- KEYBASE: src/gateway/channels/adapters/keybase-adapter.ts ---

  Keybase bots use the keybase CLI or keybase-bot npm package.

  env vars:
    KEYBASE_USERNAME  - Bot's Keybase username
    KEYBASE_PAPERKEY  - Bot's paper key for authentication

  Integration model: polling-based via keybase-bot package (npm: keybase-bot).
  No webhook; the bot connects to Keybase's servers and receives messages via long-poll.

  parseInbound(raw):
    raw is a Keybase ChatMessage: { id, channel, sender, content }
    Only handle content.type === 'text'
    id: String(raw.id)
    externalUserId: raw.sender.username
    conversationId: raw.channel.name + '#' + (raw.channel.topicName || 'general')
    text: raw.content.text.body
    isDirect: raw.channel.membersType === 'impteamnative' (implies DM)
    isMention: /@carina\b/i.test(text)
    isCommand: text.startsWith('!')

  sendMessage(conversationId, text):
    Use the keybase-bot instance: bot.chat.send(parsedChannel, { body: chunk })
    conversationId format: 'teamname#topicname' or username for DMs
    Max 10000 chars.

  start(): Initialize keybase-bot, call bot.init(username, paperkey), then
    bot.chat.watchAllChannelsForNewMessages(onMessage, onError)
    Return { stop: () => bot.deinit() }

  TYPE CHANGES:
  Add 'wire' to ChannelName.
  Remove 'threema' and 'keybase' from CATALOG_STUB_CHANNELS.
  Add CatalogChannelSpec entries for all three.
  Config: threema.gatewayId, threema.gatewaySecret, threema.privateKey;
    wire.botClientId, wire.botToken, wire.botSecret, wire.apiBase;
    keybase.username, keybase.paperkey.

  TESTS: threema-adapter.test.ts, wire-adapter.test.ts, keybase-adapter.test.ts
  - Threema: HMAC MAC validation, basic-mode text extraction from form POST
  - Wire: validateWebhook auth header check, parseInbound type filtering
  - Keybase: parseInbound from keybase-bot ChatMessage shape, channel/DM detection

  ---
  Prompt 7: Twitch Live Chat and YouTube Live Chat

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'twitch' is already in ChannelName and CATALOG_CHANNEL_NAMES as a stub.
  - 'youtube' (for Live Chat) needs to be added to ChannelName.
  - Both are streaming platform chat integrations. Twitch uses EventSub webhooks
    or IRC. YouTube uses polling of the LiveChatMessages API.
  - Reference: src/gateway/channels/adapters/slack-adapter.ts

  --- TWITCH: src/gateway/channels/adapters/twitch-adapter.ts ---

  Use Twitch EventSub (webhooks) for chat message events.

  env vars:
    TWITCH_CLIENT_ID          - Twitch application client ID
    TWITCH_CLIENT_SECRET      - Twitch application client secret
    TWITCH_EVENTSUB_SECRET    - Secret used when registering EventSub subscriptions
    TWITCH_BOT_USERNAME       - Bot's Twitch username
    TWITCH_CHANNEL            - Channel name to listen to (e.g. mychannel)
    TWITCH_CHANNEL_ID         - Broadcaster user ID for the channel

  EventSub webhook:
    POST /webhooks/twitch
    Twitch sends Twitch-Eventsub-Message-Type header: webhook_callback_verification or notification
    validateWebhook(): verify Twitch-Eventsub-Message-Signature header:
      expected = 'sha256=' + HMAC-SHA256(
        Twitch-Eventsub-Message-Id + Twitch-Eventsub-Message-Timestamp + rawBody,
        EVENTSUB_SECRET
      )
    For webhook_callback_verification: respond 200 with body = challenge from JSON
    For notification type, proceed with parseInbound

  parseInbound(raw):
    raw.subscription.type should be 'channel.chat.message'
    event = raw.event
    Skip if event.chatter_user_login === TWITCH_BOT_USERNAME (avoid echo)
    id: event.message_id
    externalUserId: event.chatter_user_id
    conversationId: event.broadcaster_user_id
    text: event.message.text
    isDirect: false (Twitch chat is public)
    isMention: event.message.text.toLowerCase().includes('@' + TWITCH_BOT_USERNAME.toLowerCase())
    isCommand: text.startsWith('!')
    senderName: event.chatter_user_login

  sendMessage(conversationId, text):
    Use Twitch Chat API: POST https://api.twitch.tv/helix/chat/messages
    header: Authorization: Bearer <app_token>, Client-Id: CLIENT_ID
    body: { broadcaster_id: conversationId, sender_id: BOT_USER_ID, message: chunk }
    App token: obtain via client_credentials grant using CLIENT_ID and CLIENT_SECRET
    Cache the app token and refresh when expired.
    Max 500 chars per message.

  createRouter(): handles both GET (verification) and POST (notifications)

  --- YOUTUBE LIVE CHAT: src/gateway/channels/adapters/youtube-adapter.ts ---

  Uses YouTube Data API v3 LiveChatMessages resource.
  No webhook support - must poll at the interval specified by pollingIntervalMillis.

  env vars:
    YOUTUBE_API_KEY              - Google API key (for read-only polling)
    YOUTUBE_BOT_CHANNEL_ID       - The bot's YouTube channel ID (to skip own messages)
    YOUTUBE_OAUTH_CLIENT_ID      - OAuth client ID (for sending messages requires OAuth)
    YOUTUBE_OAUTH_CLIENT_SECRET  - OAuth client secret
    YOUTUBE_OAUTH_REFRESH_TOKEN  - Pre-authorized refresh token for sending

  start():
    Poll: GET https://www.googleapis.com/youtube/v3/liveChats/${liveChatId}/messages
      ?part=snippet,authorDetails&key=API_KEY&pageToken=${nextPageToken}
    Use nextPageToken for pagination. Respect pollingIntervalMillis from response.
    Emit each new message through the router.
    liveChatId: must be obtained at startup from a broadcast - store in YOUTUBE_LIVE_CHAT_ID env var.
    Return { stop: () => clearInterval(pollTimer) }

  parseInbound(raw): (raw = single liveChatMessage item)
    Skip if raw.authorDetails.channelId === YOUTUBE_BOT_CHANNEL_ID
    Only handle snippet.type === 'textMessageEvent'
    id: raw.id
    externalUserId: raw.authorDetails.channelId
    conversationId: raw.snippet.liveChatId
    text: raw.snippet.textMessageDetails.messageText
    isDirect: false
    isMention: /@carina\b/i.test(text)
    isCommand: text.startsWith('!')
    senderName: raw.authorDetails.displayName

  sendMessage(conversationId, text):
    Exchange refresh token for access token via OAuth.
    POST https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet
    header: Authorization: Bearer <access_token>
    body: { snippet: { liveChatId: conversationId, type: 'textMessageEvent',
      textMessageDetails: { messageText: chunk } } }
    Max 200 chars per message (YouTube Live Chat limit).

  TYPE CHANGES:
  Add 'youtube' to ChannelName.
  Remove 'twitch' from CATALOG_STUB_CHANNELS.
  Add CatalogChannelSpec for both with their env vars.
  Config: twitch.clientId, twitch.clientSecret, twitch.eventsubSecret,
    twitch.botUsername, twitch.channel, twitch.channelId;
    youtube.apiKey, youtube.botChannelId, youtube.oauthClientId,
    youtube.oauthClientSecret, youtube.oauthRefreshToken, youtube.liveChatId.

  TESTS: twitch-adapter.test.ts, youtube-adapter.test.ts
  - Twitch: EventSub HMAC validation, challenge verification response, message parsing,
    bot echo skipping, 500-char chunk splitting
  - YouTube: parseInbound from liveChatMessage shape, own-message skipping, polling timer
    starts/stops correctly (mock the fetch, verify it polls at correct interval)

  ---
  Prompt 8: Telegram Topics/Forums enhancement

  You are working in the Carina AI agent codebase.

  CONTEXT:
  - The existing Telegram adapter is at src/gateway/channels/adapters/telegram-adapter.ts
  - It handles basic private and group chats but does NOT handle Telegram forum topics
    (supergroups with is_forum=true, which use message_thread_id for topic threading).
  - This prompt enhances the existing adapter only - do not create a new file.

  CHANGES TO telegram-adapter.ts:

  1. In parseInbound(), after extracting chatType, add topic/thread support:
     const isForumTopic = msg.chat?.is_forum === true && msg.message_thread_id !== undefined;
     Add to returned ChannelMessage:
       threadId: isForumTopic ? String(msg.message_thread_id) : undefined
       chatType: isForumTopic ? 'group' : chatType (forums are always group context)
     Add chatTitle for forum name: msg.chat?.title

  2. In sendMessage(), respect threadId for topic replies:
     When options.threadId is set and the conversationId is a supergroup/forum,
     include message_thread_id: Number(options.threadId) in the sendMessage call
     to reply in the correct topic thread.

  3. Update isMention logic for forum groups:
     In forum topics, messages have entities where entity.type === 'mention' and
     the mentioned username matches botUsername. Check msg.entities[] for this.

  4. Add a helper topicId(msg: TelegramRawMessage): string | undefined that extracts
     message_thread_id as a string, or undefined if not a forum message.

  5. Export a new type TelegramForumContext:
     { chatId: string; topicId: string; topicName?: string }
     with a helper parseTelegramForumContext(raw: unknown): TelegramForumContext | null
     that extracts forum context from a Telegram update. This is used by the router
     to maintain per-topic conversation threads.

  ROUTING IMPACT:
  In src/gateway/channels/thread-ownership.ts (or wherever thread identity is tracked),
  ensure that for Telegram forum messages, the thread key is
  `telegram:${chatId}:${topicId}` rather than just `telegram:${chatId}`.
  This prevents topic 1 and topic 2 of the same supergroup from sharing a
  conversation context.

  TESTS: Update telegram-adapter.test.ts to add:
  - parseInbound() sets threadId when message has message_thread_id
  - parseInbound() returns undefined threadId for non-forum messages
  - sendMessage() includes message_thread_id in API call when options.threadId set
  - parseTelegramForumContext() extracts chatId and topicId correctly
  - isMention() correctly detects @mention entity in forum messages

  ---
  Prompt 9: GroupMe, Nextcloud Talk, LinkedIn DMs

  You are working in the Carina AI agent codebase at src/gateway/channels/.

  CONTEXT:
  - 'nextcloud-talk' is in ChannelName and CATALOG_CHANNEL_NAMES as a stub.
  - 'groupme', 'linkedin', 'skype' need to be added to ChannelName.
  - Reference: src/gateway/channels/adapters/slack-adapter.ts

  --- GROUPME: src/gateway/channels/adapters/groupme-adapter.ts ---

  GroupMe uses a simple bot API (no OAuth for bots).

  env vars:
    GROUPME_BOT_ID    - Bot ID from dev.groupme.com
    GROUPME_BOT_TOKEN - Access token (for admin operations)
    GROUPME_GROUP_ID  - Group ID to participate in

  Inbound:
    GroupMe sends POST to a callback URL when a message is sent.
    POST /webhooks/groupme
    Payload: { id, name, user_id, group_id, text, sender_type, ... }
    validateWebhook(): no signature validation (GroupMe doesn't sign payloads).
      Accept all POSTs from /webhooks/groupme. Rate-limit by IP in the router.
    parseInbound(raw):
      Skip if raw.sender_type === 'bot' to avoid echo loops
      id: raw.id
      externalUserId: raw.user_id
      conversationId: raw.group_id
      text: raw.text
      isDirect: false (GroupMe groups only)
      isMention: raw.attachments?.some(a => a.type === 'mentions' && a.user_ids?.includes(BOT_USER_ID))
      isCommand: text.startsWith('!')
      senderName: raw.name

  sendMessage(conversationId, text):
    POST https://api.groupme.com/v3/bots/post
    body: { bot_id: BOT_ID, text: chunk }
    No auth header needed (bot_id authenticates).
    Max 450 chars per message.

  --- NEXTCLOUD TALK: src/gateway/channels/adapters/nextcloud-talk-adapter.ts ---

  Nextcloud Talk REST API for bots (Nextcloud 27+).

  env vars:
    NEXTCLOUD_URL         - Nextcloud instance URL (e.g. https://cloud.example.com)
    NEXTCLOUD_BOT_SECRET  - Secret configured in Nextcloud admin for webhook validation
    NEXTCLOUD_BOT_USER    - Bot's Nextcloud username (optional, for display)

  Webhook:
    Nextcloud sends POST /webhooks/nextcloud-talk
    Header: X-Nextcloud-Talk-Signature: HMAC-SHA256(rawBody, BOT_SECRET) in hex
    validateWebhook(): verify X-Nextcloud-Talk-Signature
    parseInbound(raw):
      raw: { type: "Create", actor: { id, name }, object: { id, content }, target: { id } }
      Only handle type === "Create"
      id: raw.object.id
      externalUserId: raw.actor.id
      conversationId: raw.target.id (conversation/room token)
      text: raw.object.content (may be HTML-encoded, strip tags)
      isDirect: false (assume group; Nextcloud API would need separate call to check)
      isMention: /@carina\b/i.test(text)
      isCommand: text.startsWith('/')
      senderName: raw.actor.name

      senderName: raw.actor.name

  sendMessage(conversationId, text):
    POST ${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/v1/chat/${conversationId}
    header: Authorization: Bearer ${BOT_SECRET}, OCS-APIRequest: true, Accept: application/json
    body: { message: chunk, replyTo: 0 }
    Max 32000 chars.

  --- LINKEDIN: src/gateway/channels/adapters/linkedin-adapter.ts ---

  LinkedIn Messaging API (requires LinkedIn Partner Program access for DM bots).
  Use LinkedIn Messaging API v2.

  env vars:
    LINKEDIN_ACCESS_TOKEN    - OAuth 2.0 access token with w_member_social scope
    LINKEDIN_CLIENT_ID       - LinkedIn app client ID
    LINKEDIN_CLIENT_SECRET   - LinkedIn app client secret
    LINKEDIN_WEBHOOK_SECRET  - For validating LinkedIn webhook events

  Webhook:
    POST /webhooks/linkedin
    LinkedIn sends X-LI-Signature: SHA256 HMAC of rawBody with CLIENT_SECRET
    validateWebhook(): verify X-LI-Signature header

  parseInbound(raw):
    LinkedIn conversation message webhook payload:
    { message: { id, from: { person }, content: { text }, conversation: { id } } }
    id: raw.message.id
    externalUserId: raw.message.from.person (LinkedIn URN: urn:li:person:...)
    conversationId: raw.message.conversation.id
    text: raw.message.content.text
    isDirect: true (LinkedIn DMs)
    isMention: false
    isCommand: text.startsWith('/')

  sendMessage(conversationId, text):
    POST https://api.linkedin.com/v2/messages
    header: Authorization: Bearer ACCESS_TOKEN
    body: { recipients: [{ person: conversationId }], subject: '', body: chunk }
    Max 8000 chars.

  TYPE CHANGES:
  Add 'groupme', 'linkedin', 'skype' to ChannelName.
  Remove 'nextcloud-talk' from CATALOG_STUB_CHANNELS.
  Add CatalogChannelSpec for all four.
  Config blocks: groupme.botId, groupme.botToken, groupme.groupId;
    nextcloudTalk.url, nextcloudTalk.botSecret, nextcloudTalk.botUser;
    linkedin.accessToken, linkedin.clientId, linkedin.clientSecret, linkedin.webhookSecret.

  TESTS: groupme-adapter.test.ts, nextcloud-talk-adapter.test.ts, linkedin-adapter.test.ts
  - GroupMe: bot echo skip, no-signature acceptance, 450-char chunking
  - Nextcloud: HMAC-SHA256 validation, HTML tag stripping in text
  - LinkedIn: X-LI-Signature validation, URN as externalUserId, DM flag always true

  ---
  Each prompt is self-contained and gives Cursor the exact API endpoint, auth mechanism, env vars, parsing logic, and test requirements without needing to ask follow-up questions. The implementation order I'd suggest: push notifications
  first (lowest risk, no inbound), then Messenger, then Rocket.Chat/Webex (enterprise value), then the rest by market size.

