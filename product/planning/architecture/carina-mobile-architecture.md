# Carina Mobile App; Complete Architecture Blueprint

**Version:** 1.0.0  
**Date:** 2025-06-05  
**Status:** Architecture scoping (pre-build)  
**Purpose:** Blueprint for the build agent to implement a Carina-native mobile application. Carina is an AI property assistant that helps investors manage their portfolio, check compliance, analyse floor plans, receive daily briefings, and communicate via text and voice.

> **Constraint:** All API communication MUST use the existing `mobile/v1` endpoints in `routes/api.php`. Do NOT design new APIs. Do NOT change the backend. The mobile app is a client of what already exists.

---

## Table of Contents

1. [Tech Stack Recommendation](#1-tech-stack-recommendation)
2. [Screen Map](#2-screen-map)
3. [Navigation Structure](#3-navigation-structure)
4. [State Management](#4-state-management)
5. [API Integration Layer](#5-api-integration-layer)
6. [Offline Support](#6-offline-support)
7. [Push Notifications](#7-push-notifications)
8. [Camera & Voice](#8-camera--voice)
9. [TTS / Audio Playback](#9-tts--audio-playback)
10. [Build & Distribution](#10-build--distribution)
11. [File Structure](#11-file-structure)
12. [Build Estimate & Timeline](#12-build-estimate--timeline)

---

## 1. Tech Stack Recommendation

### Compared Options

| Criterion | React Native (Expo) | Flutter | Native (Swift/Kotlin) |
|---|---|---|---|
| **Developer availability** | High; large JS/TS talent pool | Medium; Dart is niche | Low; needs two specialised teams |
| **Time to market** | Fast; single codebase, Expo OTA updates | Fast; single codebase | Slowest; two separate codebases |
| **Existing API compatibility** | Excellent; JS fetch, JSON, SSE streaming | Good; dart:io HTTP client | Good; URLSession / OkHttp |
| **Offline support** | AsyncStorage, NetInfo, SQLite via expo-sqlite | Hive/sqlite via sqflite | CoreData / Room |
| **Camera integration** | expo-camera, expo-image-picker | camera plugin | AVCaptureSession / CameraX |
| **Voice / audio** | expo-av (recording + playback) | record + audioplayers | AVAudioEngine / MediaRecorder |
| **Push notifications** | expo-notifications (FCM + APNs via Expo) | firebase_messaging | Direct FCM/APNs |
| **CI/CD maturity** | EAS Build, CodePush/Expo Updates | Codemagic, Fastlane | Xcode Cloud, GitHub Actions |
| **Backend alignment** | The existing v2 mobile app ALREADY uses Expo SDK 54 | No existing codebase | No existing codebase |

### Recommendation: React Native with Expo (Expo SDK 54 + Expo Router v6)

**Primary reasons:**

1. **Existing precedent:** The Propreneur v2 mobile app (`propreneur-mobile/v2`) already uses this exact stack. The Carina app can share setup, design tokens, auth patterns, and CI infrastructure.

2. **SSE streaming:** The Carina API streams responses via `text/event-stream`. React Native's `fetch` with `ReadableStream` reader works cleanly for progressive text rendering in chat; this is critical for the Carina chat experience.

3. **Expo managed workflow:** `expo-camera`, `expo-av`, `expo-notifications`, `expo-image-picker`, `expo-document-picker`, `@react-native-community/netinfo` all provide native capabilities without ejecting.

4. **OTA updates:** `expo-updates` allows pushing JS bundles directly; critical for rapid Carina persona/prompt iterations without App Store review.

5. **Single codebase for iOS + Android** with platform-specific tweaks where needed (e.g., APNs vs FCM tokens).

**Stack details:**

| Concern | Choice |
|---|---|
| Framework | Expo SDK 54 + Expo Router v6 (file-based routing) |
| Language | TypeScript 5.9 (strict mode) |
| UI rendering | React 19.1.0 |
| State / data fetching | TanStack Query v5 (server cache) + React Context (auth/device) |
| Styling | React Native `StyleSheet` (no Tailwind/NativeWind) |
| Auth token storage | `expo-secure-store` |
| Local persistence | `@react-native-async-storage/async-storage` |
| Networking | Sanctum Bearer token + `Accept: application/json` |
| Icons | `@expo/vector-icons` (Ionicons) |
| Push notifications | `expo-notifications` (Expo push service → FCM/APNs) |
| Audio recording | `expo-av` (Audio.Recording) |
| Audio playback | `expo-av` (Audio.Sound) for TTS MP3s and voice message playback |
| Camera | `expo-camera` / `expo-image-picker` |
| File picker | `expo-document-picker` |
| Crash reporting | Custom `POST /api/v1/mobile/crash-report` |
| Offline detection | `@react-native-community/netinfo` |

---

## 2. Screen Map

### 2.1 Onboarding / Auth Flow

```
sign-in.tsx          →  Login form (workspace slug + email + password)
                        POST /api/mobile/v1/auth/login
                        2FA gate: if response returns two_factor_required, show web redirect notice
                        On success: store token → register device → register push token → navigate to tabs
```

**Screens:**

- **`app/sign-in.tsx`**; Workspace slug input, email, password. "Sign in" button. Error states for invalid credentials, disabled account, unverified email, 2FA required. Link to download new APK version.

- **`app/_layout.tsx` (root)**; Auth gate: check SecureStore for token. If present, validate via `GET /api/mobile/v1/user/profile`. If valid, route to tabs. If invalid/expired, clear and show sign-in.

> **Note:** The existing legacy `POST /api/mobile/v1/auth/login` returns `token`, `token_type`, and `user` object. There is no explicit refresh token endpoint in the legacy routes; token expiry is handled by Sanctum's built-in token lifetime. If the token expires, the user re-authenticates. The V1 routes do have `POST /api/v1/mobile/auth/refresh`, but the Carina app uses the legacy `mobile/v1` namespace. For Phase 1, implement re-login on 401.

### 2.2 Main Tabs (Bottom Tab Bar)

```
(tabs)/
  _layout.tsx        →  Tab navigator (3 tabs; see Navigation section)
  index.tsx          →  Home / Dashboard
  carina.tsx         →  Chat with Carina
  settings.tsx       →  Settings / Profile
```

### 2.3 Home / Dashboard (`app/(tabs)/index.tsx`)

**Purpose:** The first screen after login. A personalised greeting + portfolio snapshot.

**Sections (scrollable):**

1. **Greeting header**; "Good morning, {user.name}" (time-aware). Below it: portfolio summary stat line; "X properties · £Y rent · Z% occupied".

2. **Daily briefing card**; Pulled from `GET /api/mobile/v1/briefing/latest`. Shows the briefing text (collapsed to 3 lines with "Read more" expand). If `has_audio: true`, show a play button (streams `GET /api/mobile/v1/briefing/audio`). If no briefing available (`available: false`), show "No briefing yet; Carina will prepare one soon."

3. **Compliance status chip**; Pulled from `GET /api/mobile/v1/compliance/status`. Green / amber / red dot + "X items need attention" or "All clear". Tap → navigates to compliance list (modal or standalone screen).

4. **Quick actions row**; Icon buttons: "Ask Carina", "My Properties", "Upload Floor Plan", "Voice Note".

5. **Recent properties** (3-5); Pulled from `GET /api/mobile/v1/portfolio/properties`. Horizontal scroll of property cards. Each shows address, type, monthly rent, tenant name.

**Data dependencies:** `GET /api/mobile/v1/user/profile`, `GET /api/mobile/v1/portfolio/summary`, `GET /api/mobile/v1/briefing/latest`, `GET /api/mobile/v1/compliance/status`, `GET /api/mobile/v1/portfolio/properties`

### 2.4 Carina Chat (`app/(tabs)/carina.tsx` and `app/carina/[id].tsx`)

**Purpose:** The core interaction surface; text chat with Carina.

**Conversation list screen (`app/(tabs)/carina.tsx`):**
- FlatList of past conversations. Each row: title, last message preview (truncated), timestamp.
- Empty state: "No conversations yet. Tap + to start chatting with Carina."
- FAB (+) at bottom-right → starts a new conversation (no API call until first message).
- Tap row → navigates to `app/carina/[id].tsx`.
- Swipe left → delete confirmation (calls mobile chat API with conversation context; the legacy `POST /api/mobile/v1/chat/send` accepts `conversation_id` to continue a conversation; the app maintains local conversation grouping).

**Chat screen (`app/carina/[id].tsx`):**
- Message thread; user messages right-aligned (blue bubble), Carina messages left-aligned (grey bubble).
- For agent mode responses: if `requires_confirmation: true`, show Approve / Reject buttons below the message. On approve, POST the confirmation token.
- Text input bar pinned to bottom (above keyboard). Send button.
- **Voice button** (mic icon) in the input bar; hold to record, release to send.
- **Camera button** (camera icon); opens camera for floor plan / image capture.
- **Attachment button** (paperclip); picks from gallery or document picker.
- Typing indicator (animated dots) while streaming.
- Progressive text rendering; use SSE streaming or poll if SSE not available.

**API calls:**
- Send text: `POST /api/mobile/v1/chat/send`; `{ message, conversation_id? }`
- Send voice: `POST /api/mobile/v1/chat/voice`; multipart `{ audio, conversation_id? }`
- Send image: `POST /api/mobile/v1/chat/image`; multipart `{ image, property_id?, is_floor_plan?, conversation_id? }`

> **Important:** The legacy `MobileChatController::send()` builds a full message by prepending the Carina mobile persona prompt from `carina-mobile-prompts.php`. The app just sends the raw user message; the server handles persona injection. The app doesn't need to include any persona/pre-prompt.

**Agent confirmation flow:**
1. User sends message → server returns `{ reply, actions, requires_confirmation, pending_action }`.
2. If `requires_confirmation: true`, the app renders Approve/Reject buttons.
3. User taps Approve → the app sends the confirmation. (Note: the legacy `MobileChatController` doesn't have a dedicated confirm endpoint; agent confirmations are handled inline in the agent loop. The `send` method returns the full result including whether confirmation is needed. For confirmations, the app should resend with the confirmation context in the message.)

### 2.5 Portfolio Screens

**Property list (`app/portfolio/index.tsx`):**
- FlatList from `GET /api/mobile/v1/portfolio/properties?per_page=20`.
- Infinite scroll pagination.
- Each card: address, type chip, bedrooms, monthly rent, tenant name, status badge.
- Tap → `app/portfolio/[id].tsx`.
- Pull-to-refresh.

**Property detail (`app/portfolio/[id].tsx`):**
- Sections: Overview (address, type, bedrooms, bathrooms, status, strategy), Financial (monthly rent, purchase price, current value), Tenancies (list from embedded `tenancies` array), Compliance (list from embedded `compliance_items` array), Recent payments (last 12).
- "Upload Floor Plan" button → `app/camera/floor-plan.tsx` flow.
- "Ask Carina about this property" → navigates to chat with property context.

**Data source:** `GET /api/mobile/v1/portfolio/properties/{id}`; returns full property object with tenancies, compliance items, and recent payments.

### 2.6 Compliance Screens

**Compliance dashboard (`app/compliance/index.tsx`):**
- Status banner at top: green (all clear), amber (items expiring within 30 days), red (expired items).
- Count cards: Critical (expired), Warnings (expiring soon), Total items.
- Filter chips: All, Critical, Warning, Valid.
- FlatList from `GET /api/mobile/v1/compliance/items?status=...`.
- Each row: title, category, property reference, expires_at, status badge.
- Tap → detail sheet (can be a bottom sheet or standalone screen).

**Data sources:** `GET /api/mobile/v1/compliance/status`, `GET /api/mobile/v1/compliance/items`

### 2.7 Briefings

**Briefing detail / audio player:**
- Accessible from Home dashboard card "Read more" or "Play audio".
- Text view: full briefing text, generated_at date.
- Audio player: mini player bar at bottom with play/pause, progress scrubber, time remaining.
- Streams MP3 from `GET /api/mobile/v1/briefing/audio` (returns `Content-Type: audio/mpeg`).
- Uses `expo-av` `Audio.Sound` for playback.
- Background audio support (keep playing when app is backgrounded).

### 2.8 Settings (`app/(tabs)/settings.tsx`)

**Sections:**

1. **Profile;** Name, email, phone, role, properties count. Read-only (the legacy `MobileUserController::profile` returns these fields). Edit name/phone via inline form → `PUT /api/mobile/v1/preferences`.

2. **Notifications;** Toggle push notifications on/off. Re-register token on toggle.
   - Briefing time preference (`briefing_time`; stored server-side in `telegram_delivery_time`).
   - Audio briefing enabled toggle.

3. **Voice & TTS;** Toggle voice input enabled. Toggle briefing audio playback auto-play. (These are local preferences stored in AsyncStorage.)

4. **Data & Storage;** Clear cached data button. Show app version.

5. **Sign Out;** Clear SecureStore (token), navigate to sign-in.

**API calls:** `GET /api/mobile/v1/user/profile`, `PUT /api/mobile/v1/preferences`, `POST /api/mobile/v1/notifications/register`

### 2.9 Camera / Floor Plan Flow

**Standalone screens (not tabs):**

**`app/camera/floor-plan.tsx`:**
1. Camera viewfinder (using `expo-camera` or `expo-image-picker` for simplicity).
2. Capture button.
3. Preview screen: confirm or retake.
4. Optional: associate with property (dropdown from `GET /api/mobile/v1/portfolio/properties`).
5. Upload: `POST /api/mobile/v1/chat/image` with `is_floor_plan: true` and `property_id`.
6. Loading state with "Analysing floor plan..." message.
7. Result screen: Carina's analysis text. "Ask follow-up question" button → takes user to chat.

**`app/camera/photo.tsx`:**
- Similar flow but for general property photos.
- Uses same endpoint with `is_floor_plan: false`.

---

## 3. Navigation Structure

### Bottom Tab Bar (3 tabs)

| Tab | Icon | Screen | Purpose |
|---|---|---|---|
| Home | `grid` / `home` | `(tabs)/index.tsx` | Dashboard, briefing, portfolio summary, quick actions |
| Carina | `chatbubbles` | `(tabs)/carina.tsx` | Chat conversation list → conversation detail |
| Settings | `person-circle` | `(tabs)/settings.tsx` | Profile, preferences, sign out |

**Tab bar styling:**
- Background: `#0f172a` (slate-900)
- Active tint: `#0ea5e9` (sky-500)
- Inactive tint: `#94a3b8` (slate-400)
- Border top: `#1e293b` (slate-800)

### Stack Navigation (within each tab or as modals)

```
Root Stack (app/_layout.tsx)
  ├── sign-in.tsx                       [no tabs]
  └── (tabs)/                           [authenticated]
      ├── index.tsx                     → Home
      ├── carina.tsx                    → Conversation list
      │   └── carina/[id].tsx           [stack push]
      ├── settings.tsx                  → Settings
      ├── portfolio/index.tsx           [modal / stack push from Home]
      │   └── portfolio/[id].tsx        [stack push]
      ├── compliance/index.tsx          [modal / stack push from Home]
      ├── briefing/[date].tsx           [modal from Home]
      └── camera/
          ├── floor-plan.tsx            [modal from Home / Portfolio]
          └── photo.tsx                 [modal from Chat]
```

### Deep Linking

The app registers the `carina://` URL scheme.

| Deep Link | Target Screen |
|---|---|
| `carina://home` | `(tabs)/index.tsx` |
| `carina://chat` | `(tabs)/carina.tsx` |
| `carina://compliance` | `compliance/index.tsx` |
| `carina://portfolio` | `portfolio/index.tsx` |
| `carina://portfolio/{id}` | `portfolio/[id].tsx` |
| `carina://briefing` | `briefing/latest.tsx` |
| `carina://settings` | `(tabs)/settings.tsx` |

Push notification payloads include a `route` field that maps to these deep links.

---

## 4. State Management

### Architecture

```
┌─────────────────────────────────────────────────┐
│                   React Context                   │
│  ┌─────────────┐  ┌──────────────────────────┐   │
│  │ AuthContext  │  │  DeviceContext           │   │
│  │ - token      │  │  - pushToken             │   │
│  │ - user       │  │  - platform              │   │
│  │ - isAuth     │  │  - appVersion            │   │
│  └─────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────┤
│               TanStack Query v5                   │
│  Server cache for all API data                    │
│  staleTime: 5 minutes (briefings: 1 minute)     │
│  gcTime: 30 minutes                              │
├─────────────────────────────────────────────────┤
│               AsyncStorage                        │
│  - Offline message queue                          │
│  - Local preferences (voice toggle, TTS toggle)  │
│  - Cached briefing text (last N)                  │
│  - Cached conversation list                       │
└─────────────────────────────────────────────────┘
```

### Auth State (`src/context/AuthContext.tsx`)

```
Provider wraps the entire app.

State:
  token: string | null; Sanctum Bearer token
  user: UserProfile | null; from GET /api/mobile/v1/user/profile
  isLoading: boolean; true while checking SecureStore on app launch
  isAuthenticated: boolean; derived from token != null

Actions:
  login(workspace, email, password) → POST /api/mobile/v1/auth/login
  logout() → POST /api/mobile/v1/auth/logout, clear SecureStore
  refreshProfile() → GET /api/mobile/v1/user/profile

On app launch:
  1. Read token from SecureStore
  2. If token exists, fetch /user/profile to validate
  3. If 401, clear token → show sign-in
  4. If 200, set user → show tabs
```

### Conversation State (TanStack Query)

```
Query keys:
  ['conversations']              → local list (managed client-side, no server endpoint)
  ['conversation', id]           → local cached messages
  ['portfolio', 'summary']       → GET /portfolio/summary
  ['portfolio', 'properties']    → GET /portfolio/properties (infinite)
  ['portfolio', 'property', id]  → GET /portfolio/properties/{id}
  ['compliance', 'status']       → GET /compliance/status
  ['compliance', 'items', filters] → GET /compliance/items
  ['briefing', 'latest']         → GET /briefing/latest
  ['user', 'profile']            → GET /user/profile

Mutations:
  sendMessage(message, conversationId?) → POST /chat/send
  sendVoice(audioFile, conversationId?)  → POST /chat/voice
  sendImage(imageFile, props)            → POST /chat/image
  updatePreferences(data)                → PUT /preferences
  registerPushToken(token)               → POST /notifications/register
```

### Caching Strategy

| Data | Staleness | Persistence | Rationale |
|---|---|---|---|
| User profile | 10 min | Never persisted (sensitive) | Changes rarely |
| Portfolio summary | 2 min | AsyncStorage (30 min) | Dashboard needs fast load |
| Property list | 2 min | AsyncStorage (last page only) | List changes but not frequently |
| Property detail | 5 min | AsyncStorage (per property, 10 min) | Heavy payload, rarely changes |
| Compliance status | 1 min | None | Needs to be fresh |
| Compliance items | 1 min | AsyncStorage (last fetch, 5 min) | Needs freshness but offline fallback |
| Briefing | 30 sec | AsyncStorage (last briefing, keep) | Changes daily, offline-read is key |
| Conversations | N/A | AsyncStorage (all messages, persistent) | Chat history is critical offline |
| Chat messages | N/A | AsyncStorage (appended, persistent) | Must survive app restart |

---

## 5. API Integration Layer

### Base URL

Resolved from workspace slug entered at login. Format: `https://{workspace}.propreneur.uk/api/mobile/v1`

A local config file (`src/config/workspace.ts`) stores the workspace origin after login.

### HTTP Client (`src/api/client.ts`)

```typescript
// Centralised fetch wrapper
async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await SecureStore.getItemAsync('propreneur_carina_token');
  const baseUrl = await getWorkspaceOrigin();

  const res = await fetch(`${baseUrl}/api/mobile/v1${path}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token expired; clear and redirect to sign-in
    await SecureStore.deleteItemAsync('propreneur_carina_token');
    // Navigation handled by AuthContext detecting token removal
  }

  return res;
}

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }
  return res.json();
}
```

### Endpoints Used (All Existing; No New APIs)

| Method | Path | Controller Method | Request | Response |
|---|---|---|---|---|
| POST | `/auth/login` | `MobileAuthController::login` | `{ email, password, device_name? }` | `{ token, token_type, user }` |
| POST | `/auth/logout` | `MobileAuthController::logout` |; | `{ message }` |
| GET | `/user/profile` | `MobileUserController::profile` |; | `{ id, name, email, phone, role, properties_count, ... }` |
| PUT | `/preferences` | `MobileUserController::updatePreferences` | `{ briefing_time?, audio_enabled?, telegram_notifications_enabled? }` | `{ briefing_time, audio_enabled, ... }` |
| POST | `/chat/send` | `MobileChatController::send` | `{ message, conversation_id? }` | `{ reply, conversation_id, actions, requires_confirmation, pending_action }` |
| POST | `/chat/voice` | `MobileChatController::voice` | multipart `{ audio, conversation_id? }` | `{ transcription, reply, conversation_id, actions }` |
| POST | `/chat/image` | `MobileChatController::image` | multipart `{ image, property_id?, is_floor_plan?, conversation_id? }` | `{ reply, image_url?, floor_plan_id?, conversation_id }` |
| GET | `/portfolio/summary` | `MobilePortfolioController::summary` |; | `{ total_properties, active_tenancies, occupancy_rate_pct, total_monthly_rent, total_arrears_gbp, compliance_alerts_expiring_30d }` |
| GET | `/portfolio/properties` | `MobilePortfolioController::properties` | `?per_page=&page=` | `{ data: Property[], meta: { current_page, last_page, ... } }` |
| GET | `/portfolio/properties/{id}` | `MobilePortfolioController::property` |; | `{ id, address_line1, ..., tenancies: [], compliance_items: [], recent_payments: [] }` |
| GET | `/compliance/status` | `MobileComplianceController::status` |; | `{ overall, critical_count, warnings, total_items }` |
| GET | `/compliance/items` | `MobileComplianceController::items` | `?per_page=&page=&status=` | `{ data: ComplianceItem[], meta }` |
| GET | `/briefing/latest` | `MobileBriefingController::latest` |; | `{ date, text, has_audio, generated_at }` or `{ available: false }` |
| GET | `/briefing/audio` | `MobileBriefingController::audio` |; | `Content-Type: audio/mpeg` binary stream |
| POST | `/notifications/register` | `MobileNotificationController::register` | `{ fcm_token, platform? }` | `{ registered: true, platform }` |

### Token Refresh Flow

The legacy `mobile/v1` API uses Sanctum personal access tokens. These do not automatically expire in the default Laravel Sanctum setup; they are long-lived. However, the server may revoke them.

**Strategy:** On 401 response from any endpoint:
1. Clear the stored token.
2. Navigate to sign-in screen (with a toast: "Session expired. Please sign in again.").
3. No background refresh; the legacy API has no refresh endpoint.

> If the V1 refresh endpoint (`POST /api/v1/mobile/auth/refresh`) is backported to the legacy namespace in the future, add a transparent refresh interceptor.

### Request/Response Models (TypeScript)

```typescript
// src/types/api.ts

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  last_login_at: string | null;
  role: 'workspace_admin' | 'user';
  properties_count: number;
  telegram_linked: boolean;
  briefing_time: string | null;
  audio_enabled: boolean;
}

interface PortfolioSummary {
  total_properties: number;
  active_tenancies: number;
  occupancy_rate_pct: number;
  total_monthly_rent: number;
  total_arrears_gbp: number;
  compliance_alerts_expiring_30d: number;
}

interface PropertyListItem {
  id: number;
  address: string;
  type: string;
  bedrooms: number;
  monthly_rent: number;
  status: string;
  tenant_name: string | null;
}

interface PropertyDetail {
  id: number;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  property_type: string;
  bedrooms: number;
  bathrooms: number | null;
  status: string;
  strategy: string | null;
  monthly_rent: number;
  purchase_price: number | null;
  current_value: number | null;
  tenancies: Tenancy[];
  recent_payments: Payment[];
  compliance_items: ComplianceItem[];
}

interface ComplianceStatus {
  overall: 'green' | 'amber' | 'red';
  critical_count: number;
  warnings: number;
  total_items: number;
}

interface ComplianceItem {
  id: number;
  property_id: number | null;
  category: string;
  type: string;
  title: string;
  reference_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  reminder_days: number | null;
  status: string;
  notes: string | null;
  updated_at: string;
}

interface BriefingResponse {
  available: boolean;
  date?: string;
  text?: string;
  has_audio?: boolean;
  generated_at?: string;
}

interface ChatResponse {
  reply: string;
  conversation_id: number;
  actions?: AgentAction[];
  requires_confirmation?: boolean;
  pending_action?: AgentAction | null;
  transcription?: string; // voice only
  image_url?: string; // image only
  floor_plan_id?: number; // floor plan only
}

interface AgentAction {
  type: string;
  label: string;
  token?: string; // confirmation token
  payload?: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
```

---

## 6. Offline Support

### What Works Offline

| Feature | Offline Behaviour |
|---|---|
| Read cached briefing | Briefing text cached after first fetch; readable offline |
| Read cached conversations | All chat messages stored in AsyncStorage; full history readable |
| Read cached property list | Last-fetched list available from AsyncStorage cache |
| Read cached property detail | Last-viewed property detail cached |
| Compose text messages | Messages queued locally, sent when online |
| Voice recording | Record audio locally (expo-av), stored in filesystem, queued for upload |
| Camera capture | Photo saved to local filesystem, queued for upload |
| Settings changes | Local preferences (voice toggle, TTS toggle) saved immediately |

### What Does NOT Work Offline

- Login / authentication (requires server)
- Fresh data (briefings, compliance alerts, portfolio updates)
- Streaming SSE responses
- Audio briefing generation (TTS happens server-side)
- Push notification registration

### Offline Message Queue (`src/utils/sync-queue.ts`)

```typescript
interface QueuedMessage {
  id: string; // uuid
  type: 'text' | 'voice' | 'image';
  conversationId?: number;
  content?: string; // text message
  audioUri?: string; // local file URI for voice
  imageUri?: string; // local file URI for image
  propertyId?: number; // for floor plan context
  isFloorPlan?: boolean;
  queuedAt: string; // ISO timestamp
  status: 'pending' | 'sending' | 'failed';
  retryCount: number;
}

const QUEUE_KEY = 'carina_offline_queue';

async function enqueue(msg: Omit<QueuedMessage, 'id' | 'queuedAt' | 'status' | 'retryCount'>): Promise<void> { ... }
async function flush(token: string): Promise<void> { ... }
async function getPendingCount(): Promise<number> { ... }
```

### Offline Detection Hook (`src/hooks/useNetwork.ts`)

```typescript
function useNetwork() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? true;
      setIsConnected(online);
      if (online) {
        // Trigger queue flush
        flushQueue();
        // Invalidate stale queries
        queryClient.invalidateQueries();
      }
    });
    return unsubscribe;
  }, []);

  return { isConnected };
}
```

### Offline UI

- **Banner:** A thin banner at the top of the screen: "You're offline. Messages will be sent when you reconnect." (amber background).
- **Queued indicator:** A small badge on the Carina tab showing pending message count.
- **Sending state:** Queued messages appear in the chat with a clock icon and "Sending..." label. On failure, show "Failed to send; tap to retry".

### Data Caching Implementation

- TanStack Query's `persistQueryClient` with AsyncStorage adapter.
- `staleTime` controls when data is considered stale and refetched.
- On app launch, if offline, show cached data with a "Last updated: {timestamp}" indicator.
- Cache invalidation on successful message send (the reply updates the conversation cache).

---

## 7. Push Notifications

### Setup

**Client-side (Expo):**
```
1. expo-notifications configured in app.json
2. Request permission on first launch after login
3. Get Expo push token via Notifications.getExpoPushTokenAsync()
4. POST /api/mobile/v1/notifications/register { fcm_token, platform }
```

**Server-side (already exists):**
- `MobileNotificationController::register` stores the FCM token on the user record.
- `config/mobile.php` has `push.fcm_server_key` and `push.expo_access_token`.
- The server's notification system (via `MobileNotificationController` or the broader notification infrastructure) sends push notifications to registered devices.

### Notification Types

| Type | Trigger | Payload | Deep Link |
|---|---|---|---|
| Daily briefing ready | CarinaScheduledRun completes `daily-portfolio-summary` | `{ title: "Carina", body: "Your daily briefing is ready; 5 properties, £3,200 rent collected", route: "carina://briefing" }` | `carina://briefing` |
| Compliance expiring | Compliance item expiring within 7 days | `{ title: "Compliance Alert", body: "Gas safety certificate for Flat 3 expires Friday", route: "carina://compliance" }` | `carina://compliance` |
| Compliance expired | Compliance item now expired | `{ title: "Urgent: Expired", body: "EICR for 14 High Street expired yesterday", route: "carina://compliance", priority: "high" }` | `carina://compliance` |
| Rent overdue | Arrears exceed threshold (configurable) | `{ title: "Rent Alert", body: "£950 overdue at Flat 3; 14 days late", route: "carina://portfolio/{id}" }` | `carina://portfolio/{id}` |
| New Carina message | When Carina responds to a queued offline message | `{ title: "Carina replied", body: "I've updated the rent for Flat 3 to £950", route: "carina://chat" }` | `carina://chat` |

### Handling Incoming Notifications (App)

**In `app/_layout.tsx`:**

```typescript
// Foreground: show in-app banner (not system notification)
Notifications.addNotificationReceivedListener(notification => {
  // Show a subtle banner at the top of the current screen
  showInAppBanner(notification.request.content);
});

// Background/killed: handle tap → navigate
Notifications.addNotificationResponseReceivedListener(response => {
  const route = response.notification.request.content.data?.route;
  if (route) {
    router.push(route);
  }
});
```

### Push Registration Flow

1. User signs in → token stored in SecureStore.
2. App requests notification permission (`Notifications.requestPermissionsAsync()`).
3. If granted, get Expo push token.
4. `POST /api/mobile/v1/notifications/register` with `{ fcm_token: expoPushToken, platform: Platform.OS }`.
5. On logout, the server-side token remains until overwritten by next login. (The legacy endpoint doesn't have an unregister; this is acceptable.)

### Handling FCM vs APNs

- Expo abstracts this; `expo-notifications` handles both FCM (Android) and APNs (iOS) through the Expo push notification service.
- The token sent to the server is the Expo push token, not a raw FCM/APNs token.
- Server-side configuration in `config/mobile.php` (`expo_access_token`) is used by the server's notification dispatcher to send via Expo.

---

## 8. Camera & Voice

### Camera; Floor Plan Capture

**Flow: `app/camera/floor-plan.tsx`**

1. User navigates from Home "Upload Floor Plan" quick action or from Property detail.
2. Camera viewfinder opens (using `expo-camera` in photo mode).
3. Optional: overlay a guideline rectangle; "Position the floor plan within the frame."
4. Capture button → photo taken.
5. Preview screen: "Use Photo" or "Retake."
6. Property association: dropdown list of properties (from cached `GET /portfolio/properties`).
7. Upload: `POST /api/mobile/v1/chat/image`
   - multipart form: `image` (JPEG, max 10MB per server `max:10240`), `is_floor_plan: true`, `property_id`.
8. Loading screen: "Analysing floor plan... Carina is examining dimensions, room count, and generating cost estimates."
9. Results: text from Carina's analysis. "Ask a follow-up" button.
10. The response includes `floor_plan_id` for future reference.

**Implementation:**
```typescript
// Using expo-image-picker for simplicity (expo-camera for live viewfinder)
import * as ImagePicker from 'expo-image-picker';

async function captureFloorPlan(): Promise<ImagePicker.ImagePickerAsset> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    maxWidth: 2048,
    maxHeight: 2048,
    allowsEditing: false,
  });

  if (result.canceled) throw new Error('Capture cancelled');
  return result.assets[0];
}
```

**Upload:**
```typescript
async function uploadFloorPlan(
  image: ImagePicker.ImagePickerAsset,
  propertyId?: number
): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append('image', {
    uri: image.uri,
    type: 'image/jpeg',
    name: 'floor-plan.jpg',
  } as any);
  if (propertyId) formData.append('property_id', String(propertyId));
  formData.append('is_floor_plan', 'true');

  return apiJson<ChatResponse>('/chat/image', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: formData,
  });
}
```

### Camera; General Photo

Same flow but:
- `is_floor_plan: false`
- No property association required (but optional)
- Carina describes the photo rather than analysing dimensions

### Voice Note Recording

**Flow: Inline in chat screen**

1. User taps and holds the mic button in the chat input bar.
2. Recording begins (using `expo-av` `Audio.Recording`).
3. Visual feedback: animated waveform, recording duration counter, "Release to send."
4. User releases → recording stops.
5. Audio file saved to local cache directory (`.m4a` format, iOS/Android native format).
6. Upload: `POST /api/mobile/v1/chat/voice`; multipart with `audio` file and `conversation_id`.
7. The server transcribes (via `CarinaSpeechTranscriptionService` using OpenAI Whisper or Groq) and passes the transcript through Carina's agent loop.
8. Response includes `transcription` (what the server understood) and `reply` (Carina's response).
9. Chat UI shows: user voice bubble (with transcription and playback button) + Carina response.

**Implementation:**
```typescript
import { Audio } from 'expo-av';

async function startRecording(): Promise<Audio.Recording> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  return recording;
}

async function stopRecording(recording: Audio.Recording): Promise<string> {
  await recording.stopAndUnloadAsync();
  return recording.getURI(); // file:///.../recording.m4a
}
```

**Upload:**
```typescript
async function sendVoice(audioUri: string, conversationId?: number): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'voice-note.m4a',
  } as any);
  if (conversationId) formData.append('conversation_id', String(conversationId));

  return apiJson<ChatResponse>('/chat/voice', {
    method: 'POST',
    body: formData,
  });
}
```

### Supported Audio Formats (from server validation)

The server accepts: `webm, wav, mp4, m4a, mp3, ogg, mpeg, 3gp, caf`.

On iOS, `expo-av` records in `.m4a` (AAC in MP4 container); this is supported.
On Android, `.m4a` also works.

---

## 9. TTS / Audio Playback

### Briefing Audio Playback

**Source:** `GET /api/mobile/v1/briefing/audio` returns `Content-Type: audio/mpeg` (MP3 binary).

The server generates MP3 via `TextToSpeechService` (edge-tts Python CLI, voice: `en-GB-SoniaNeural`). Audio is cached server-side at `storage/app/tts/briefing-{runId}.mp3`.

**Client playback:**

```typescript
import { Audio } from 'expo-av';

async function playBriefingAudio(): Promise<void> {
  const token = await SecureStore.getItemAsync('propreneur_carina_token');
  const baseUrl = await getWorkspaceOrigin();
  const url = `${baseUrl}/api/mobile/v1/briefing/audio`;

  const { sound } = await Audio.Sound.createAsync(
    { uri: url, headers: { Authorization: `Bearer ${token}` } },
    { shouldPlay: true }
  );

  // Track playback status
  sound.setOnPlaybackStatusUpdate(status => {
    if (status.isLoaded && status.didJustFinish) {
      // Playback complete
    }
  });

  return sound; // Return for external control (play/pause/seek)
}
```

**Audio player UI component:**
- Mini player bar: play/pause button, progress bar (seekable), current time / total time.
- Background playback: set `staysActiveInBackground: true` in `Audio.setAudioModeAsync()`.
- Notification center controls (iOS): Now Playing info with briefing title.
- Auto-play toggle in Settings: if enabled, auto-play briefing audio when opening the briefing screen.

### Voice Message Playback

Voice messages sent by the user are stored locally (the recording URI). Tapping the voice bubble plays the local audio file using the same `Audio.Sound` API.

Carina's voice responses (if ever implemented server-side as TTS replies) would stream or download MP3 and play similarly.

---

## 10. Build & Distribution

### Build Pipeline (EAS Build)

```
Developer pushes to GitHub
    ↓
GitHub Actions triggers EAS Build
    ↓
eas build --platform android --profile production
eas build --platform ios --profile production
    ↓
Artifacts: .aab (Android App Bundle), .ipa (iOS)
    ↓
Android: upload to Google Play Console
iOS: upload to App Store Connect via Transporter
```

### EAS Build Profiles (`eas.json`)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "production": {
      "distribution": "store",
      "android": { "buildType": "app-bundle" },
      "ios": { "autoIncrement": true }
    }
  },
  "submit": {
    "production": {
      "android": { "track": "internal", "releaseStatus": "draft" },
      "ios": { "appleId": "developer@propreneur.uk", "ascAppId": "123456789" }
    }
  }
}
```

### OTA Updates (Expo Updates)

For JS-only changes (UI tweaks, prompt changes that don't affect native code):

```bash
eas update --branch production --message "Carina persona update v1.2.0"
```

**Update strategy:** `expo-updates` configured with:
```json
{
  "expo": {
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 3000,
      "url": "https://u.expo.dev/{project-id}"
    }
  }
}
```

- App checks for updates on launch.
- Download in background.
- Apply on next app restart (or immediately via `Updates.reloadAsync()` for critical fixes).
- This is the primary channel for iterating on Carina's mobile persona prompts, UI behaviour, and non-native features.

### App Store / Play Store

| Platform | Distribution | Notes |
|---|---|---|
| **Android** | Google Play + sideload APK (existing) | Existing APK sideload infrastructure (`config/mobile.php`, `MOBILE_ANDROID_APK_PATH`) continues for enterprise distribution. Google Play for consumer distribution. |
| **iOS** | App Store (TestFlight for beta) | New. Requires Apple Developer account ($99/year). TestFlight for internal testing. |

### Version Management

- `app.json` `expo.version` for app version.
- `MOBILE_ANDROID_VERSION` env var for the existing APK sideload page.
- App checks server version endpoint on launch (if the V1 `GET /api/v1/mobile/version` is available). If not, use a hardcoded minimum version check against the login response.

### CI/CD (GitHub Actions)

```yaml
name: Mobile CI
on:
  push:
    branches: [main]
    paths: ['carina-mobile/**']
  pull_request:
    paths: ['carina-mobile/**']

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd carina-mobile && npm ci && npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd carina-mobile && npm ci && npx eslint .

  preview-build:
    needs: [typecheck, lint]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: expo/expo-github-action@v8
        with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: cd carina-mobile && npm ci && eas build --platform android --profile preview --non-interactive
```

---

## 11. File Structure

```
carina-mobile/
├── app.json                          # Expo config (name, slug, version, plugins, updates)
├── eas.json                          # EAS Build profiles
├── tsconfig.json                     # TypeScript strict config
├── package.json                      # Dependencies
├── babel.config.js                   # Expo + expo-router babel preset
├── assets/
│   ├── icon.png                      # App icon (1024x1024)
│   ├── splash.png                    # Splash screen
│   ├── adaptive-icon.png             # Android adaptive icon
│   └── notification-icon.png         # Push notification icon
│
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root layout; AuthGate + QueryClientProvider
│   ├── sign-in.tsx                   # Login screen
│   │
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab bar (Home, Carina, Settings)
│   │   ├── index.tsx                 # Home / Dashboard
│   │   ├── carina.tsx                # Conversation list
│   │   └── settings.tsx              # Settings / Profile
│   │
│   ├── carina/
│   │   └── [id].tsx                  # Chat conversation screen
│   │
│   ├── portfolio/
│   │   ├── index.tsx                 # Property list
│   │   └── [id].tsx                  # Property detail
│   │
│   ├── compliance/
│   │   └── index.tsx                 # Compliance dashboard
│   │
│   ├── briefing/
│   │   └── index.tsx                 # Latest briefing (text + audio player)
│   │
│   └── camera/
│       ├── floor-plan.tsx            # Floor plan capture flow
│       └── photo.tsx                 # General photo capture
│
├── src/
│   ├── api/
│   │   ├── client.ts                 # fetch wrapper with auth, error handling
│   │   ├── auth.ts                   # login(), logout()
│   │   ├── user.ts                   # getProfile(), updatePreferences()
│   │   ├── chat.ts                   # sendMessage(), sendVoice(), sendImage()
│   │   ├── portfolio.ts             # getSummary(), getProperties(), getProperty()
│   │   ├── compliance.ts             # getStatus(), getItems()
│   │   ├── briefing.ts               # getLatest(), getAudioUrl()
│   │   └── notifications.ts          # registerPushToken()
│   │
│   ├── config/
│   │   ├── workspace.ts              # workspace origin resolution
│   │   └── queryClient.ts            # TanStack Query client + persist config
│   │
│   ├── context/
│   │   └── AuthContext.tsx           # Auth state provider + SecureStore
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Consume AuthContext
│   │   ├── useChat.ts                # sendMessage mutation, conversation query
│   │   ├── usePortfolio.ts           # summary, list, detail queries
│   │   ├── useCompliance.ts          # status, items queries
│   │   ├── useBriefing.ts            # latest briefing query, audio playback
│   │   ├── useUser.ts                # profile query, preferences mutation
│   │   ├── useNetwork.ts             # NetInfo listener + queue flush trigger
│   │   ├── useCamera.ts              # camera permission + capture helpers
│   │   ├── useVoiceRecorder.ts       # recording start/stop/upload
│   │   └── useAudioPlayer.ts         # expo-av playback wrapper
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Card.tsx              # Generic card container
│   │   │   ├── Badge.tsx             # Status badge (green/amber/red)
│   │   │   ├── Button.tsx            # Primary/secondary/destructive buttons
│   │   │   ├── EmptyState.tsx        # Empty list placeholder
│   │   │   ├── ErrorState.tsx        # Error with retry button
│   │   │   ├── LoadingRow.tsx        # Skeleton loading rows
│   │   │   ├── OfflineBanner.tsx     # "You're offline" banner
│   │   │   ├── ConfirmDialog.tsx     # Destructive action confirmation
│   │   │   └── StreamingText.tsx     # Progressive text (for Carina SSE)
│   │   │
│   │   ├── home/
│   │   │   ├── GreetingHeader.tsx    # "Good morning, {name}"
│   │   │   ├── BriefingCard.tsx      # Daily briefing preview card
│   │   │   ├── ComplianceChip.tsx    # Green/amber/red status chip
│   │   │   ├── QuickActions.tsx      # Row of quick action buttons
│   │   │   └── PropertyPreviewCard.tsx # Mini property card for horizontal list
│   │   │
│   │   ├── chat/
│   │   │   ├── MessageBubble.tsx     # User (right) / Carina (left) bubble
│   │   │   ├── ChatInput.tsx         # Text input + mic + camera + send
│   │   │   ├── VoiceBubble.tsx       # Voice message with play button
│   │   │   ├── ImageBubble.tsx       # Photo message with thumbnail
│   │   │   ├── TypingIndicator.tsx   # Animated dots while Carina responds
│   │   │   └── AgentConfirmation.tsx # Approve/Reject buttons for agent actions
│   │   │
│   │   ├── portfolio/
│   │   │   ├── PropertyCard.tsx      # Full property card for list
│   │   │   ├── PropertyDetailSection.tsx # Section in property detail view
│   │   │   └── TenancyRow.tsx        # Single tenancy row
│   │   │
│   │   ├── compliance/
│   │   │   ├── ComplianceStatusBanner.tsx # Green/amber/red banner
│   │   │   └── ComplianceItemRow.tsx # Single compliance item
│   │   │
│   │   ├── briefing/
│   │   │   └── AudioPlayer.tsx       # Play/pause/seek/time display
│   │   │
│   │   └── settings/
│   │       ├── ProfileSection.tsx    # Name, email, role display
│   │       ├── NotificationToggle.tsx # Push notification on/off
│   │       └── VoiceSettings.tsx     # Voice input + TTS toggles
│   │
│   ├── types/
│   │   └── api.ts                    # All API request/response TypeScript types
│   │
│   ├── constants/
│   │   └── colors.ts                 # Design tokens (slate palette, accent colours)
│   │
│   └── utils/
│       ├── sync-queue.ts             # Offline message queue
│       ├── streaming.ts              # SSE stream reader
│       ├── currency.ts               # Format GBP (£1,234.56)
│       ├── date.ts                   # Relative dates, "expires in 5 days"
│       └── storage.ts                # AsyncStorage helper wrappers
│
└── __tests__/
    ├── api/
    │   └── client.test.ts
    ├── hooks/
    │   ├── useChat.test.ts
    │   └── usePortfolio.test.ts
    └── utils/
        ├── sync-queue.test.ts
        └── currency.test.ts
```

---

## 12. Build Estimate & Timeline

### Complexity Scoring

| Screen | Complexity | Rationale |
|---|---|---|
| Sign-in | Low (2) | Single form, API call, navigation |
| Home/Dashboard | Medium (5) | Multiple data sources, greeting logic, briefing card, quick actions |
| Chat conversation list | Low (2) | FlatList, local data |
| Chat screen | High (8) | SSE streaming, progressive text, voice input, camera, agent confirmations, offline queue |
| Portfolio list | Low (3) | Infinite scroll FlatList |
| Portfolio detail | Medium (4) | Multiple sections, nested data |
| Compliance dashboard | Medium (4) | Filter chips, status banner, urgency sorting |
| Briefing viewer | Medium (4) | Text display + audio player (streaming MP3) |
| Settings | Low (3) | Forms, toggles, SecureStore |
| Floor plan camera | Medium (5) | Camera, preview, upload, loading, results |
| General photo camera | Low (2) | Simpler version of floor plan |
| Root layout + auth gate | Medium (4) | Token validation, redirects, push setup, crash handler |

### Phase 1; MVP (Core Carina Experience)

**Goal:** Chat, voice, daily briefing, portfolio glance, push notifications.  
**Duration:** 3-4 weeks (1 developer)

| Week | Deliverable | Screens |
|---|---|---|
| Week 1 | Project setup, auth flow, navigation shell | Sign-in, root layout, tab bar, empty screens |
| Week 2 | Chat; text messaging, SSE streaming, conversation list | Chat list, chat screen, message bubbles, streaming text |
| Week 3 | Voice input, camera, portfolio summary | Voice recording/upload, floor plan camera, home dashboard with portfolio summary |
| Week 4 | Briefings, push notifications, compliance status, settings | Briefing viewer + audio player, push registration + handling, compliance status banner, settings screen |

**Phase 1 screens (12 total):**
- `sign-in.tsx`
- `(tabs)/_layout.tsx`
- `(tabs)/index.tsx` (Home/Dashboard)
- `(tabs)/carina.tsx` (Chat list)
- `carina/[id].tsx` (Chat screen)
- `(tabs)/settings.tsx`
- `briefing/index.tsx`
- `compliance/index.tsx`
- `portfolio/index.tsx`
- `portfolio/[id].tsx`
- `camera/floor-plan.tsx`
- `camera/photo.tsx`

### Phase 2; Polish & Enrichment

**Goal:** Offline support, property detail enrichment, agent confirmations, TestFlight beta.  
**Duration:** 2-3 weeks (1 developer)

| Week | Deliverable |
|---|---|
| Week 5 | Offline message queue, cached data persistence, offline banner |
| Week 6 | Agent confirmation UI, improved voice playback, floor plan analysis results screen |
| Week 7 | iOS TestFlight setup, App Store screenshots, Play Store listing, CI/CD finalisation |

### Total Estimated Timeline

- **Phase 1 (MVP):** 4 weeks
- **Phase 2 (Polish):** 3 weeks
- **Total:** 7 weeks (single developer)

With 2 developers, the timeline compresses to approximately 4-5 weeks total.

### Dependencies

| Dependency | Status | Owner |
|---|---|---|
| Mobile/v1 API endpoints | Done:  Deployed | Backend |
| FCM/Expo push server key | Done:  Configured in `config/mobile.php` | DevOps |
| edge-tts for briefing audio | Done:  Running on server | Backend |
| CarinaSpeechTranscriptionService | Done:  Whisper/Groq configured | Backend |
| Apple Developer account | Failed:  Needed for iOS | Admin |
| Google Play Console | Failed:  Needed for Play Store | Admin |
| Expo account + project | Setup during Week 1 | Mobile dev |

### Risks

| Risk | Mitigation |
|---|---|
| SSE streaming not working reliably on React Native | Fall back to polling; send message, poll for response every 1s until complete. The legacy `send` endpoint already returns the full reply synchronously. |
| Voice recording format incompatibility | Test `.m4a` on both platforms early. Fall back to `.wav` if needed (both supported by server). |
| Briefing audio streaming fails | Download MP3 fully before playback instead of streaming. |

---

## Appendix A: Existing Carina Mobile Prompts

The server uses these prompts (from `brain/prompts/carina_extended/carina-mobile-prompts.php`) when processing messages through `MobileChatController`. The app does NOT send these prompts; the server prepends them. Understanding them helps design the UX appropriately.

| Prompt Key | Purpose | UX Implication |
|---|---|---|
| `mobile_chat_persona` | Defines Carina's tone, length constraints, capabilities | Chat bubbles should support 2-5 line responses gracefully. UI shouldn't truncate. |
| `onboarding_wizard` | 5-step guided setup for new users | Home screen should detect if onboarding is needed and show wizard prompt in chat. |
| `floor_plan_camera_interaction` | Analysis response format for floor plans | Floor plan results screen should parse and display structured output (type, area, rooms). |
| `voice_note_processor_mobile` | Intent recognition from transcribed voice | Chat UI should show the transcription alongside Carina's response. |
| `push_notification_generator` | 120-char notification text format | Notifications need tight character budget; preview text, not full message. |
| `home_screen_greeting` | Personalised greeting with portfolio context | Home screen can use the same template logic client-side for instant rendering. |

## Appendix B: Existing Server Infrastructure Reference

| Component | Path | Relevance |
|---|---|---|
| Legacy mobile routes | `routes/api.php` lines 87-107 | All Phase 1 endpoints |
| V1 mobile routes | `routes/tenant/mobile_v1_api.php` | Future expansion (127 endpoints) |
| Mobile auth controller | `app/Http/Controllers/Api/Mobile/MobileAuthController.php` | Login/logout logic, 2FA gate |
| Mobile chat controller | `app/Http/Controllers/Api/Mobile/MobileChatController.php` | Text/voice/image dispatch |
| Mobile portfolio controller | `app/Http/Controllers/Api/Mobile/MobilePortfolioController.php` | Summary + property detail |
| Mobile compliance controller | `app/Http/Controllers/Api/Mobile/MobileComplianceController.php` | Status + items |
| Mobile briefing controller | `app/Http/Controllers/Api/Mobile/MobileBriefingController.php` | Latest + audio |
| Mobile notification controller | `app/Http/Controllers/Api/Mobile/MobileNotificationController.php` | Push token registration |
| Mobile user controller | `app/Http/Controllers/Api/Mobile/MobileUserController.php` | Profile + preferences |
| Carina mobile prompts | `brain/prompts/carina_extended/carina-mobile-prompts.php` | 6 persona/interaction prompts |
| Mobile config | `config/mobile.php` | Token expiry, push keys, APK path |
| TextToSpeechService | `app/Services/Ai/TextToSpeechService.php` | edge-tts MP3 generation |
| FloorPlanAnalysisService | `app/Services/Carina/FloorPlanAnalysisService.php` | Vision AI floor plan analysis |
| Existing v2 mobile build spec | `brain/prompts/154-android-mobile-v2-full-build.md` | Reference for patterns (role-aware tabs, streaming, offline sync) |

## Appendix C: Key Design Decisions

1. **Three-tab layout** (not five-tab like Propreneur v2): Carina is a focused assistant app, not a full business management suite. Chat is the primary interaction.

2. **Legacy `mobile/v1` namespace** instead of V1 `/api/v1/mobile`: The legacy endpoints are simpler, purpose-built for the Carina assistant experience, and already have the persona injection logic in `MobileChatController`. The V1 namespace is for the full Propreneur app.

3. **No explicit refresh token:** The legacy auth uses long-lived Sanctum tokens. On 401, re-authenticate. This keeps the auth flow simple.

4. **AsyncStorage for chat persistence:** Chat messages are stored locally so the conversation history survives app restarts and offline periods. This is the single most important persistence requirement.

5. **Expo managed workflow** over bare React Native: Faster development, OTA updates for prompt/persona changes, and sufficient native capabilities via expo-* packages.

6. **Expo Push Notifications** over raw FCM/APNs: Simpler client-side setup, and the server's `config/mobile.php` already has `expo_access_token` configured.
