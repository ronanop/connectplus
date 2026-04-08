# Connectplus CRM & Operations Platform – Implementation To‑Do List

This document tracks the build workflow across frontend/ and backend/. Work through phases in order; sub‑items can run in parallel where it makes sense.

---

## Phase 0 – Foundation & Architecture

- Backend
  - Install deps in `backend/`, run initial Prisma migration.
  - Implement `modules/auth` skeleton: login, logout, `/me` using JWT httpOnly cookies.
  - Add shared utilities in `src/utils/`: `mailer`, `pdfGenerator`, `fileStorage`.
  - Add basic `modules/notifications` skeleton (service only, no UI).
- Frontend
  - Install deps in `frontend/`.
  - Define full App Router structure under `src/app/` (auth + dashboard subroutes).
  - Implement `components/layout/AppShell` wrapping all `(dashboard)` pages.
  - Implement theme toggle using `.dark` on `<html>` and `themeStore` (Zustand).

---

## Phase 1 – Design System & UI Primitives

- Define design tokens (already in CSS) and extend as needed (spacing, radii).
- Build `components/ui`:
  - Button (primary, secondary, destructive, ghost) with loading state.
  - Badge + StatusBadge using global status color mapping.
  - Card with glassmorphism + top glow in dark mode.
  - DataTable using TanStack Table v8 (sorting, pagination, selection, row actions).
  - Modal, Drawer, FileUpload (drag & drop), Toast (Sonner).
  - Skeleton loaders for table, cards, forms.
- Build `components/charts`:
  - BarChart, FunnelChart, DonutChart, LineChart (Recharts wrappers).
- Add keyboard shortcuts handler (CMD+K, CMD+N, CMD+D, ESC, `?`) and shortcuts modal.

---

## Phase 2 – Settings & Administration

- Backend (`modules/settings`)
  - User management APIs: CRUD users, assign roles, activate/deactivate.
  - OOF management: set OOF ranges, delegate user.
  - Business configuration APIs: approval thresholds, quote validity, payment terms, revenue targets, notification preferences.
  - Masters APIs: product catalog, distributor/OEM list, industry verticals, lead sources, loss reasons, departments, skill tags.
- Frontend (`/settings`)
  - Users page with table + edit forms.
  - Business config forms and save flows.
  - Master data CRUD pages.

---

## Phase 3 – Auth, RBAC & Layout Experience

- Backend
  - Complete auth routes (`/auth/login`, `/auth/logout`, `/auth/me`).
  - Integrate RBAC middleware (roles from `roles.permissions_json`).
- Frontend
  - Login page at `(auth)/login`.
  - Protect `(dashboard)` routes; redirect unauthenticated to login.
  - Sidebar:
    - Groups: OVERVIEW, SALES, OPERATIONS, FINANCE, PROJECTS, COMPLIANCE, ANALYTICS, ADMIN.
    - Role‑based visibility per PRD.
    - Active item styling (left border + gradient).
  - TopBar:
    - Breadcrumb, CMD+K search trigger, theme toggle, notification bell, user menu.

---

## Phase 4 – My Tasks / Personal To‑Do (/tasks)

- Backend (`modules/tasks`)
  - Add `tasks` table: user, title, description, due_at, priority, linked_entity_type/id, status, source, timestamps.
  - APIs:
    - `GET /tasks/my` with filters (status, due range, priority).
    - `POST /tasks` to create manual tasks.
    - `PATCH /tasks/:id` to update status and fields.
  - Hook system task creation for:
    - BOQ review, SOW review.
    - Quote approvals, PO validation.
    - Daily update validation for TLs.
- Frontend (`/tasks`)
  - Route: `src/app/(dashboard)/tasks/page.tsx`.
  - Views: List / Kanban / Calendar toggle.
  - Overdue tasks: red highlight, sorted to top.
  - Task create/edit modal with React Hook Form + Zod.
  - Completion animation (scale + fade checkmark).
  - Floating widget (bottom‑right) showing top 3 due tasks + quick‑add.
  - Slide‑down My Tasks panel from TopBar.
  - Sidebar item “My Tasks” with pending count badge.

---

## Phase 5 – Dashboard & CMD+K Spotlight

- Backend (`modules/dashboard`, `modules/reports`)
  - KPI endpoints: active deals, monthly revenue, leads converted, pending approvals, POs pending dispatch, open deployments.
  - Activity feed endpoint (recent cross‑module events).
  - Aggregations for pipeline funnel, revenue bar, lead source pie, win/loss donut.
