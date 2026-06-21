# Prompt 05: Zero-Trust Network Architecture

**Gap:** 08; Enterprise Security | **Priority:** MEDIUM | **Build Time:** 1 week
**Depends On:** gap-01 (Docker)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## GOAL

Carina's internal services must communicate over mutually authenticated TLS (mTLS) with SPIFFE-based workload identities. No service trusts any other service by default. Every connection is authenticated, authorized, and encrypted.

## ARCHITECTURE

```
┌────────────────────────────────────────────────────────────┐
│                   Carina Service Mesh                       │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Gateway  │  │ Agent    │  │ Scout    │  │ Web UI   │  │
│  │ :443     │  │ Core     │  │ Engine   │  │ :3000    │  │
│  │ mTLS     │  │ :4444    │  │ :5555    │  │          │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │       │
│       ▼              ▼              ▼              ▼       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SPIFFE Workload API                      │  │
│  │  • Issues X.509 SVIDs to each service                │  │
│  │  • Rotates certificates every 1 hour                  │  │
│  │  • Trust bundle updated automatically                 │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │              Network Policies (Cilium/eBPF)           │  │
│  │  • Gateway → Agent Core: ALLOW :4444                  │  │
│  │  • Agent Core → Scout Engine: ALLOW :5555             │  │
│  │  • Scout Engine → PostgreSQL: ALLOW :5432             │  │
│  │  • Agent Core → Internet: DENY (except API providers) │  │
│  │  • All other: DENY                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## IMPLEMENTATION

### Docker Compose with mTLS

```yaml
# docker-compose.yml

services:
  spire-server:
    image: ghcr.io/spiffe/spire-server:latest
    volumes:
      - spire-data:/data
    environment:
      - SPIRE_SERVER_TRUST_DOMAIN=carina.ai
    networks:
      - carina-mesh

  spire-agent:
    image: ghcr.io/spiffe/spire-agent:latest
    depends_on: [spire-server]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - spire-sockets:/spire-agent-socket
    networks:
      - carina-mesh

  carina-gateway:
    image: carina-gateway:latest
    depends_on: [spire-agent]
    environment:
      - SPIFFE_ENDPOINT_SOCKET=unix:///spire-agent-socket/agent.sock
      - TLS_CERT=/certs/gateway.crt
      - TLS_KEY=/certs/gateway.key
      - CA_BUNDLE=/certs/ca-bundle.crt
    volumes:
      - spire-sockets:/spire-agent-socket
      - certs-gateway:/certs
    ports:
      - "443:443"
    networks:
      - carina-mesh

  carina-core:
    image: carina-core:latest
    depends_on: [spire-agent]
    environment:
      - SPIFFE_ENDPOINT_SOCKET=unix:///spire-agent-socket/agent.sock
      - TLS_CERT=/certs/core.crt
      - TLS_KEY=/certs/core.key
      - CA_BUNDLE=/certs/ca-bundle.crt
    volumes:
      - spire-sockets:/spire-agent-socket
      - certs-core:/certs
    networks:
      - carina-mesh

networks:
  carina-mesh:
    driver: bridge

volumes:
  spire-data:
  spire-sockets:
  certs-gateway:
  certs-core:
```

### Network Policy

```yaml
# network-policy.yaml (Cilium)
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: carina-zero-trust
spec:
  endpointSelector:
    matchLabels:
      app: carina
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: carina-gateway
      toPorts:
        - ports:
            - port: "4444"
              protocol: TCP
  egress:
    - toEndpoints:
        - matchLabels:
            app: carina-scout
      toPorts:
        - ports:
            - port: "5555"
              protocol: TCP
    - toEndpoints:
        - matchLabels:
            app: postgres
      toPorts:
        - ports:
            - port: "5432"
              protocol: TCP
    # DENY all other egress
```

### mTLS Helper

```typescript
// src/enterprise/zero-trust/mtls.ts

import * as tls from 'tls';
import * as fs from 'fs';

async function createMTLSServer(certPath: string, keyPath: string, caPath: string) {
  return tls.createServer({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    ca: fs.readFileSync(caPath),
    requestCert: true,
    rejectUnauthorized: true, // Require valid client certificate
    minVersion: 'TLSv1.3',
  });
}

async function createMTLSClient(serviceName: string) {
  const svid = await getSPIFFESVID(serviceName);
  return {
    cert: svid.cert,
    key: svid.key,
    ca: svid.bundle,
    rejectUnauthorized: true,
  };
}
```

### Pitfalls
1. **Certificate rotation**; 1-hour expiry means rotation failures = outage. Monitor aggressively.
2. **SPIRE SPOF**; If SPIRE server is down, no new SVIDs can be issued. Run HA (3 nodes).
3. **Debugging**; mTLS makes `curl` debugging harder. Provide `--insecure` flag for dev mode only.
4. **Performance**; TLS handshake overhead is negligible (~1ms). Don't over-optimize.

Verify: `openssl s_client -connect carina-core:4444 -cert /certs/client.crt -key /certs/client.key -CAfile /certs/ca.crt`
