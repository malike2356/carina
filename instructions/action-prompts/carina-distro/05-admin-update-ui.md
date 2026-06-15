# Carina Distro Prompt 05: Admin notification and controlled update flow

## Goal

Surface Carina update notifications in the ABBIS admin dashboard. The ABBIS admin sees a
banner when a new Carina version is available, can view the changelog, acknowledge the
notification, and follow a documented manual update procedure.

There is no "one-click update" button that mutates the running production server. Updates
are always: read changelog, bump version in code, run tests, deploy via the normal
deployment pipeline. The UI makes this flow clear; it does not attempt to automate it.

## Context

When prompt 04 detects a new Carina version, it writes a record to `system_notifications`.
This prompt adds:

1. A REST API endpoint to list and acknowledge admin notifications
2. A React notification banner component on the ABBIS admin dashboard
3. A changelog and update instructions modal
4. A documented manual update procedure (as a markdown file for the team)

The admin dashboard is the route `/admin` inside the `apps/web/` React app. Only users
with `role: 'admin'` can see this route.

## Dependencies

`04-version-check-job.md`, `00-distro-workspace-scaffold.md`

## Files to create

```
abbis/apps/api/src/routes/admin/notifications.ts
abbis/apps/web/src/components/admin/CarinaUpdateBanner.tsx
abbis/apps/web/src/components/admin/CarinaUpdateModal.tsx
abbis/apps/web/src/hooks/useAdminNotifications.ts
abbis/docs/carina-update-procedure.md
```

## Step-by-step

### 1. Notifications API

`abbis/apps/api/src/routes/admin/notifications.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { systemNotifications } from '@abbis/db/schema/notifications.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAdmin } from '../../middleware/require-admin.js';

const router = Router();

router.use(requireAdmin);

// List unacknowledged notifications
router.get('/', async (_req, res) => {
  const rows = await db
    .select()
    .from(systemNotifications)
    .where(eq(systemNotifications.acknowledged, false))
    .orderBy(desc(systemNotifications.createdAt));
  res.json(rows);
});

// Acknowledge a notification
router.post('/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  const updated = await db
    .update(systemNotifications)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(systemNotifications.id, id),
        eq(systemNotifications.acknowledged, false),
      ),
    )
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: 'Notification not found or already acknowledged' });
    return;
  }

  res.json({ ok: true });
});

// Trigger manual version check
router.post('/carina/check-version', async (_req, res) => {
  const { runCarinaVersionCheck } = await import('../../jobs/carina-version-check.js');
  await runCarinaVersionCheck();
  res.json({ ok: true });
});

export default router;
```

Register in main router:
```typescript
import notificationsRouter from './routes/admin/notifications.js';
app.use('/api/admin/notifications', notificationsRouter);
```

### 2. React hook

`abbis/apps/web/src/hooks/useAdminNotifications.ts`:
```typescript
import { useEffect, useState, useCallback } from 'react';

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
  acknowledged: boolean;
  createdAt: string;
};

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as AdminNotification[];
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch_();
    const interval = setInterval(fetch_, 60_000);
    return () => clearInterval(interval);
  }, [fetch_]);

  const acknowledge = useCallback(async (id: string) => {
    await fetch(`/api/admin/notifications/${id}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, loading, acknowledge };
}
```

### 3. Update banner component

`abbis/apps/web/src/components/admin/CarinaUpdateBanner.tsx`:
```tsx
import { useState } from 'react';
import type { AdminNotification } from '../../hooks/useAdminNotifications.js';
import CarinaUpdateModal from './CarinaUpdateModal.js';

type Props = {
  notification: AdminNotification;
  onAcknowledge: (id: string) => void;
};

