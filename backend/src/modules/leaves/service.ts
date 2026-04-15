import { Prisma } from "../../generated/prisma";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import type { CreateLeaveInput, OrgHistoryQuery, ReviewLeaveInput } from "./validation";

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    throw new ApiError(400, "Invalid date");
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function dateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

const leaveSelect = {
  id: true,
  organizationId: true,
  userId: true,
  startDate: true,
  endDate: true,
  leaveType: true,
  reason: true,
  status: true,
  reviewedAt: true,
  hrComment: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, department: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
} as const;

function mapLeave(row: {
  id: number;
  organizationId: number;
  userId: number;
  startDate: Date;
  endDate: Date;
  leaveType: string;
  reason: string;
  status: string;
  reviewedAt: Date | null;
  hrComment: string | null;
  createdAt: Date;
  user: { id: number; name: string; email: string; department: string | null };
  reviewedBy: { id: number; name: string; email: string } | null;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    startDate: dateToYmd(row.startDate),
    endDate: dateToYmd(row.endDate),
    leaveType: row.leaveType,
    reason: row.reason,
    status: row.status,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    hrComment: row.hrComment,
    createdAt: row.createdAt.toISOString(),
    user: row.user,
    reviewedBy: row.reviewedBy,
  };
}

export const leavesService = {
  async create(userId: number, input: CreateLeaveInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ApiError(400, "Your account must be linked to an organization to request leave.");
    }

    const start = ymdToUtcDate(input.startDate);
    const end = ymdToUtcDate(input.endDate);

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) {
      throw new ApiError(409, "You already have leave that overlaps these dates.");
    }

    const created = await prisma.leaveRequest.create({
      data: {
        organizationId: user.organizationId,
        userId,
        startDate: start,
        endDate: end,
        leaveType: input.leaveType,
        reason: input.reason.trim(),
        status: "PENDING",
      },
      select: leaveSelect,
    });

    return mapLeave(created);
  },

  async listMine(userId: number) {
    const rows = await prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
      select: leaveSelect,
    });
    return rows.map(mapLeave);
  },

  async listPendingForHr(hrUserId: number) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      return [];
    }

    const rows = await prisma.leaveRequest.findMany({
      where: {
        organizationId: hr.organizationId,
        status: "PENDING",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: leaveSelect,
    });
    return rows.map(mapLeave);
  },

  async approve(leaveId: number, hrUserId: number, input: ReviewLeaveInput) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      throw new ApiError(403, "No organization context for reviewer.");
    }

    const row = await prisma.leaveRequest.findFirst({
      where: { id: leaveId, organizationId: hr.organizationId },
    });
    if (!row) {
      throw new ApiError(404, "Leave request not found.");
    }
    if (row.status !== "PENDING") {
      throw new ApiError(400, "This request is no longer pending.");
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "APPROVED",
        reviewedById: hrUserId,
        reviewedAt: new Date(),
        hrComment: input.hrComment?.trim() || null,
      },
      select: leaveSelect,
    });
    return mapLeave(updated);
  },

  async deny(leaveId: number, hrUserId: number, input: ReviewLeaveInput) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      throw new ApiError(403, "No organization context for reviewer.");
    }

    const row = await prisma.leaveRequest.findFirst({
      where: { id: leaveId, organizationId: hr.organizationId },
    });
    if (!row) {
      throw new ApiError(404, "Leave request not found.");
    }
    if (row.status !== "PENDING") {
      throw new ApiError(400, "This request is no longer pending.");
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "DENIED",
        reviewedById: hrUserId,
        reviewedAt: new Date(),
        hrComment: input.hrComment?.trim() || null,
      },
      select: leaveSelect,
    });
    return mapLeave(updated);
  },

  async listOrgHistoryForHr(hrUserId: number, q: OrgHistoryQuery) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      return { leaves: [] as ReturnType<typeof mapLeave>[], departments: [] as string[] };
    }

    const orgId = hr.organizationId;

    const statusIn =
      q.status === "ALL" ? (["APPROVED", "DENIED"] as const) : q.status === "DENIED" ? (["DENIED"] as const) : (["APPROVED"] as const);

    const where: Prisma.LeaveRequestWhereInput = {
      organizationId: orgId,
      status: { in: [...statusIn] },
    };

    const startDateFilter: Prisma.DateTimeFilter = {};
    if (q.from) {
      startDateFilter.gte = ymdToUtcDate(q.from);
    }
    if (q.to) {
      startDateFilter.lte = ymdToUtcDate(q.to);
    }
    if (Object.keys(startDateFilter).length > 0) {
      where.startDate = startDateFilter;
    }

    if (q.department === "__UNASSIGNED__") {
      where.AND = [{ OR: [{ user: { department: null } }, { user: { department: "" } }] }];
    } else if (q.department) {
      where.user = { department: { equals: q.department, mode: "insensitive" } };
    }

    let orderBy: Prisma.LeaveRequestOrderByWithRelationInput[];
    switch (q.sort) {
      case "startDate_asc":
        orderBy = [{ startDate: "asc" }, { id: "asc" }];
        break;
      case "reviewedAt_desc":
        orderBy = [{ reviewedAt: "desc" }, { id: "desc" }];
        break;
      case "reviewedAt_asc":
        orderBy = [{ reviewedAt: "asc" }, { id: "asc" }];
        break;
      case "employee_asc":
        orderBy = [{ user: { name: "asc" } }, { startDate: "desc" }];
        break;
      default:
        orderBy = [{ startDate: "desc" }, { id: "desc" }];
    }

    const rows = await prisma.leaveRequest.findMany({
      where,
      orderBy,
      take: q.take,
      select: leaveSelect,
    });

    const forDeptList = await prisma.leaveRequest.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["APPROVED", "DENIED"] },
      },
      select: { user: { select: { department: true } } },
    });
    const deptSet = new Set<string>();
    let hasUnassigned = false;
    for (const r of forDeptList) {
      const d = r.user.department?.trim();
      if (!d) {
        hasUnassigned = true;
      } else {
        deptSet.add(d);
      }
    }
    const departments = [...deptSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return {
      leaves: rows.map(mapLeave),
      departments,
      hasUnassignedDepartment: hasUnassigned,
    };
  },
};
