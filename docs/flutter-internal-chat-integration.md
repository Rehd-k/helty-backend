# Flutter integration: internal chat, presence, and support tickets

This backend treats **staff JWT `sub`** as **`Staff.id`** (UUID). All conversation and ticket APIs use that id.

## LAN base URL

Set the API host to your hospital server (hostname or static IP), for example:

- `http://192.168.1.50:4000`

Configure the server env `PUBLIC_API_BASE_URL` to the same origin you use in Flutter so upload responses return usable `downloadUrl` values. On a trusted LAN you may use HTTP; use HTTPS if you terminate TLS internally.

## Authentication (REST)

1. **Login** (existing): `POST` to your auth endpoint with staff email/password; response includes `accessToken` and `staff`.
2. Send **`Authorization: Bearer <accessToken>`** on every REST call.

## Socket.IO connection

Add dependency: [`socket_io_client`](https://pub.dev/packages/socket_io_client) (compatible with socket.io v4).

```dart
import 'package:socket_io_client/socket_io_client.dart' as io;

final socket = io.io(
  'http://192.168.1.50:4000',
  io.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': accessToken})
      // .setQuery({'token': accessToken}) // alternative
      .enableReconnection()
      .build(),
);

socket.onConnect((_) {
  // optional: start presence heartbeat timer (~30s)
  socket.emit('presenceHeartbeat', {});
});

socket.on('user_id', (data) {
  // { userId, displayName }
});

socket.on('online_users', (data) {
  // legacy list of sockets-based online users
});

socket.on('receiveMessage', (data) {
  // persisted conversation message (see server payload)
});

socket.on('typing', (data) {
  // { conversationId, userId, typing }
});

socket.on('readReceipt', (data) {
  // { conversationId, readerId, lastReadMessageId, markedCount }
});

socket.on('presenceUpdate', (data) {
  // { staffId, status, lastSeen } — broadcast on heartbeat
});

socket.on('ticketMessage', (data) {
  // ticket thread message
});

socket.on('chat_error', (data) {
  // { message: string }
});
```

### Client → server events (persisted chat)

| Event | Payload (JSON) | Notes |
|--------|----------------|--------|
| `joinConversation` | `{ "conversationId": "<uuid>" }` | Must be a member; join room `conv:<id>`. |
| `leaveConversation` | `{ "conversationId": "<uuid>" }` | |
| `sendMessage` | `{ "conversationId", "content"?, "type"?, "fileUrl"? }` | `type`: `TEXT`, `IMAGE`, `VIDEO`, `FILE` (Prisma enum names). |
| `typing` | `{ "conversationId", "typing": true/false }` | Throttled server-side (~3s). |
| `markRead` | `{ "conversationId", "lastReadMessageId" }` | Triggers `readReceipt` to room. |
| `presenceHeartbeat` | `{}` or `{ "clientTime": "..." }` | Refresh Redis presence (~every 30s). |

### Tickets (WebSocket)

| Event | Payload |
|--------|---------|
| `joinTicket` | `{ "ticketId": "<uuid>" }` |
| `sendTicketMessage` | `{ "ticketId", "content"?, "fileUrl"? }` |

### Legacy 1:1 ephemeral chat

| Event | Payload |
|--------|---------|
| `send_message` | `{ "recipientId", "content" }` |
| `send_message` (extended) | Include `"conversationId"` to route through persisted chat (non-guest). |

Guest connections are **disabled in production** unless `ALLOW_CHAT_GUEST=true`.

## REST: conversations (`/chat/...`)

All require Bearer auth.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chat/conversations` | List conversations for current staff (+ unread counts). |
| POST | `/chat/conversations/direct` | Body `{ "otherStaffId" }` — get or create direct thread. |
| POST | `/chat/conversations/group` | Body `{ "name", "memberStaffIds" }`. |
| GET | `/chat/conversations/:id` | Details + members. |
| PATCH | `/chat/conversations/:id/rename` | Group rename (admin / super admin). |
| POST | `/chat/conversations/:id/members` | Body `{ "staffId" }`. |
| DELETE | `/chat/conversations/:id/members/:staffId` | |
| POST | `/chat/conversations/:id/admins` | Body `{ "staffId" }` — promote. |
| GET | `/chat/conversations/:id/messages?cursor=&limit=` | Cursor = message id; default limit 30. |
| POST | `/chat/conversations/:id/messages` | Send without WebSocket. |
| POST | `/chat/conversations/:id/read` | Body `{ "lastReadMessageId" }`. |
| GET | `/chat/online-users` | In-memory connected sockets (legacy). |
| GET | `/chat/presence/roster` | Redis-backed online staff + presence fields. |

## REST: file upload (local disk)

| Method | Path | Body |
|--------|------|------|
| POST | `/chat/upload/conversation/:conversationId` | `multipart/form-data` field `file`. |
| POST | `/chat/upload/ticket/:ticketId` | Same. |

Response includes `fileUrl` (relative path under `uploads/`) and `downloadUrl`. Store `fileUrl` on the message when calling `sendMessage` or REST send.

### Download (authenticated)

- By message: `GET /chat/files/conversation-message/:messageId` (after message saved).
- Before message exists: `GET /chat/files/conversation-message/by-path?path=<url-encoded relative path>`  
  Same pattern for tickets: `/chat/files/ticket-message/...`

Use the same `Authorization` header as other APIs.

## REST: support tickets (`/tickets`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tickets` | Body `{ "title" }`. |
| GET | `/tickets?status=&assignedToMe=` | Filters optional. |
| GET | `/tickets/:id` | Detail, messages, audit log. |
| GET | `/tickets/:id/messages` | Thread only. |
| POST | `/tickets/:id/messages` | Body `{ "content"?, "fileUrl"? }`. |
| PATCH | `/tickets/:id/status` | Body `{ "status": "OPEN" \| "IN_PROGRESS" \| "RESOLVED" }`. |
| POST | `/tickets/:id/assign` | Body `{ "staffId" }`. |
| POST | `/tickets/:id/unassign` | Body `{ "staffId" }`. |

## Suggested Flutter state

1. After login, open Socket.IO with token; on app resume refresh token if you refresh JWT.
2. **Conversations list**: poll or subscribe; merge `receiveMessage` into active thread; use `cursor` pagination for history.
3. **Optimistic send**: show pending row, confirm on `message_sent` or roll back on `chat_error`.
4. **Presence**: call `presenceHeartbeat` every 30s while foregrounded; listen to `presenceUpdate` for roster badges.
5. **Unread**: server maintains unread counters (Redis when `USE_REDIS=true`, otherwise in-process); `GET /chat/conversations` includes `unreadCount`; cleared on `POST .../read` or socket `markRead`.
6. **Tickets**: `joinTicket` when opening a ticket; append `ticketMessage` / `ticketMessageSent`.

## Redis and horizontal scaling

Set **`USE_REDIS=true`** and **`REDIS_URL`** (e.g. `redis://127.0.0.1:6379`) when you want Redis-backed presence/unread and the Socket.IO Redis adapter so multiple Nest instances share rooms and presence.

If **`USE_REDIS` is not `true`** (including unset), the server does **not** connect to Redis: presence and unread live in the Node process memory, and Socket.IO uses the default in-memory adapter only. That is fine for a **single** Nest process (e.g. one hospital server). It does **not** sync across multiple app replicas behind a load balancer—enable Redis for that case.

## Error handling

- HTTP 401: refresh or re-login.
- HTTP 403: not a member / no ticket access.
- WebSocket `chat_error`: show `message` to the user.
