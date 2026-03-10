# GitHub Copilot Instructions — Land of Smile

## Project Overview
This is the **Land of Smile** project.
- Repository is hosted on **GitHub** (connected ✅)
- Deployment is handled via **Vercel**, connected to this GitHub repository (connected ✅)
- Every push to the `main` branch triggers an automatic deployment on Vercel.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Real-time Signaling**: Ably (WebSocket-based, managed service)
- **Audio**: WebRTC (Native Browser API, P2P mesh for ≤ 5 users)
- **Deployment**: Vercel (auto-deploy from `main` branch)
- **Version Control**: GitHub

---

## Project Structure

```
/
├── .github/
│   └── copilot-instructions.md
├── public/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── ably-token/route.ts   # Ably Token Auth endpoint
│   │   ├── room/[roomId]/page.tsx    # Voice room page
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Home — create/join room
│   ├── components/
│   │   ├── VoiceRoom.tsx             # Main room UI
│   │   ├── ParticipantList.tsx       # List of connected users
│   │   └── AudioControls.tsx         # Mute / Leave buttons
│   ├── hooks/
│   │   └── useWebRTC.ts              # WebRTC + Ably signaling logic
│   └── types/
│       └── index.ts                  # Shared TypeScript types
├── .env.local                        # ABLY_API_KEY (never commit)
├── package.json
└── tsconfig.json
```

---

## Coding Conventions

### General
- Use **TypeScript** for all new files.
- Use **functional components** with React hooks (no class components).
- Keep components **small and focused** — one responsibility per component.
- Use **named exports** for components (avoid default exports where possible).

### Naming
- **Components**: PascalCase (e.g., `HeroSection.tsx`)
- **Hooks**: camelCase prefixed with `use` (e.g., `useScrollPosition.ts`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **CSS classes**: kebab-case or follow Tailwind conventions

### File Organization
- Place all reusable components in `src/components/`.
- Place page-level components in `src/pages/` or `src/app/` (depending on framework).
- Place helper functions in `src/utils/` or `src/lib/`.
- Place TypeScript types/interfaces in `src/types/`.

---

## Git Workflow

- **Main branch**: `main` — production-ready code, auto-deploys to Vercel.
- **Feature branches**: `feature/<short-description>` (e.g., `feature/add-hero-section`)
- **Bug fix branches**: `fix/<short-description>` (e.g., `fix/nav-menu-overlap`)
- **Commit messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat: add hero section`
  - `fix: correct mobile layout`
  - `chore: update dependencies`
  - `docs: update README`

---

## Vercel Deployment

- **Production URL**: (add your Vercel URL here)
- Auto-deploy triggers on every push/merge to `main`.
- Preview deployments are created for every Pull Request automatically.
- Environment variables must be configured in the **Vercel Dashboard** (never commit `.env` files).

---

## Environment Variables

- Never commit secrets or API keys to the repository.
- Add all environment variables to `.env.local` for local development.
- Add the same variables in **Vercel Dashboard → Settings → Environment Variables** for production.
- Prefix client-side variables with `NEXT_PUBLIC_` (if using Next.js).

---

## Copilot Behavior Guidelines

- **Always** follow the coding conventions defined above.
- **Prefer** existing patterns found in the codebase over introducing new ones.
- **Always** write accessible HTML (use semantic elements, `aria-*` attributes where needed).
- **Always** handle loading and error states in async operations.
- **Avoid** inline styles — use CSS modules or Tailwind CSS classes.
- **Avoid** `any` type in TypeScript — use proper types or generics.
- **Suggest** unit tests for utility functions and critical components.
