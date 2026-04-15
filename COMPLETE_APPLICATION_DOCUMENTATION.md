# ConnectPlus Complete Application Documentation

This document provides a complete product + implementation overview of the ConnectPlus system across:

- `backend/` (API + data + business logic)
- `frontend/` (desktop web app)
- `frontend-mobile/` (mobile-first web app)
- `shared/` (cross-app route/navigation constants)

---

## 1) Product Overview

ConnectPlus is a unified business platform that combines:

- CRM pipeline management (companies, leads, opportunities)
- Presales delivery pipeline (requirements, solution design, BOQ, POC, proposal)
- Sales-to-operations execution (SCM, deployment, cloud)
- Internal workplace operations (tasks, attendance, leaves, reimbursements, HR modules)
- User/admin governance (roles, organizations, masters, settings)

It supports role-based usage patterns, including:

- Everyday users (task execution, attendance, leave, profile)
- Managers and organization members (assignment, team visibility, approvals)
- Admin and super admin users (organization setup, governance, elevated controls)
- HR-access users (HR module access and department/user profile operations)

---

## 2) Repository Architecture

| Area | Path | Purpose |
|---|---|---|
| Backend API | `backend/` | Express API, auth, validation, business services, Prisma DB layer |
| Desktop frontend | `frontend/` | Full React web app with broad CRM + operations coverage |
| Mobile frontend | `frontend-mobile/` | Mobile-first React app focused on tasks and workplace flows |
| Shared contracts | `shared/` | Route/nav constants used by frontend apps |
| Technical docs | `docs/` | Architecture flow docs (including attendance flow) |

---

## 3) Technology Stack

### Backend (`backend/`)

- Node.js + TypeScript
- Express 4 (`helmet`, `cors`, `cookie-parser`)
- Prisma 5 with PostgreSQL
- JWT cookie-based auth
- Zod validation
- Socket.IO server bootstrap
- `node-cron` background scheduling
- Microsoft integration stack (`@azure/identity`, `@microsoft/microsoft-graph-client`)
- File upload handling via multipart endpoints in feature modules

### Desktop frontend (`frontend/`)

- React 18 + Vite + TypeScript
- Tailwind CSS + component-level UI patterns
- React Router 6
- TanStack React Query
- Axios (credentialed cookie calls)
- Zustand auth/session store
- Additional libraries: `framer-motion`, `recharts`, `face-api.js`, `dnd-kit`, `react-hook-form`

### Mobile frontend (`frontend-mobile/`)

- React 18 + Vite + TypeScript
- React Router 6 + React Query + Zustand
- Mobile-first UI shell and navigation
- `face-api.js` powered attendance/profile flows (face verification use cases)

---

## 4) Backend Service Design

### API entry and runtime

- `backend/src/server.ts`:
  - Loads environment via `dotenv`
  - Creates HTTP server + Socket.IO
  - Registers scheduled presales cron jobs
  - Starts on `PORT` (default 4000), auto-increments on port conflict
- `backend/src/app.ts`:
  - Health endpoint: `/health`
  - API mounts by module under `/api/*`
  - Global error middleware via `errorHandler`

### Core backend module map

Mounted routers include:

- `auth`, `settings`, `dashboard`, `integrations`
- `companies`, `leads`, `opportunities`
- `presales`, `salesFlow`, `scm`, `deployment`, `cloud`
- `superAdmin`, `inbox`
- `hr`, `leaves`, `attendance`, `notifications`
- `hierarchyTasks`, `workTasks`
- `reimbursements`, `portfolioProjects`, `meetingRoomBookings`, `skills`, `certifications`

### Data model layer (Prisma)

Prisma schema includes core domains:

- Identity & access: `User`, `Role`, `Organization`, user tags/profile fields
- CRM: `Company`, `Lead`, `Opportunity`, plus notes/emails/activities and stage history
- Sales/operations chain: purchase order to dispatch/invoice/payment flow
- Presales structured entities: project lifecycle, BOQ, POC, proposals, stage logs
- Workplace operations: `WorkTask`, `HierarchyTask`, comments, activities, artifacts
- HR and employee operations: `HrDepartment`, `HrEmployee`, `LeaveRequest`
- Attendance: `AttendanceConfig`, `Attendance` (geo + face context fields)
- Financial workplace modules: `ReimbursementClaim`, attachments
- Collaboration and governance: notifications, audit logs, settings masters
- Portfolio projects and journals: full project + member + artifact + activity graph

---

## 5) Authentication and Authorization

### Authentication

Implemented under `/api/auth`:

- Email/password login (JWT session cookie)
- Microsoft SSO callback flow
- Session introspection endpoint (`/api/auth/me`)
- Logout and cookie invalidation

### Authorization

Implemented via middleware + role/dept logic:

- Route-level `authenticate` and role guards
- HR access guards (role/department/tag aware)
- Organization-scoped data restrictions in service logic (tasks, attendance, HR, etc.)
- Frontend route gating mirrors backend authorization intent

---

## 6) Desktop Frontend Feature Coverage (`frontend/`)

`frontend/src/App.tsx` covers a broad full-app workspace with route groups:

- Login/session bootstrap
- Dashboard and workspace shell
- CRM routes:
  - `/crm/companies`
  - `/crm/leads`
  - `/crm/opportunities`
