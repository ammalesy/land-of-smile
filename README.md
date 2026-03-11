# 😊 Land of Smile

Group voice chat web app — รองรับสูงสุด 7 คนต่อห้อง

---

## Tech Stack

| | |
|--|--|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Real-time Signaling** | Ably (WebSocket) |
| **Audio / Video** | WebRTC (P2P mesh, native browser API) |
| **Auth** | Cookie-based password protection |
| **Deployment** | Vercel (auto-deploy from `main`) |

---

## Features

- 🎙 **Voice chat** — P2P audio ผ่าน WebRTC, ไม่ผ่าน server
- 🖥️ **Screen sharing** — แชร์หน้าจอ desktop แบบ P2P, ปรับขนาดกรอบได้
- 👥 **Participant list** — แสดงชื่อ, สถานะ mute และสถานะ screen share real-time
- 🔇 **Mute microphone** — ปิด/เปิดไมค์ของตัวเอง
- 🔊 **Mute sound** — ปิด/เปิดเสียงที่ได้ยินจากคนอื่น
- 🔒 **Password protection** — ต้อง login ก่อนใช้งาน (cookie อยู่ 90 วัน)
- 🏠 **Create & Join room** — สร้างห้องใหม่หรือเข้าห้องที่มีอยู่ด้วย Room ID
- 📶 **TURN relay support** — รองรับ NAT traversal ผ่าน TURN server

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ably-token/route.ts   # Ably Token Auth endpoint
│   │   ├── auth/login/route.ts   # Login / logout endpoint
│   │   └── ice-servers/route.ts  # STUN/TURN server list endpoint
│   ├── login/page.tsx            # Login page
│   ├── room/[roomId]/page.tsx    # Voice room page
│   ├── layout.tsx
│   └── page.tsx                  # Home — create/join room
├── components/
│   ├── VoiceRoom.tsx             # Main room UI + screen share layout
│   ├── ParticipantList.tsx       # List of connected users with indicators
│   ├── AudioControls.tsx         # Mute / Mute Sound / Screen Share / Leave
│   └── ScreenShareView.tsx       # Resizable screen share video viewer
├── hooks/
│   └── useWebRTC.ts              # WebRTC + Ably signaling + screen share logic
├── middleware.ts                  # Auth middleware (protects all routes)
└── types/
    └── index.ts                  # Shared TypeScript types
docs/
└── diagrams/
    ├── 01-authentication.md      # Sequence diagram: Auth flow
    ├── 02-create-room.md         # Sequence diagram: Create room
    ├── 03-join-room.md           # Sequence diagram: Join room
    ├── 04-voice-communications.md # Sequence diagram: Voice comms
    └── 05-screen-sharing.md      # Sequence diagram: Screen sharing
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

สร้างไฟล์ `.env.local`:

```bash
# Ably API Key — https://ably.com
ABLY_API_KEY=your_ably_api_key

# App password for login page
APP_PASSWORD=your_password

# TURN server credentials (optional — defaults to openrelay.metered.ca)
TURN_USERNAME=your_turn_username
TURN_CREDENTIAL=your_turn_credential
```

> **Ably API Key** ต้องมี capability: `voice-room:* → publish, subscribe, presence`

### 3. Run dev server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## Environment Variables (Vercel)

ตั้งค่าใน **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `ABLY_API_KEY` | Ably API Key พร้อม presence capability |
| `APP_PASSWORD` | รหัสผ่านสำหรับ login |
| `TURN_USERNAME` | TURN server username (optional) |
| `TURN_CREDENTIAL` | TURN server credential (optional) |

---

## How It Works

### Voice Chat

```
User A                    Ably                    User B
  │                         │                        │
  │── presence.enter() ────►│◄─── presence.enter() ──│
  │── publish("user-joined")►│                        │
  │                         │──► handleSignal() ──────│
  │◄──────────── WebRTC offer/answer/ICE ─────────────│
  │                                                    │
  └──────────── P2P Audio (ไม่ผ่าน server) ───────────┘
```

### Screen Sharing

```
Sharer                    Ably                    Viewer
  │                         │                        │
  │── getDisplayMedia() ────►                         │
  │── publish("screen-share-start") ────────────────►│
  │── screen offer (screen:UserA → screen:UserB) ───►│
  │◄── screen answer ────────────────────────────────│
  │◄────────── ICE candidates (screen channel) ──────│
  │                                                    │
  └──────────── P2P Video Stream (หน้าจอ) ────────────┘
```

