import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { opportunitiesService } from "./service";
import { listOpportunitiesQuerySchema, updateOpportunityStageSchema } from "./validation";

export const listOpportunities = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = listOpportunitiesQuerySchema.safeParse(req.query);

  const params = parsed.success
    ? parsed.data
    : {
        search: undefined,
        stage: undefined,
        page: 1,
        pageSize: 25,
      };

  const result = await opportunitiesService.listOpportunities({
    search: params.search,
    stage: params.stage,
    page: params.page,
    pageSize: params.pageSize,
  });

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const getOpportunity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const opportunity = await opportunitiesService.getOpportunityById(id);

  if (!opportunity) {
    res.status(404).json({
      success: false,
      data: null,
      message: "Opportunity not found",
    });
    return;
  }

  res.json({
    success: true,
    data: { opportunity },
    message: "",
  });
};

export const deleteOpportunity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  await opportunitiesService.deleteOpportunity(id);

  res.json({
    success: true,
    data: null,
    message: "",
  });
};

export const updateOpportunityStage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const id = parseInt(req.params.id, 10);
  const parsed = updateOpportunityStageSchema.parse(req.body);
  const opportunity = await opportunitiesService.updateOpportunityStage(id, parsed.salesStage, req.user.id, parsed.notes);

  res.json({
    success: true,
    data: { opportunity },
    message: "",
  });
};