- Frontend (`/dashboard`)
  - Welcome strip (“Good morning [Name]”).
  - KPI cards with count‑up animation and trend arrows.
  - Charts using `components/charts`.
  - Activity feed with 60s auto‑refresh.
  - Quick‑action cards row.
- CMD+K Spotlight
  - Full‑screen overlay searching leads, opportunities, invoices, tasks.
  - Recent searches when empty state.
  - Keyboard navigable results.

---

## Phase 6 – CRM: Leads & Opportunities

- Backend (`modules/crm/leads`, `modules/crm/opportunities`)
  - Implement `leads` APIs: list/filter/search, create, update, soft delete.
  - Implement `opportunities` APIs: Kanban by stage, detail with related docs/quotes.
  - Lead → Opportunity conversion:
    - Enforce required BOQ or SOW attachment.
    - Update lead status and create opportunity.
  - Add audit logging for all lead/opportunity changes.
- Frontend
  - `/crm/leads`:
    - Table view: columns per PRD + actions.
    - Kanban by status (no drag for leads).
    - New Lead form.
    - Import/export buttons.
    - Right Drawer quick‑view.
  - `/crm/opportunities`:
    - Kanban for stages (no drag, transitions via actions).
    - Detail page with tabs: Overview, Documents, Quotations, Activity Log, Communications.

---

## Phase 7 – Sales: Quotations, Approvals, Purchase Orders

- Backend (`modules/sales/quotations`, `modules/sales/approvals`, `modules/sales/purchase-orders`)
  - Quotation builder:
    - Create from opportunity, auto‑number, default dates, T&Cs, taxes.
    - Line items and margin calculations per HW/SW/Services.
  - Margin approval gate logic and approver workflows.
  - Quote PDF generation via Puppeteer.
  - Purchase orders: creation, validation/rejection, OVF draft creation.
  - Approvals inbox API for quotes/POs/OVFs.
- Frontend
  - `/sales/quotations`, `/sales/approvals`, `/sales/purchase-orders`.
  - DataTable views with filters and inline actions.
  - Quote editor UI and approvals UI.

---

## Phase 8 – Presales: BOQ, SOW, PoC

- Backend (`modules/presales`)
  - BOQ entity + line items, statuses, review actions.
  - SOW entity + checklist, resource estimates, approvals.
  - PoC entity + lifecycle and outcomes.
- Frontend
  - `/presales/boq`, `/presales/sow`, `/presales/poc` list + detail views.
  - Inline PDF viewers, builders, and comment/approval forms.

---

## Phase 9 – SCM: PO Received, OVF, Procurement, Dispatch, Expenses

- Backend (`modules/scm`)
  - Implement `scm_orders`, `warehouse_receipts`, `dispatches`, `scm_expenses` workflows.
  - Lead‑time calculator, MIP notifications, delivery → invoice trigger.
- Frontend
  - `/scm/po-received`, `/scm/ovf`, `/scm/procurement`, `/scm/dispatch`, `/scm/expenses` pages.

---

## Phase 10 – Deployment

- Backend (`modules/deployment`)
  - `deployments`, `site_surveys`, `bal_activities`, `uat_test_cases` APIs.
  - Stage machine from Initiated → Go‑Live.
  - Auto‑create deployment on Delivered deals.
- Frontend
  - `/deployment/projects`, `/deployment/site-survey`, `/deployment/tasks`.
  - Site survey digital form + PDF output.
  - BAL task board and UAT logging.

---

## Phase 11 – Finance

- Backend (`modules/finance`)
  - `invoices`, `payment_followups`, `payments_received` APIs.
  - Payment status and aging logic.
  - Finance expense aggregation.
- Frontend
  - `/finance/invoices`, `/finance/payments`, `/finance/expenses`.

---

## Phase 12 – Projects (Data/AI & Cloud)

- Backend (`modules/projects`)
  - Projects, project tasks, daily updates, performance metrics.
- Frontend
  - `/projects/data-ai`, `/projects/cloud` workspaces.
  - Kanban boards, daily updates UI, performance views.

---

## Phase 13 – Legal & Compliance

- Backend (`modules/legal`)
  - Agreements and policies workflows, acknowledgements.
- Frontend
  - `/legal/agreements`, `/legal/policies`.

---

## Phase 14 – Notifications, Real‑Time & Reports

- Backend
  - Complete notification triggers from PRD (in‑app, email, optional SMS).
  - Socket.io integration for real‑time notifications.
  - Reports & analytics endpoints (sales, operations, team performance, revenue milestones).
  - Monthly executive summary generation job.
- Frontend
  - Notification bell slide‑down panel, mark‑all‑read.
  - `/reports` analytics dashboards and management revenue progress bar.