- **Ably** ทำหน้าที่เป็น Signaling Server และ Presence
- **WebRTC** ส่งเสียงและวิดีโอโดยตรง P2P ระหว่าง browsers
- **TURN server** รับช่วงต่อเมื่อ P2P ตรงไม่ได้ (เช่น Mobile ↔ PC ต่าง NAT)
- **Participant list** อิงจาก Ably Presence (reliable ทุก browser)
- **ICE candidate queue** ป้องกัน race condition ระหว่าง signaling

---

## Sequence Diagrams

ดู flow แบบละเอียดได้ที่ [`docs/diagrams/`](docs/diagrams/):

| ไฟล์ | เนื้อหา |
|------|---------|
| [`01-authentication.md`](docs/diagrams/01-authentication.md) | Cookie auth, middleware, login flow |
| [`02-create-room.md`](docs/diagrams/02-create-room.md) | สร้างห้องด้วย UUID |
| [`03-join-room.md`](docs/diagrams/03-join-room.md) | Join, Ably token, WebRTC negotiation |
| [`04-voice-communications.md`](docs/diagrams/04-voice-communications.md) | Audio streaming, mute, leave, drop |
| [`05-screen-sharing.md`](docs/diagrams/05-screen-sharing.md) | Screen share, late joiner, ICE queue |

---

## Deployment

Push ไปที่ `main` branch → Vercel deploy อัตโนมัติ

```bash
git push origin main
```


---

## Tech Stack

| | |
|--|--|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Real-time Signaling** | Ably (WebSocket) |
| **Audio** | WebRTC (P2P mesh, native browser API) |
| **Auth** | Cookie-based password protection |
| **Deployment** | Vercel (auto-deploy from `main`) |

---

## Features

- 🎙 **Voice chat** — P2P audio ผ่าน WebRTC, ไม่ผ่าน server
- 👥 **Participant list** — แสดงชื่อและสถานะ mute ของทุกคน real-time
- 🔇 **Mute microphone** — ปิด/เปิดไมค์ของตัวเอง
- 🔊 **Mute sound** — ปิด/เปิดเสียงที่ได้ยินจากคนอื่น
- 🔒 **Password protection** — ต้อง login ก่อนใช้งาน (cookie อยู่ 90 วัน)
- 🏠 **Create & Join room** — สร้างห้องใหม่หรือเข้าห้องที่มีอยู่ด้วย Room ID

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ably-token/route.ts   # Ably Token Auth endpoint
│   │   └── auth/login/route.ts  # Login / logout endpoint
│   ├── login/page.tsx            # Login page
│   ├── room/[roomId]/page.tsx    # Voice room page
│   ├── layout.tsx
│   └── page.tsx                  # Home — create/join room
├── components/
│   ├── VoiceRoom.tsx             # Main room UI
│   ├── ParticipantList.tsx       # List of connected users
│   └── AudioControls.tsx         # Mute / Mute Sound / Leave buttons
├── hooks/
│   └── useWebRTC.ts              # WebRTC + Ably signaling logic
├── middleware.ts                  # Auth middleware (protects all routes)
└── types/
    └── index.ts                  # Shared TypeScript types
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

สร้างไฟล์ `.env.local`:

```bash
# Ably API Key — https://ably.com
ABLY_API_KEY=your_ably_api_key

# App password for login page
APP_PASSWORD=your_password
```

> **Ably API Key** ต้องมี capability: `voice-room:* → publish, subscribe, presence`

### 3. Run dev server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## Environment Variables (Vercel)

ตั้งค่าใน **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `ABLY_API_KEY` | Ably API Key พร้อม presence capability |
| `APP_PASSWORD` | รหัสผ่านสำหรับ login |

---

## How It Works

```
User A                    Ably                    User B
  │                         │                        │
  │── presence.enter() ────►│◄─── presence.enter() ──│
  │── publish("user-joined")►│                        │
  │                         │──► handleSignal() ──────│
  │◄──────────── WebRTC offer/answer/ICE ─────────────│
  │                                                    │
  └──────────── P2P Audio (ไม่ผ่าน server) ───────────┘
```

- **Ably** ทำหน้าที่เป็น Signaling Server และ Presence
- **WebRTC** ส่งเสียงโดยตรง P2P ระหว่าง browsers
- **Participant list** อิงจาก Ably Presence (reliable ทุก browser)

---

## Deployment

Push ไปที่ `main` branch → Vercel deploy อัตโนมัติ

```bash
git push origin main
```