export default function CarinaUpdateBanner({ notification, onAcknowledge }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (notification.type !== 'carina_update_available') return null;

  return (
    <>
      <div
        role="alert"
        style={{
          background: '#1a2233',
          border: '1px solid #3a4a6a',
          borderRadius: 6,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <span style={{ color: '#7ec8f0', fontWeight: 600 }}>
          {notification.title}
        </span>
        <span style={{ color: '#a0aab4', flexGrow: 1, fontSize: 14 }}>
          {notification.message}
        </span>
        {notification.actionUrl && (
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid #3a4a6a',
              color: '#7ec8f0',
              padding: '4px 12px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {notification.actionLabel ?? 'View details'}
          </button>
        )}
        <button
          onClick={() => onAcknowledge(notification.id)}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a0aab4',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          x
        </button>
      </div>

      {modalOpen && (
        <CarinaUpdateModal
          notification={notification}
          onClose={() => setModalOpen(false)}
          onAcknowledge={() => {
            onAcknowledge(notification.id);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
```

### 4. Update modal

`abbis/apps/web/src/components/admin/CarinaUpdateModal.tsx`:
```tsx
import type { AdminNotification } from '../../hooks/useAdminNotifications.js';

type Props = {
  notification: AdminNotification;
  onClose: () => void;
  onAcknowledge: () => void;
};

export default function CarinaUpdateModal({
  notification,
  onClose,
  onAcknowledge,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#0f1724',
          border: '1px solid #3a4a6a',
          borderRadius: 8,
          padding: 24,
          width: 480,
          maxWidth: '90vw',
        }}
      >
        <h2 style={{ color: '#fff', marginTop: 0 }}>{notification.title}</h2>

        <p style={{ color: '#a0aab4', lineHeight: 1.6 }}>{notification.message}</p>

        <div
          style={{
            background: '#1a2233',
            borderRadius: 6,
            padding: 16,
            marginTop: 16,
          }}
        >
          <p style={{ color: '#7ec8f0', fontWeight: 600, margin: '0 0 8px' }}>
            How to update
          </p>
          <ol style={{ color: '#a0aab4', margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Read the changelog at the link below</li>
            <li>In the ABBIS repo, open <code>apps/carina/package.json</code></li>
            <li>Update <code>"carina-agent"</code> to the new version number</li>
            <li>Run <code>pnpm install</code> and commit <code>pnpm-lock.yaml</code></li>
            <li>Run tests: <code>pnpm test</code></li>
            <li>Deploy via your normal pipeline</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #3a4a6a',
              color: '#a0aab4',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {notification.actionUrl && (
            <a
              href={notification.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#1a4a8a',
                border: 'none',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              View changelog
            </a>
          )}
          <button
            onClick={onAcknowledge}
            style={{
              background: 'transparent',
              border: '1px solid #3a4a6a',
              color: '#a0aab4',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Mark as seen
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5. Wire into admin layout

In the admin layout component, fetch notifications and render banners:
```tsx
import { useAdminNotifications } from '../hooks/useAdminNotifications.js';
import CarinaUpdateBanner from '../components/admin/CarinaUpdateBanner.js';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { notifications, acknowledge } = useAdminNotifications();

  return (
    <div>
      <AdminNav />
      <main>
        {notifications.map((n) => (
          <CarinaUpdateBanner
            key={n.id}
            notification={n}
            onAcknowledge={acknowledge}
          />
        ))}
        {children}
      </main>
    </div>
  );
}
```

### 6. Manual update procedure document

`abbis/docs/carina-update-procedure.md`:
```markdown
# Carina Update Procedure

When the ABBIS dashboard shows a Carina update notification, follow these steps.

## Before updating

1. Read the Carina changelog at carinaai.uk/releases for the new version
2. Check if the update contains breaking changes to the agent API
3. Confirm the borehole-africa pack is compatible with the new Carina version
4. Schedule the update during a low-traffic window (early morning Ghana time)

## Update steps

1. In the ABBIS repo, edit apps/carina/package.json:
   Change "carina-agent": "X.Y.Z" to the new version

2. Run pnpm install from the repo root:
   pnpm install

3. Commit the lockfile:
   git add apps/carina/package.json pnpm-lock.yaml
   git commit -m "chore(carina): update carina-agent to vX.Y.Z"

4. Run the full test suite:
   pnpm test

5. Deploy using the normal ABBIS deployment pipeline

6. After deployment, verify:
   curl https://abbis360.com/api/health/carina
   Response should show "healthy"

7. In the ABBIS admin dashboard, acknowledge the update notification

## Rollback

If the new version causes issues:
1. Revert the version in apps/carina/package.json to the previous version
2. Run pnpm install
3. Commit and deploy
The previous version code is always in git history; rollback takes minutes.
```

## Expected behavior

- Admin logs into ABBIS dashboard
- If a Carina update is available: yellow/blue banner appears at the top of every admin page
- Admin clicks "View details": modal opens with message, instructions, and changelog link
- Admin reads changelog externally, then follows the update procedure document
- After deploying the update, admin clicks "Mark as seen" to dismiss the notification
- Banner disappears; system_notifications row is marked acknowledged

## Test

```bash
# Insert a test notification directly:
psql $DATABASE_URL -c "
INSERT INTO system_notifications (type, title, message, action_label, action_url)
VALUES (
  'carina_update_available',
  'Carina 9.9.9 is available',
  'Test notification. Your instance runs 0.1.1.',
  'View changelog',
  'https://carinaai.uk/releases/9.9.9'
);"

# Check API returns it:
curl http://localhost:3000/api/admin/notifications \
  -H "Authorization: Bearer <admin_token>"

# Open admin dashboard - banner should appear
# Acknowledge:
curl -X POST http://localhost:3000/api/admin/notifications/<id>/acknowledge \
  -H "Authorization: Bearer <admin_token>"

# Check it is gone from the list
curl http://localhost:3000/api/admin/notifications \
  -H "Authorization: Bearer <admin_token>"
# should return []
```

## Pitfalls

- The notification poll interval in `useAdminNotifications` is 60 seconds; this means a
  newly created notification may take up to 60 seconds to appear in the dashboard without
  a page refresh. This is acceptable.
- "Mark as seen" does NOT mean "updated". Make clear in UI copy that acknowledging
  the notification does not update Carina. Update is a separate manual action.
- The modal's update instructions are duplicated from `docs/carina-update-procedure.md`.
  Keep them in sync. If the procedure changes, update both.
- Do not add a "Update now" button that runs shell commands. That path introduces remote
  code execution risk and hides what is changing. The manual process is safer and auditable.
