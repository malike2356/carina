# GET /api/stream

Server-Sent Events feed for the live dashboard.

## Request

```
GET /api/stream
```

No API key required on the SSE endpoint itself (protect at the network edge in production).

## Response

`Content-Type: text/event-stream`

### Initial message

```
data: {"type":"heartbeat"}
```

### Event message

When an event is inserted or published to Redis:

```
data: {"type":"event","data":{...SecurityEventRow}}
```

### Stats refresh

After critical, warning, or breach events:

```
data: {"type":"stats","data":{"critical":1,"warning":4,"info":120,"breach":0}}
```

### Keep-alive

Every 30 seconds:

```
data: {"type":"heartbeat"}
```

## Client example

```javascript
const es = new EventSource('http://localhost:4444/api/stream');
es.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'event') console.log(msg.data);
};
```

## Redis backplane

Scout subscribes to `scout:events` on startup. Multiple Scout processes can share one Redis; all SSE clients receive broadcasts.

If Redis is down, events still persist to Postgres but live updates may not propagate until Redis recovers.
