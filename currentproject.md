# ConnectPlus — Current Project Knowledge Base

This document is a handoff-oriented map of **what the product does**, **how the repo is organized**, and **where behavior lives** in code. It reflects the codebase as of the latest state in this repository (npm package names may still read `cachedigitech-*` in `package.json` files).

---

## 1. Purpose and product shape

ConnectPlus is a **multi-department business platform** that combines:

- **CRM** (companies, leads, opportunities, and a deep post-opportunity **sales / SCM / deployment / cloud** operational chain).
- **Presales** project lifecycle (staged workflow, BOQ, POC, proposals, requirements, solution design).
- **Workplace tasking**: classic **project tasks** with daily updates, plus **organization-scoped work tasks** with multiple “task flows” driven by user profile tags.
- **People & workplace** navigation (many routes are **placeholders** on web/mobile until dedicated APIs ship).
- **HR** entry points: module catalog, org **HR departments** (`HrDepartment`), integration with **CRM department masters** and **user profiles** for HR viewers.
- **Administration**: user/role/settings masters, super-admin **organizations**, optional **Microsoft** login and **Microsoft Graph** inbox.

---

## 2. Repository layout

| Area | Path | Role |
|------|------|------|
| Backend API | `backend/` | Express + Prisma + PostgreSQL |
| Web app | `frontend/` | React 18 + Vite + Tailwind + React Router |
| Mobile web | `frontend-mobile/` | Same stack pattern; routes aligned with shared nav |
| Shared constants | `shared/` | Cross-app navigation helpers (e.g. `workspaceNav.ts`) |

There is **no root-level `package.json`** in this snapshot; run scripts from `backend/`, `frontend/`, or `frontend-mobile/` as needed.

---

## 3. Technology stack

### Backend (`backend/`)

- **Runtime**: Node.js, **Express 4**, TypeScript (`ts-node-dev` in dev, `tsc` build).
- **Database**: **PostgreSQL** via **Prisma 5** (`backend/prisma/schema.prisma`).
- **Auth**: **JWT** in **httpOnly cookie** (`token`); bcrypt password verification for email login.
- **Validation**: **Zod** + `validateRequest` middleware.
- **Security**: `helmet`, `cors` with `credentials: true`, cookie parser.
- **Integrations**: `@microsoft/microsoft-graph-client`, `@azure/identity` (Graph + client credential flow).
- **Other**: `socket.io` (HTTP server created in `server.ts`; connection handler is a stub), `node-cron` (presales reminders), `puppeteer` / PDF utilities present in tree (PDF helper may be partially stubbed).

### Web (`frontend/`)

- **UI**: React 18, **Vite 5**, **Tailwind CSS**, **lucide-react**, **framer-motion**, **recharts**.
- **Data**: **TanStack React Query**, **Axios** (`src/lib/api.ts`, `withCredentials: true`).
- **State**: **Zustand** auth store (`src/stores/authStore.ts`).
- **Routing**: **React Router 6** (large `App.tsx` with many route definitions).
- **Dev server**: HTTPS on port **3000** with `/api` proxied to `http://localhost:4000` (`frontend/vite.config.ts`). Requires cert files under `../.certs/`.
- **Aliases**: `@shared` → `../shared`.

### Mobile shell (`frontend-mobile/`)

- Same general stack; default post-login path is **`/tasks/work`** (`MOBILE_DEFAULT_HOME_PATH` in `shared/workspaceNav.ts`).

---

## 4. Runtime and configuration

### Backend entry

- `backend/src/server.ts`: loads `dotenv`, creates HTTP server from `app`, registers **presales cron**, attaches **Socket.IO**, listens on `PORT` or **4000** (increments port if `EADDRINUSE`).
- `backend/src/app.ts`: mounts routers under `/api/*` and `/health`.

### Environment (typical)

