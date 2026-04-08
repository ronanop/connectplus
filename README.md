# Connectplus CRM

Full-stack CRM (web + mobile clients, Express API, PostgreSQL via Prisma). Use this README to get a **consistent local setup** and to collaborate without breaking API, UI, and database layers.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (local install or Docker)
- **Git**

Optional: [mkcert](https://github.com/FiloSottile/mkcert) for HTTPS dev certificates used by the Vite apps.

## Repository layout

| Path | Role |
|------|------|
| `backend/` | Express API, Prisma schema & migrations |
| `frontend/` | Web app (Vite + React), default dev server **https://localhost:3000** |
| `frontend-mobile/` | Mobile-oriented Vite app, default **https://localhost:3001** |
| `PROJECT_OVERVIEW.md` | Architecture and feature map |

## First-time setup

### 1. Clone and environment files

```bash
git clone <your-repo-url>
cd connectplus
```

Copy the example env files and edit **your local** values (passwords, Azure IDs, JWT secret):

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
copy frontend-mobile\.env.example frontend-mobile\.env
```

On macOS/Linux use `cp` instead of `copy`. Never commit `.env` files; they are gitignored.

### 2. HTTPS certificates (required for `npm run dev` in frontends)

Both Vite configs expect PEM files at the repo root:

- `.certs/dev-cert.pem`
- `.certs/dev-key.pem`

Create the folder and generate certs, for example with mkcert from the **repository root**:

```bash
mkdir .certs
mkcert -install
mkcert -key-file .certs/dev-key.pem -cert-file .certs/dev-cert.pem localhost 127.0.0.1 ::1
```

If your team shares another method, keep the same filenames or update `frontend/vite.config.ts` and `frontend-mobile/vite.config.ts` together.

### 3. Database

1. Create an empty PostgreSQL database (e.g. `crm_db`).
2. Set `DATABASE_URL` in `backend/.env` to match your user, password, host, port, and database name.

### 4. Backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

API listens on **http://localhost:4000** by default. Check **GET** [http://localhost:4000/health](http://localhost:4000/health).

### 5. Web frontend

In a new terminal:

```bash
cd frontend
npm ci
npm run dev
```

With the default setup, the browser uses the Vite **proxy**: requests to `/api` go to `http://localhost:4000`, so you often leave `VITE_API_URL` empty in dev.

### 6. Mobile frontend (optional)

```bash
cd frontend-mobile
npm ci
npm run dev
```

## How the pieces connect

- **Web / mobile → API:** Axios uses `VITE_API_URL` when set; otherwise same-origin `/api` + Vite proxy in development.
- **API → DB:** Only through Prisma; schema changes belong in `backend/prisma/migrations/`.
- **Auth:** JWT in HTTP-only cookies; frontend and backend must share CORS/cookie expectations (`credentials: true` is already used).

For deeper detail, see `PROJECT_OVERVIEW.md`.

## Collaborating (remote team)

- Use **feature branches** and **Pull Requests** into `main` (or your agreed default branch).
- Keep **API changes** backward compatible when possible, or update **all** clients in the same PR.
- **Database:** never edit production/staging schema by hand; ship Prisma migrations with the code.
- **Secrets:** share non-production credentials through a private channel, not in GitHub issues or commits.

More process detail: `CONTRIBUTING.md`.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Frontend cannot reach API | Backend running on port 4000; `VITE_API_URL` if not using dev proxy |
| Prisma errors | `DATABASE_URL`, PostgreSQL running, `npx prisma migrate deploy` |
| Vite fails on HTTPS | `.certs/dev-cert.pem` and `.certs/dev-key.pem` exist |
| MS login fails | `VITE_PUBLIC_APP_URL` and redirect URIs in Azure AD match your dev URL |
