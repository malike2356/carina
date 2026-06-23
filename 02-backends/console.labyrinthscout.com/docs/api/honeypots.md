# Honeypots API

Manage and check deception assets. All routes require `X-Scout-Key`.

## List honeypots

```
GET /api/honeypots?instance_id=carina-prod
```

**200 OK**

```json
{
  "honeypots": [
    {
      "id": "uuid",
      "type": "api_key",
      "keyType": "openai",
      "createdAt": "2026-06-04T10:00:00.000Z"
    }
  ]
}
```

## Create honeypot

```
POST /api/honeypots
Content-Type: application/json
```

### API key honeypot

```json
{
  "instanceId": "carina-prod",
  "type": "api_key",
  "keyType": "openai"
}
```

Server generates a decoy key value returned once in the response.

### File path honeypot

```json
{
  "instanceId": "carina-prod",
  "type": "file_path",
  "path": "/home/deploy/secrets/decoy.env"
}
```

## Check key (agent runtime)

```
POST /api/honeypots/check/key
```

```json
{
  "key": "sk-...",
  "meta": { "tool": "http-request" }
}
```

**200 OK**

```json
{ "matched": true }
```

When `matched` is true, agents should abort and report a breach event.

## Check path (agent runtime)

```
POST /api/honeypots/check/path
```

```json
{
  "path": "/home/deploy/secrets/decoy.env",
  "meta": { "tool": "file-read" }
}
```

## Delete

```
DELETE /api/honeypots/:id
```

Removes the honeypot record for the instance.

See [Honeypots](/security/honeypots) for operational guidance.
