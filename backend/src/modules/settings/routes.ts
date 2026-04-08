import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { authenticate } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import {
  approvalConfigSchema,
  companyProfileSchema,
  createUserSchema,
  importMicrosoftDirectorySchema,
  inviteUserSchema,
  masterNameSchema,
  microsoftDirectoryQuerySchema,
  notificationPreferenceSchema,
  oofSchema,
  purgeUsersExceptKeeperSchema,
  revenueTargetSchema,
  updateUserSchema,
} from "./validation";
import {
  createDepartment,
  createDistributor,
  createIndustry,
  createLeadSource,
  createLossReason,
  createNotificationPreference,
  createProduct,
  createSkillTag,
  createUser,
  deleteUser,
  inviteUser,
  listRoles,
  listDepartments,
  listDistributors,
  listIndustries,
  listLeadSources,
  listLossReasons,
  listNotificationPreferences,
  listProducts,
  listRevenueTargets,
  listSkillTags,
  listUsers,
  listDuplicateUserGroups,
  deduplicateUsers,
  purgeUsersExceptKeeper,
  setUserOof,
  upsertApprovalConfig,
  upsertCompanyProfile,
  upsertRevenueTarget,
  updateUser,
  getApprovalConfig,
  getCompanyProfile,
  importMicrosoftOrgUsers,
  listMicrosoftOrgUsers,
} from "./controller";

export const settingsRouter = Router();

settingsRouter.use(authenticate);
settingsRouter.use(requireRoles(["ADMIN", "SUPER_ADMIN"]));

settingsRouter.get("/roles", asyncHandler(listRoles));
settingsRouter.get(
  "/directory/microsoft-users",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  validateRequest(microsoftDirectoryQuerySchema, "query"),
  asyncHandler(listMicrosoftOrgUsers),
);
settingsRouter.post(
  "/directory/microsoft-users/import",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  validateRequest(importMicrosoftDirectorySchema),
  asyncHandler(importMicrosoftOrgUsers),
);
settingsRouter.get("/users", asyncHandler(listUsers));
settingsRouter.get(
  "/users/duplicates",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  asyncHandler(listDuplicateUserGroups),
);
settingsRouter.post(
  "/users/deduplicate",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  asyncHandler(deduplicateUsers),
);
settingsRouter.post(
  "/users/purge-except-keeper",
  validateRequest(purgeUsersExceptKeeperSchema),
  asyncHandler(purgeUsersExceptKeeper),
);
settingsRouter.delete(
  "/users/:id",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  asyncHandler(deleteUser),
);
settingsRouter.post("/users", validateRequest(createUserSchema), asyncHandler(createUser));
settingsRouter.post(
  "/users/invite",
  requireRoles(["SUPER_ADMIN"]),
  validateRequest(inviteUserSchema),
  asyncHandler(inviteUser),
);
settingsRouter.patch("/users/:id", validateRequest(updateUserSchema), asyncHandler(updateUser));
settingsRouter.post("/users/:id/oof", validateRequest(oofSchema), asyncHandler(setUserOof));

settingsRouter.get("/company-profile", asyncHandler(getCompanyProfile));
settingsRouter.put("/company-profile", validateRequest(companyProfileSchema), asyncHandler(upsertCompanyProfile));

settingsRouter.get("/approval-config", asyncHandler(getApprovalConfig));
settingsRouter.put("/approval-config", validateRequest(approvalConfigSchema), asyncHandler(upsertApprovalConfig));

settingsRouter.get("/revenue-targets", asyncHandler(listRevenueTargets));
settingsRouter.post("/revenue-targets", validateRequest(revenueTargetSchema), asyncHandler(upsertRevenueTarget));

settingsRouter.get("/notification-preferences", asyncHandler(listNotificationPreferences));
settingsRouter.post(
  "/notification-preferences",
  validateRequest(notificationPreferenceSchema),
  asyncHandler(createNotificationPreference),
);

settingsRouter.get("/masters/products", asyncHandler(listProducts));
settingsRouter.post("/masters/products", asyncHandler(createProduct));

settingsRouter.get("/masters/distributors", asyncHandler(listDistributors));
settingsRouter.post("/masters/distributors", asyncHandler(createDistributor));

settingsRouter.get("/masters/industries", asyncHandler(listIndustries));
settingsRouter.post("/masters/industries", validateRequest(masterNameSchema), asyncHandler(createIndustry));

settingsRouter.get("/masters/lead-sources", asyncHandler(listLeadSources));
settingsRouter.post("/masters/lead-sources", validateRequest(masterNameSchema), asyncHandler(createLeadSource));

settingsRouter.get("/masters/loss-reasons", asyncHandler(listLossReasons));
settingsRouter.post("/masters/loss-reasons", validateRequest(masterNameSchema), asyncHandler(createLossReason));

settingsRouter.get("/masters/departments", asyncHandler(listDepartments));
settingsRouter.post("/masters/departments", validateRequest(masterNameSchema), asyncHandler(createDepartment));

settingsRouter.get("/masters/skill-tags", asyncHandler(listSkillTags));
settingsRouter.post("/masters/skill-tags", validateRequest(masterNameSchema), asyncHandler(createSkillTag));