- Presales routes:
  - `/presales`
  - `/presales/projects`
  - `/presales/boq`
  - `/presales/poc`
  - `/presales/proposals`
- Operations routes:
  - `/scm`
  - `/deployments`
  - `/cloud`
- Workplace/people routes:
  - `/tasks` (hierarchy task workflows)
  - `/inbox`
  - `/profile`
  - `/attendance`
  - `/meeting-rooms`
  - `/skills`
  - `/payroll`
  - `/leaves`
  - `/complaints`
- HR routes:
  - `/hr`
  - `/hr/departments`
  - `/hr/users/:userId`
  - `/hr/:section`
- Admin/elevated:
  - `/settings/users`
  - `/admin`
  - `/super-admin`
  - `/api-fetcher`

### Desktop implementation notes

- Navigation + access control are centralized with auth store + path guards.
- React Query drives API synchronization, cache invalidation, and real-time UX updates.
- Attendance/profile components integrate geolocation and face model APIs where required.
- Shared pages exist for leaves/reimbursement/meeting rooms for consistent behavior across desktop and mobile.

---

## 7) Mobile Frontend Feature Coverage (`frontend-mobile/`)

`frontend-mobile/src/App.tsx` is mobile-first and task-centric while still including core workplace modules:

- Login with email/password and Microsoft SSO
- Protected shell with mobile dock, drawer navigation, and notifications
- Task flows:
  - `/tasks/hierarchy`
  - `/tasks/hierarchy/:taskId`
- Project and workplace routes:
  - `/projects/portfolio`
  - `/projects/portfolio/:projectId`
  - `/profile`
  - `/attendance`
  - `/meeting-rooms`
  - `/skills`
  - `/payroll/*`
  - `/leaves`
  - `/complaints`
- HR routes:
  - `/hr`
  - `/hr/departments`
  - `/hr/users/:userId`
  - `/hr/:section`

### Mobile implementation notes

- Strong focus on mobile interaction patterns (bottom dock, drawers, sheets, touch-first actions).
- Hierarchy task management includes:
  - multi-assignee assignment
  - department handoff logic
  - artifact uploads
  - comments + activity timelines
  - completion request/approval lifecycle
- Attendance flows integrate geolocation + face verification UX.

---

## 8) Cross-Cutting Feature Implementations

### A) Hierarchy Task System

Across backend + both frontends:

- Organization-scoped assignments
- Multi-assignee workflows
- Status transitions with auditable activity history
- Artifact uploads for status/proof records
- Department handoff model for management routing
- Notifications and in-app activity trails

### B) Attendance System

Key behavior:

- Geo-perimeter validation against organization office config
- Face match verification against enrolled profile descriptor
- Check-in/check-out lifecycle on daily attendance record
- Manual override pathways for authorized users

Reference business-flow document: `docs/ATTENDANCE_ARCHITECTURE.md`.

### C) HR and Workplace Modules

Implemented modules include:

- HR module discovery and protected route access
- Department management and HR user profile access views
- Leave request lifecycle
- Reimbursement claim + attachment workflow
- Meeting room bookings
- Skills and certifications management

### D) Notifications and Inbox

- In-app notifications with read/unread states and metadata links
- Microsoft Graph inbox integration for message listing/details in workspace

---

## 9) API Surface Overview (High Level)

Primary backend entry points (mounted under `/api`):

- `/auth`
- `/settings`
- `/dashboard`
- `/integrations`
- `/companies`
- `/leads`
- `/opportunities`
- `/presales`
- `/sales-flow`
- `/scm`
- `/deployment`
- `/cloud`
- `/super-admin`
- `/inbox`
- `/hr`
- `/hierarchy-tasks`
- `/leaves`
- `/attendance`
- `/reimbursements`
- `/notifications`
- `/portfolio-projects`
- `/skills`
- `/certifications`
- `/meeting-room-bookings`

---

## 10) Data and File Handling Strategy

- Relational source of truth in PostgreSQL via Prisma.
- Domain entities include explicit organization linkage for tenant scoping.
- File artifacts are persisted via stored-path metadata patterns (profile photos, task artifacts, certification docs, reimbursement attachments, etc.).
- Rich JSON fields are used where flexible structures are needed (workflow metadata, notifications metadata, configurable settings blocks).

---

## 11) Operational Notes

- Backend dev script: `npm run dev` in `backend/`
- Desktop dev script: `npm run dev` in `frontend/`
- Mobile dev script: `npm run dev` in `frontend-mobile/`
- Prisma client is generated into `backend/src/generated/prisma` to avoid common Windows locking issues in default output paths.

---

## 12) Related Documentation

- `docs/APPLICATION_ARCHITECTURE.md` (system-level product flow diagrams)
- `docs/ATTENDANCE_ARCHITECTURE.md` (attendance process flows)
- `currentproject.md` (deep technical handoff and module mapping)

---

## 13) Summary

ConnectPlus is a multi-domain business platform with a shared backend and two frontend experiences:

- Desktop web app for broad operational coverage (CRM + presales + operations + admin + workplace)
- Mobile app for day-to-day execution (tasks, attendance, profile, and workplace modules)

The implementation is organized by feature modules, backed by a comprehensive Prisma domain model, and designed for role-aware, organization-scoped operation across both product surfaces.