Backend expects (non-exhaustive): `DATABASE_URL`, `JWT_SECRET`, and for Microsoft features `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, plus any vars used in `authService` for OAuth redirect URIs.

Frontend uses `VITE_API_URL` (optional if using Vite proxy).

---

## 5. Authentication and identity

### Email / password

- `POST /api/auth/login` — validates body, issues JWT, sets cookie.
- `POST /api/auth/logout` — clears cookie.
- `GET /api/auth/me` — requires cookie; returns enriched user from DB (name, email, department, **tags** from `tagsJson`, role name, organization, manager fields, direct report count).

### Microsoft

- `POST /api/auth/login/microsoft/callback` — exchanges authorization **code** + **PKCE** verifier + **redirectUri** for session; sets same cookie contract as password login.

### Client contract

- Browsers call APIs with **credentials** so the **httpOnly** JWT cookie is sent.
- Axios interceptor on 401 clears Zustand user and redirects to `/login`.

---

## 6. Authorization model

### Roles (string names on `Role` / JWT)

Common patterns in code include: `SUPER_ADMIN`, `ADMIN`, `MANAGEMENT`, `USER`, and HR-oriented names such as `HR`, `HR_ADMIN`. Exact permissions for CRM modules are often **department-scoped** on the frontend.

### Backend middleware

- `authenticate` — JWT from cookie → `req.user` (`id`, `role`, optional `department` from token).
- `requireRoles([...])` — role allow-list (used e.g. for team task list, integrations fetch, deleting opportunities).
- `requireDashboardAnalyticsAccess` — **ADMIN/SUPER_ADMIN** always; otherwise department (resolved from DB) must be **sales** or **presales**.
- `requireHrAccess` — loads user from DB (role, department, **tagsJson**), then `userHasHrAccess` in `backend/src/lib/hrAccess.ts` (must align with frontend `frontend/src/lib/hrAccess.ts`).
- `hydrateAuthUserFromDb` / `departmentAccess` — used where **JWT department** may be stale; resolves normalized department for access checks.

### Frontend route and nav gating

- `frontend/src/lib/accessControl.ts`:
  - **`SUPER_ADMIN`**: all routes.
  - **Universal paths** (dashboard, workspace/tasks, inbox, profile, attendance, meeting rooms, skills, payroll, leaves, complaints): any signed-in user.
  - **Department → URL prefix**: e.g. `sales` → `/crm/*`, `presales` → `/presales*`, `scm` → `/scm*`, `deployment` → `/deployments*`, `cloud` → `/cloud*`.
  - **`/settings`**: `ADMIN` or `SUPER_ADMIN`.
  - **`/super-admin`**: `SUPER_ADMIN` only.
  - **`/hr/*`**: HR access helper (role, department synonyms, tags).
  - **`/api-fetcher`**: intentionally **not** granted via department rules (restricted).
- Sidebar grouping uses `canSeeNavGroup` with the same department ↔ **Sales / Presales / SCM / Deployment / Cloud / HR** mapping.

---

## 7. Data model (Prisma) — domain summary

The schema in `backend/prisma/schema.prisma` is large; groupings:

| Domain | Main models |
|--------|-------------|
| Identity & org | `User`, `Role`, `Organization` (`modules` JSON on org), `OofStatus` (out-of-office + delegate) |
| CRM masters | `Company`, `Lead` (+ `LeadNote`, `LeadEmail`, `LeadActivity`), `Opportunity` (+ stage history) |
| Commercial / quoting | `Quotation`, `QuoteApproval` (margins, line items, PDF URL) — used in analytics and linked from sales flow PO creation |
| Sales flow extras | `OemAlignment`, `VendorQuote`, `ClientQuoteSubmission`, `ClientFollowUp` |
| SCM | `PurchaseOrder`, `Ovf`, `ScmOrder`, `WarehouseReceipt`, `Dispatch`, `Invoice`, `PaymentReceived`, `PaymentFollowup`, `ScmExpense`, `ScmStageHistory` |
| Deployment | `Deployment`, `SiteSurvey`, `BalActivity`, `UatTestCase`, `DeploymentStageHistory` |
| Cloud | `CloudEngagement`, `CloudStageHistory` (rich JSON sections for intake, assessment, architecture, migration, managed support) |
| Projects & tasks | `Project`, `ProjectTask`, `DailyUpdate` |
| Workplace tasks | `WorkTask`, `WorkTaskComment`, `WorkTaskActivity` (scoped to `organizationId`, `taskFlowKey`) |
| Presales | `PresalesProject`, `PresalesStageLog`, `RequirementDoc`, `SolutionDesign`, `BOQ`, `POC`, `Proposal`, `PresalesActivity` |
| HR | `HrDepartment`, `HrEmployee` (optional link to `User`) |
| Settings / reference | `CompanyProfile`, `ApprovalConfig`, `RevenueTarget`, `NotificationPreference`, `DashboardPreference`, `Product`, `Distributor`, `Industry`, `LeadSource`, `LossReason`, `Department` (CRM master), `SkillTag`, `ApiFetchSession` |
| Compliance / files | `Agreement`, `Policy`, `PolicyAcknowledgement`, `Attachment`, `AuditLog`, `Notification` |

**Note:** `User.department` is a string used for CRM area routing; **`HrDepartment`** is a separate org structure for HR.

---

## 8. HTTP API surface (by router)

Base path patterns are defined in `backend/src/app.ts`. Several legacy **duplicate mounts** exist (e.g. `/api/leads` and `/api/v1/crm/leads`).

### Auth — `/api/auth`

- Login, Microsoft callback, logout, `me`.

### Settings — `/api/settings`

- **Roles**, **users** (CRUD, merge, OOF), **company profile**, **approval config** (margin thresholds), **revenue targets**, **notification preferences**.
- **Masters**: products, distributors, industries, lead sources, loss reasons, **departments** (CRM), skill tags.

### Dashboard — `/api/dashboard`

- `GET /admin` — analytics (gated; see middleware).
- `GET/POST /preferences` — per-user dashboard layout JSON.

### CRM

- **Companies** — `/api/companies` (+ v1 alias): list, get, create, patch, delete.
- **Leads** — list, pipeline summary, get, create, patch, status, convert (including convert-to-opportunity), notes, send email, timeline, activities.
- **Opportunities** — list, get, patch stage, delete (admin roles).

### Sales flow — `/api/sales-flow`

Per-opportunity workflow data and mutations: OEM alignments, vendor quotes, client quotes, follow-ups, **close won/lost**, **purchase orders** (optional `quotationId`).

### SCM — `/api/scm`

Opportunity SCM workflow: stage updates, **OVF**, **orders**, warehouse receipts, dispatches, **invoices**, **deployments** (create from dispatch), **expenses**.

### Deployment — `/api/deployment`

List deployments, workflow, stage updates, kickoff, site surveys, BAL activities, UAT cases, go-live.

### Cloud — `/api/cloud`

List/create engagements, workflow, stage updates, structured POST endpoints for intake, assessment, architecture plan, security framework, migration, managed support.

### Presales — `/api/presales` (+ v1 aliases)

Projects CRUD/summary, stage advancement, requirements, solution design, BOQ (incl. submit), POC, proposal, board views for BOQ/POC/proposals, activities.

### Tasks (project tasks) — `/api/tasks`

- `GET /my` — current user’s project tasks.
- `GET /team` — **ADMIN / SUPER_ADMIN / MANAGEMENT** only.
- Task detail, status updates, daily updates (and related patch routes in `routes.ts`).

### Work tasks (workplace) — `/api/work-tasks`

- List task **flow** definitions, list tasks (query filters), assignable users, create, get, patch, assign, comments.
- **Task flows** (`taskFlowRegistry.ts`): `employee`, `manager`, `organization_member`, `intern`, `hr` — each with its own ordered **status stages**.
- **Org isolation**: tasks belong to `organizationId`; assignee/creator must match org rules enforced in service layer.
- **Tag-based creation**: non-elevated users may only create tasks in flows allowed by their **user tags** (`tagsJson`).

### Inbox — `/api/inbox`

- List messages, get message, mark read — backed by **Microsoft Graph** application access to `/users/{email}/messages`.
- **Delegation**: if logged in as the configured keeper mailbox, optional mailbox parameter is restricted via `inbox/delegation.ts` and `keeperEmail`.

### Integrations — `/api/integrations`

- `POST /fetch`, `GET /fetch/sessions` — **SUPER_ADMIN** only; stores `ApiFetchSession` records (debug / admin tool matching UI **API Fetcher**).

### Super admin — `/api/super-admin`

- Organization overview, get organization, create organization.

### HR — `/api/hr`

- Public `GET /health`; then `authenticate` + `requireHrAccess`.
- `GET /modules` — static module list (`hrModules.ts`), mirrored on clients as `HR_MODULES_STATIC`.
- `GET /hr-departments` — `HrDepartment` rows for user’s `organizationId`.
- `GET /users/:id/profile` — HR-oriented user profile from settings service.
- **CRM departments** (master list + user counts, users in department, create/update/delete): `/crm-departments` — same underlying data as Settings masters, exposed for HR UI.

---

## 9. Background jobs

- **`registerPresalesCron`** (`backend/src/utils/presalesCron.ts`): daily job (cron `0 9 * * *`) finds **stale presales projects** (no stage progress for >7 days), resolves assignee by name, and uses **`notificationService`** to notify **MANAGEMENT/ADMIN/SUPER_ADMIN** users.

---

## 10. Frontend web — routing and UX (high level)

Routes live in `frontend/src/App.tsx` (file is very large). Representative areas:

| Path prefix | Purpose |
|-------------|---------|
| `/login` | Login |
| `/`, `/dashboard`, `/workspace` | Shell / dashboard entry |
| `/crm/companies`, `/crm/leads`, `/crm/opportunities` | CRM |
| `/scm`, `/scm/opportunities/:id` | SCM workspace |
| `/deployments`, `/cloud` | Operations |
| `/presales` and sub-routes | Presales hub, projects, BOQ/POC/proposals boards |
| `/tasks`, `/tasks/:id` | Project tasks + detail |
| `/tasks/work`, `/tasks/work/:id` | **Workplace** work tasks |
| `/tasks/team` | **Task allocation** (nav restricted to admin/management roles) |
| `/inbox` | Graph inbox UI |
| `/profile`, `/attendance`, `/meeting-rooms`, `/skills`, `/payroll`, `/leaves`, `/complaints` | **People & workplace** — mostly **placeholder pages** (`peopleWorkplacePlaceholders.tsx`) on web |
| `/api-fetcher` | Super-admin tool (aligned with backend integrations) |
| `/settings/users` | User admin |
| `/hr`, `/hr/departments`, `/hr/users/:userId`, `/hr/:section` | HR home, department management, user profile, section placeholders |
| `/super-admin`, `/admin` | Elevated areas |

**Navigation**: `frontend/src/components/layout/Sidebar.tsx` builds groups (Overview, People & workplace, Sales, Presales, SCM, Deployment, Cloud, Tools, Admin) and an **HR** dropdown (modules from `GET /api/hr/modules` with static fallback).

**Guards**: `AccessGuard` (and related layout) use `canAccessPath` for deep links.

---

## 11. Frontend mobile — routing (high level)

`frontend-mobile/src/App.tsx` aligns task and workplace paths with `shared/workspaceNav.ts` (e.g. `/tasks/work`, `/tasks/:id`, `/tasks/team`). Some **People & workplace** screens are **placeholder** components. HR pages exist (e.g. department management, HR home) parallel to web.

---

## 12. Shared package

- **`shared/workspaceNav.ts`**: `WORKSPACE_TASK_LINKS`, `PEOPLE_WORKPLACE_LINKS`, helpers `isUniversalWorkspacePath`, `navLinkIsActive`, mobile default home path. **Single place** to add new cross-app links.

---

## 13. Feature → implementation map (quick reference)

| Feature | Primary backend | Primary frontend |
|---------|-----------------|------------------|
| Login / session | `modules/auth` | Login page, `authStore`, `api.ts` |
| User / role / masters | `modules/settings` | Settings users, super-admin |
| CRM companies & leads | `modules/companies`, `modules/leads` | `/crm/*` pages in `App.tsx` |
| Opportunities | `modules/opportunities` | Opportunity list/detail |
| Post-opp sales artifacts | `modules/salesFlow` | Opportunity / sales workflow UI |
| SCM chain | `modules/scm` | `/scm` |
| Field deployment | `modules/deployment` | `/deployments` |
| Cloud engagements | `modules/cloud` | `/cloud` |
| Presales lifecycle | `modules/presales`, cron | `/presales/*` |
| Project tasks & updates | `modules/tasks` | `/tasks` |
| Workplace work tasks | `modules/workTasks`, `lib/taskFlowRegistry` | `/tasks/work`, `MyTasks`-style pages |
| Mailbox | `modules/inbox` + Graph | `/inbox` |
| Org analytics | `modules/dashboard` | Dashboard widgets calling `/api/dashboard/admin` |
| API Fetcher | `modules/integrations` | `/api-fetcher` |
| Super-admin orgs | `modules/superAdmin` | `/super-admin` |
| HR module list & departments | `modules/hr` | `/hr/*`, `hrModules.ts`, `DepartmentManagement*` |

---

## 14. Known gaps / engineering notes

- **Socket.IO** is initialized but not used for live updates yet.
- **PDF generation** utility exists; some methods may still throw “not implemented” — verify before relying on PDFs in production.
- **Quotation** entities are in the database and analytics; **dedicated quotation REST routes** are not registered in `app.ts` — quoting may be driven from embedded logic in large frontend modules or future endpoints; confirm in `App.tsx` / opportunity screens when extending.
- **People & workplace** modules are largely **UI placeholders** pending product APIs.
- **HR** submodule paths under `/hr/:section` mostly route to **placeholder** pages except areas explicitly built (e.g. departments, user profile).

---

## 15. Suggested onboarding order for a senior engineer

1. Read `backend/src/app.ts` and skim each `modules/*/routes.ts`.
2. Scan `backend/prisma/schema.prisma` for the entities involved in your area.
3. Trace **auth**: `middleware/auth.ts` → `modules/auth/service.ts` → `GET /api/auth/me`.
4. Trace **authorization** for your feature: frontend `accessControl.ts` + any backend `require*` middleware.
5. Open the matching **React route** in `frontend/src/App.tsx` and follow API calls in `frontend/src/lib/api.ts` usage.

---

*This file is generated from repository inspection; when behavior diverges from this document, the code and Prisma schema are authoritative.*
