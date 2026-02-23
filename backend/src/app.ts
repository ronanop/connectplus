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
app.use("/api/opportunities", opportunitiesRouter);
app.use("/api/v1/crm/opportunities", opportunitiesRouter);
app.use("/api/presales", presalesRouter);
app.use("/api/v1/crm/presales", presalesRouter);
app.use("/api/v1/presales", presalesRouter);
app.use("/api/super-admin", superAdminRouter);

app.use(errorHandler);

export default app;
