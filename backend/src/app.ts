import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { settingsRouter } from "./modules/settings/routes";
import { dashboardRouter } from "./modules/dashboard/routes";
import { integrationsRouter } from "./modules/integrations/routes";
import { leadsRouter } from "./modules/leads/routes";
import { opportunitiesRouter } from "./modules/opportunities/routes";
import { superAdminRouter } from "./modules/superAdmin/routes";
import { presalesRouter } from "./modules/presales/routes";
import { inboxRouter } from "./modules/inbox/routes";
import { salesFlowRouter } from "./modules/salesFlow/routes";
import { scmRouter } from "./modules/scm/routes";
import { deploymentRouter } from "./modules/deployment/routes";
import { cloudRouter } from "./modules/cloud/routes";
import { companiesRouter } from "./modules/companies/routes";
import { hrRouter } from "./modules/hr/routes";
import { hierarchyTasksRouter } from "./modules/hierarchyTasks/routes";
import { leavesRouter } from "./modules/leaves/routes";
import { attendanceRouter } from "./modules/attendance/routes";
import { notificationsRouter } from "./modules/notifications/routes";
import { reimbursementsRouter } from "./modules/reimbursements/routes";
import { portfolioProjectsRouter } from "./modules/portfolioProjects/routes";
import { meetingRoomBookingsRouter } from "./modules/meetingRoomBookings/routes";
import { certificationsRouter, skillsRouter } from "./modules/skills/routes";

const app: Application = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" }, message: "" });
});

app.use("/api/auth", authRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/v1/crm/leads", leadsRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/v1/crm/companies", companiesRouter);
app.use("/api/opportunities", opportunitiesRouter);
app.use("/api/v1/crm/opportunities", opportunitiesRouter);
app.use("/api/presales", presalesRouter);
app.use("/api/v1/crm/presales", presalesRouter);
app.use("/api/v1/presales", presalesRouter);
app.use("/api/super-admin", superAdminRouter);
app.use("/api/inbox", inboxRouter);
app.use("/api/sales-flow", salesFlowRouter);
app.use("/api/scm", scmRouter);
app.use("/api/deployment", deploymentRouter);
app.use("/api/cloud", cloudRouter);
app.use("/api/hr", hrRouter);
app.use("/api/hierarchy-tasks", hierarchyTasksRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/reimbursements", reimbursementsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/portfolio-projects", portfolioProjectsRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/certifications", certificationsRouter);
app.use("/api/meeting-room-bookings", meetingRoomBookingsRouter);

app.use(errorHandler);

export default app;
