# Prompt 05: Zero-Trust Network Policy

## Context

Zero-trust means: no service trusts another by default. Every inter-service call is
authenticated and authorized. Currently the Carina core, ops panel, Scout, and Hub
communicate without mutual authentication. A compromised ops panel could impersonate
Carina core with no detection.

## What to Build

### 1. mTLS between services

All inter-service communication uses mutual TLS. Each service presents a certificate that
is verified by the receiving service.

Create `docker/certs/generate.sh`:
```bash
#!/usr/bin/env bash
# Generate CA and per-service certificates for mTLS

CERTS_DIR="$(dirname "$0")"
mkdir -p "$CERTS_DIR"

# Generate CA
openssl genrsa -out "$CERTS_DIR/ca.key" 4096
openssl req -new -x509 -days 3650 -key "$CERTS_DIR/ca.key" \
  -subj "/CN=Carina Internal CA/O=VERLOX/C=GB" \
  -out "$CERTS_DIR/ca.crt"

# Generate per-service certs
for SERVICE in core ops scout hub; do
  openssl genrsa -out "$CERTS_DIR/$SERVICE.key" 2048
  openssl req -new -key "$CERTS_DIR/$SERVICE.key" \
    -subj "/CN=carina-$SERVICE/O=VERLOX/C=GB" \
    -out "$CERTS_DIR/$SERVICE.csr"
  openssl x509 -req -days 365 \
    -in "$CERTS_DIR/$SERVICE.csr" \
    -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -CAcreateserial \
    -out "$CERTS_DIR/$SERVICE.crt"
done
```

### 2. Express mTLS configuration

In `src/server.ts`, enable mTLS if certs are configured:
```typescript
import { readFileSync } from 'fs';
import { createServer } from 'https';

const tlsCertsDir = process.env.TLS_CERTS_DIR;
if (tlsCertsDir) {
  const server = createServer({
    ca: readFileSync(`${tlsCertsDir}/ca.crt`),
    cert: readFileSync(`${tlsCertsDir}/core.crt`),
    key: readFileSync(`${tlsCertsDir}/core.key`),
    requestCert: true,    // require client cert
    rejectUnauthorized: true,  // reject if not signed by CA
  }, app);
  server.listen(port);
} else {
  app.listen(port);
}
```

### 3. Service identity middleware

Create `src/security/service-identity.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';

// Inter-service calls must present a certificate where CN matches an allowed service name
export function requireServiceIdentity(allowedServices: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const cert = req.socket && 'getPeerCertificate' in req.socket
      ? (req.socket as any).getPeerCertificate()
      : null;

    if (!cert?.subject?.CN) {
      res.status(401).json({ error: 'Service identity required' });
      return;
    }

    if (!allowedServices.includes(cert.subject.CN)) {
      res.status(403).json({ error: `Service ${cert.subject.CN} not authorized` });
      return;
    }

    next();
  };
}
```

Apply to ops-gated routes:
```typescript
app.use('/api/ops/', requireServiceIdentity(['carina-ops']));
```

### 4. Network policy for Docker

In `docker-compose.prod.yml`, create isolated networks:
```yaml
networks:
  frontend:     # nginx - accessible from internet
    driver: bridge
  backend:      # carina-core, postgres, redis - internal only
    driver: bridge
    internal: true  # no internet access
  scout-net:    # carina-core - scout communication
    driver: bridge
    internal: true

services:
  nginx:
    networks: [frontend, backend]
  carina-core:
    networks: [backend, scout-net]
  postgres:
    networks: [backend]
  redis:
    networks: [backend]
  scout:
    networks: [scout-net]
```

Services not listed in a network cannot communicate with each other.

### 5. Outbound allowlist

Create `src/security/network-policy.ts`:
```typescript
// Domains carina-core is allowed to call outbound
export const ALLOWED_OUTBOUND = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.deepseek.com',
  'api.resend.com',
  // add other providers
]);

export function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_OUTBOUND.has(hostname);
  } catch {
    return false;
  }
}
```

Wrap all outbound `fetch` calls with this check. Blocked calls go to Scout as `network.blocked` events.

## Verification Checklist

- [ ] Service without certificate gets 401 from ops-gated route
- [ ] Service with wrong CN gets 403 from ops-gated route
- [ ] Docker postgres container is unreachable from the host network (internal: true)
- [ ] Outbound call to disallowed domain is blocked and logged to Scout
- [ ] `bash docker/certs/generate.sh` creates certs for all 4 services

## Files to Create or Modify

- CREATE `docker/certs/generate.sh`
- MODIFY `src/server.ts` - add mTLS server creation
- CREATE `src/security/service-identity.ts`
- CREATE `src/security/network-policy.ts`
- MODIFY `docker-compose.prod.yml` - add network isolation
