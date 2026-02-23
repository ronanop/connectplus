 # Cachedigitech CRM – Project Overview

 ## 1. Application Description

 Cachedigitech CRM is a full‑stack sales and presales workspace designed around a B2B sales funnel:

 - Capture and qualify **leads**
 - Convert qualified leads into **opportunities**
 - Manage end‑to‑end **presales projects** (requirements, solution design, BOQ, PoC, proposals)
 - Provide **dashboards**, **notifications**, and **admin settings** to support daily operations

 The core philosophy is:

 - One canonical record per lead and opportunity
 - A structured presales lifecycle with clearly defined stages
 - Opinionated UI that keeps presales engineers and sales aligned on the same data

 ---

 ## 2. Tech Stack

 ### 2.1 Frontend

 - **Framework**: React 18 (functional components with hooks)
 - **Language**: TypeScript
 - **Bundler/Dev server**: Vite
 - **Routing**: React Router DOM
 - **Data fetching & caching**: @tanstack/react-query
 - **HTTP client**: Axios (wrapped via `api` utility)
 - **State management**: Zustand stores (auth, theme, etc.)
 - **Forms & validation**:
   - React Hook Form (where used)
   - Zod for schema‑based validation (mirroring backend)
 - **Styling**:
   - Tailwind CSS for utility‑first styling
   - Custom CSS variables for theme colors and surfaces
 - **Charts & visualizations**: Recharts
 - **UI helpers**:
   - React Toastify for notifications
   - Lucide React icons
   - Framer Motion for subtle animations

 Key entrypoints:

 - SPA bootstrap: [frontend/src/main.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/main.tsx)
 - Main UI composition and routes: [frontend/src/App.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/App.tsx)
 - App shell and layout: [frontend/src/components/layout/AppShell.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/components/layout/AppShell.tsx)
 - Sidebar navigation: [frontend/src/components/layout/Sidebar.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/components/layout/Sidebar.tsx)

 ### 2.2 Backend

 - **Runtime**: Node.js
 - **Framework**: Express
 - **Language**: TypeScript
 - **ORM**: Prisma
 - **Auth & security**:
   - JSON Web Tokens (JWT) stored in HTTP‑only cookies
   - RBAC via roles such as `SUPER_ADMIN`, `ADMIN`, `SALES`, `PRESALES`, `MANAGEMENT`
   - Helmet and CORS middleware
 - **Validation**: Zod schemas per module
 - **Background jobs**:
   - node-cron for scheduled presales health checks
 - **Real‑time**: Socket.IO server (reserved for future real‑time notifications)
 - **Email**: Nodemailer (for onboarding and system emails)

 Key entrypoints:

 - Express app and route wiring: [backend/src/app.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/app.ts)
 - HTTP server & Socket.IO & cron registration: [backend/src/server.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/server.ts)
 - Prisma schema and models: [backend/prisma/schema.prisma](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/prisma/schema.prisma)

 ### 2.3 Database & Infrastructure

 - **Database**: Relational database accessed through Prisma (generated client under `@prisma/client`)
 - **Migrations**: Prisma migrations under `backend/prisma/migrations`
 - **Seeding**: Node seed script using `PrismaClient`
   - [backend/seed.js](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/seed.js)

 ---

 ## 3. High‑Level Workflow

 ### 3.1 Lead to Opportunity to Presales

 1. **Lead Capture**
    - User creates a lead with company, contact, source, requirement, and estimated value.
    - Lead status flows through: `New → Contacted → Qualified → Proposal → Negotiation → Won/Lost`.
 2. **Lead Qualification**
    - Sales reviews leads, updates status, and adds timeline notes/activities.
 3. **Convert to Opportunity**
    - Once qualified, a lead is converted to an opportunity via a backend mutation.
 4. **Presales Project Creation**
    - For high‑potential opportunities, a presales project is created and linked to the lead.
    - Presales project has its own lifecycle stages (`INITIATED` → `REQUIREMENT_ANALYSIS` → `SOLUTION_DESIGN` → `BOQ_CREATION` → `POC` → `PROPOSAL_GENERATION` → `DEAL_CLOSURE_SUPPORT` → `CLOSED`).
 5. **Requirements, Solution, BOQ, PoC, Proposal**
    - Presales engineers progressively fill:
      - Requirements document
      - Solution design
      - BOQ (Bill of Quantities)
      - PoC plan and outcomes
      - Commercial proposal
 6. **Monitoring & Notifications**
    - Dashboards show summary metrics.
    - A scheduled cron job flags projects stuck for too long in a stage and notifies engineers and management.

 ---

 ## 4. Core Features and Their Implementation

 ### 4.1 Authentication & RBAC

 **Feature**

 - User login, logout, and session validation
 - Role‑based access for modules (e.g. presales only accessible to PRESALES/MANAGEMENT/ADMIN)

 **Implementation**

 - Backend:
   - Routes: [backend/src/modules/auth/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/auth/routes.ts)
   - Controller: [backend/src/modules/auth/controller.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/auth/controller.ts)
   - Middleware:
     - Authentication and user extraction: [backend/src/middleware/auth.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/middleware/auth.ts)
     - Role‑based access: [backend/src/middleware/rbac.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/middleware/rbac.ts)
 - Frontend:
   - Auth store: [frontend/src/stores/authStore.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/stores/authStore.ts)
   - Login flow in `App.tsx` routes with guarded access based on auth state.

 ### 4.2 Admin Dashboard

 **Feature**

 - Admin‑only dashboard summarizing leads, opportunities, and quotations over time
 - Configurable chart preferences (e.g. show lead owner, opportunity stage)

 **Implementation**

 - Backend:
   - Route: [backend/src/modules/dashboard/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/dashboard/routes.ts)
   - Service: [backend/src/modules/dashboard/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/dashboard/service.ts)
   - Uses Prisma groupBy on `lead`, `opportunity`, and `quotation` to compute counts and segments.
 - Frontend:
   - Admin dashboard view inside [frontend/src/App.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/App.tsx)
   - Recharts components (BarChart, PieChart) to render segment distributions
   - Preferences stored via `/api/dashboard/preferences` and used to toggle series.

 ### 4.3 Leads Management

 **Feature**

 - Leads list with table and pipeline (kanban) views
 - Lead creation with validation and live preview
 - Lead detail with owner, contact information, requirement, and timeline
 - Convert lead to opportunity

 **Implementation**

 - Backend:
   - Routes: [backend/src/modules/leads/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/leads/routes.ts)
   - Controller: [backend/src/modules/leads/controller.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/leads/controller.ts)
   - Service: [backend/src/modules/leads/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/leads/service.ts)
   - Validation schemas: [backend/src/modules/leads/validation.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/leads/validation.ts)
   - Key flows:
     - `GET /api/leads` – paginated list with search and status filter
     - `GET /api/leads/pipeline` – aggregate stage counts
     - `POST /api/leads` – create lead
     - `PATCH /api/leads/:id/status` – update status
     - `POST /api/leads/:id/convert-to-opportunity` – convert to opportunity
 - Frontend:
   - Leads list & pipeline: `LeadsPage` in [frontend/src/App.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/App.tsx)
     - Uses `useQuery` to call `/api/leads` and `/api/leads/pipeline`
     - Toggle between table and pipeline views via local UI state
   - Create lead: `LeadCreatePage` in `App.tsx`
     - Local `useState` form model
     - `useMutation` to `POST /api/leads`
     - Required field tracking and completion badge
   - Lead detail: `LeadDetailPage` in `App.tsx`
     - `useQuery` for `GET /api/leads/:id`
     - Status dropdown with `useMutation` to patch status
     - “Convert to Opportunity” button hitting `POST /api/leads/:id/convert-to-opportunity`

 ### 4.4 Opportunities

 **Feature**

 - List of opportunities seeded from leads if the table is empty
 - Filtering by stage and search

 **Implementation**

 - Backend:
   - Routes: [backend/src/modules/opportunities/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/opportunities/routes.ts)
   - Service: [backend/src/modules/opportunities/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/opportunities/service.ts)
   - Logic:
     - On first access, seeds `opportunity` from recent leads.
     - `listOpportunities` supports `search`, `stage`, `page`, `pageSize` with filtering on company/contact names.
 - Frontend:
   - Opportunities page routed from `App.tsx`, using React Query to call `/api/opportunities` and render as a structured list or board (depending on UI design).

 ### 4.5 Presales Projects

 Presales is modeled as a dedicated module with its own router, service, and Prisma models for project, requirement document, solution design, BOQ, PoC, proposal, and activities.

 #### 4.5.1 Presales Project Lifecycle

 **Implementation**

 - Backend:
   - Router: [backend/src/modules/presales/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/routes.ts)
   - Controller: [backend/src/modules/presales/controller.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/controller.ts)
   - Service: [backend/src/modules/presales/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/service.ts)
   - Validation: [backend/src/modules/presales/validation.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/validation.ts)
   - Core operations:
     - List and filter projects: `GET /api/v1/presales/projects`
     - Project detail: `GET /api/v1/presales/projects/:id`
     - Create/update project: `POST` and `PATCH /projects/:id`
     - Advance stage: `POST /projects/:id/stages/advance`
     - Convert to opportunity: `POST /projects/:id/convert-to-opportunity`
   - Win probability calculation:
     - Combines PoC outcome, proposal status, requirement coverage, and expected close date.

 - Frontend:
   - Presales pages and `PresalesProjectDetailPage` hosted within [frontend/src/App.tsx](file:///c:/Users/Rishabh/Desktop/connectplus-crm/frontend/src/App.tsx)
   - Uses React Query to load project, stages, and related documents.

 #### 4.5.2 Requirements Management

 **Feature**

 - Capture raw notes, structured functional & technical requirements, constraints, and stakeholders.

 **Implementation**

 - Backend:
   - Model: `RequirementDoc` in [schema.prisma](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/prisma/schema.prisma)
   - Endpoints:
     - `GET /projects/:id/requirements`
     - `PUT /projects/:id/requirements`
   - Service:
     - `getRequirementDoc` and `upsertRequirementDoc` in [presales/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/service.ts#L420-L473)
     - Recalculates project win probability upon update.
 - Frontend:
   - Requirements panel in `PresalesProjectDetailPage`
   - Local state arrays for functional/technical requirements and stakeholders
   - `useMutation` to `PUT /api/v1/presales/projects/:id/requirements`

 #### 4.5.3 Solution Design

 **Feature**

 - Capture solution architecture links, diagrams, chosen tech stack, competitor options, recommended option, and justification.

 **Implementation**

 - Backend:
   - Model: `SolutionDesign` in `schema.prisma`
   - Validation: `upsertSolutionDesignSchema` in [presales/validation.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/validation.ts#L54-L61)
   - Service: `upsertSolutionDesign` in [presales/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/service.ts#L476-L507)
 - Frontend:
   - Solution design section with fields for URLs, tech stack map, competitor list, and recommendation
   - `useMutation` calling `PUT /api/v1/presales/projects/:id/solution`

 #### 4.5.4 BOQ (Bill of Quantities)

 **Feature**

 - Line‑item BOQ with quantities, negotiated prices, OEM details, validity, effort days, and resource count.
 - Dedicated BOQ board view across projects.

 **Implementation**

 - Backend:
   - Model: `BOQ` in `schema.prisma`
   - Validation: `upsertBoqSchema` in [presales/validation.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/validation.ts#L63-L71)
   - Service:
     - `upsertBoq` and `submitBoq` in [presales/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/service.ts#L509-L576)
     - `listBoqBoard` (ordered by `completedAt`): same file, near the end.
   - Endpoints:
     - `PUT /projects/:id/boq`
     - `POST /projects/:id/boq/submit`
     - `GET /boq` – board view
 - Frontend:
   - BOQ panel in `PresalesProjectDetailPage`
   - BOQ board page using `useQuery` to `GET /api/v1/presales/boq`

 #### 4.5.5 PoC Management

 **Feature**

 - Define PoC objective, scope, success criteria, environment, schedule, outcomes, and evidence URLs.
 - Track PoC status and impact on win probability.

 **Implementation**

 - Backend:
   - Model: `POC` in `schema.prisma`
   - Validation: `upsertPocSchema` and `patchPocOutcomeSchema` in [presales/validation.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/validation.ts#L73-L88)
   - Service:
     - `upsertPoc` and `setPocOutcome` in [presales/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/service.ts#L578-L687)
     - `listPocBoard` ordered by PoC `startDate`.
   - Endpoints:
     - `PUT /projects/:id/poc`
     - `PATCH /projects/:id/poc/outcome`
     - `GET /poc` – board view
 - Frontend:
   - PoC section in `PresalesProjectDetailPage`
   - `useMutation` to update PoC details and set outcome

 #### 4.5.6 Proposal Management

 **Feature**

 - Draft and manage a commercial proposal per presales project:
   - Executive summary
   - Scope of work
   - Technical approach
   - Commercial line items
   - Delivery timeline
   - Team structure
   - Terms & conditions
 - Proposal board spanning all projects with reminder capability.

 **Implementation**

 - Backend:
   - Model: `Proposal` in `schema.prisma`
   - Validation: `upsertProposalSchema` in [presales/validation.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/validation.ts#L90-L99)
   - Service: `upsertProposal` and `listProposalBoard` in [presales/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/presales/service.ts#L690-L777)
   - Endpoint:
     - `PUT /projects/:id/proposal`
     - `GET /proposals` – proposals board
 - Frontend:
   - Proposal section in `PresalesProjectDetailPage` with structured inputs for the above fields.
   - `PresalesProposalsPage` listing proposals with value, status, version, sent date, and client response.
   - Reminder actions implemented via a mutation endpoint (`POST /api/v1/presales/proposals/:id/reminder`).

 #### 4.5.7 Activities Timeline

 **Feature**

 - Activity feed per presales project recording key actions and file attachments (notes, milestones, document uploads).

 **Implementation**

 - Backend:
   - Model: `PresalesActivity` in `schema.prisma`
   - Exposed through `presalesService` for loading activities ordered by `createdAt`.
 - Frontend:
   - `Activities Timeline` section inside `PresalesProjectDetailPage`
   - Displays chronological activity entries with metadata such as type, description, actor, and timestamp.

 ### 4.6 Settings and Masters

 **Feature**

 - Centralized settings for:
   - Users (create, update, invite)
   - Company profile and approvals
   - Revenue targets
   - Notification preferences
   - Masters: products, distributors, industries, lead sources, loss reasons, departments, skill tags

 **Implementation**

 - Backend:
   - Routes: [backend/src/modules/settings/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/settings/routes.ts)
   - Controller: [backend/src/modules/settings/controller.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/settings/controller.ts)
   - Service: [backend/src/modules/settings/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/settings/service.ts)
   - Extensive use of Zod validation for request payloads.
 - Frontend:
   - Settings pages under `/settings/**`, all routed and rendered from `App.tsx` using React Query for lists and mutations.

 ### 4.7 Integrations

 **Feature**

 - API Fetcher tool for admins to execute arbitrary HTTP requests and store responses.
 - HRMS employee sync stub for future integration.

 **Implementation**

 - Backend:
   - Integrations router: [backend/src/modules/integrations/routes.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/integrations/routes.ts)
   - API fetch:
     - Controller: [backend/src/modules/integrations/controller.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/integrations/controller.ts)
     - Service: [backend/src/modules/integrations/apiFetcherService.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/integrations/apiFetcherService.ts)
   - HRMS service: [backend/src/modules/integrations/hrmsService.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/integrations/hrmsService.ts)
 - Frontend:
   - `/api-fetcher` page in `App.tsx` for constructing and running API calls, with history retrieved from `GET /api/integrations/fetch/sessions`.

 ### 4.8 Notifications & Presales Cron

 **Feature**

 - Notification entities stored in the database with type, title, message, priority, channels, and read state.
 - Daily cron job that flags presales projects that have been stuck in a stage for more than 7 days and sends notifications to the assigned engineer and management users.

 **Implementation**

 - Backend:
   - Notification service: [backend/src/modules/notifications/service.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/modules/notifications/service.ts)
   - Cron registration: [backend/src/utils/presalesCron.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/utils/presalesCron.ts)
   - Cron wiring in server: [backend/src/server.ts](file:///c:/Users/Rishabh/Desktop/connectplus-crm/backend/src/server.ts#L7-L13)
   - Logic:
     - Runs every morning at 09:00.
     - Finds active presales projects and their most recent stage logs.
     - Uses `differenceInDays` to see how long each project has been in its current stage.
     - If stuck for more than 7 days, sends notifications to:
       - The assigned engineer (resolved by matching the `assignedTo` name)
       - All users with management roles (`MANAGEMENT`, `ADMIN`, `SUPER_ADMIN`)

 ---

 ## 5. Summary

 Together, this stack and workflow provide:

 - A consistent pipeline from lead capture to presales closure
 - Strong alignment between frontend state, React Query cache, and backend APIs
 - Clear separation of concerns by modules (auth, settings, dashboard, leads, opportunities, presales, integrations)
 - Extensibility for future phases like legal, notifications UI, and analytics dashboards

