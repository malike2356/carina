# Prompt 07 - Images Gallery + Editor (Cloud)

## Objective

Add `/images` to Carina Cloud: browse generated images, generate new, basic edit actions (inpaint/remove-bg) via core `images-api` (O6).

PewDiePie mentions image editor as part of the unified workspace. Property users may use it for listing photos.

---

## Context

**Core:** `images-api.ts`, image-generation tool.

**Cloud:** No images route.

---

## Step 1 - Schema

```ts
export const workspaceImages = pgTable('workspace_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  title: text('title'),
  prompt: text('prompt'),
  storagePath: text('storage_path').notNull(), // S3 or local path via core
  mimeType: text('mime_type').notNull().default('image/png'),
  width: integer('width'),
  height: integer('height'),
  tags: jsonb('tags').$type<string[]>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

Use core for actual file storage; cloud stores metadata + signed URL from core.

---

## Step 2 - API

```
GET  /api/images
POST /api/images/generate   - { prompt, size? }
POST /api/images/[id]/edit  - { action: 'remove_bg' | 'inpaint', mask?: base64 }
GET  /api/images/[id]/file  - proxy signed URL or stream from core
```

All call core internal images API with `x-internal-key`.

---

## Step 3 - UI `/images`

- Masonry gallery grid with lazy load
- Click opens lightbox + sidebar: prompt, tags, Download, Edit
- Generate modal: prompt input, Generate button, progress spinner
- Edit panel (v1): Remove background button; inpaint deferred if core not ready

Sidebar link: Gallery (or Images).

---

## Acceptance criteria

- [ ] Generate creates image and appears in gallery.
- [ ] Download works.
- [ ] Remove-bg returns updated image when core supports it.
- [ ] Empty state with CTA to generate first image.
