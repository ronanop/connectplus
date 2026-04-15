import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AttendanceStatus, Prisma } from "../../generated/prisma";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { haversineDistance } from "../../lib/haversine";
import { consumeGeoVerificationToken, issueGeoVerificationToken } from "../../lib/geoTokenStore";

/** Calendar day in UTC (matches typical server expectations). */
export function todayUtcDateOnly(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function monthBounds(ym: string): { start: Date; end: Date } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
}

/** 9:30 AM India Standard Time → 04:00 UTC on the same calendar UTC day (approximation for v1). */
function isLateCheckIn(checkInAt: Date, attendanceDate: Date): boolean {
  const y = attendanceDate.getUTCFullYear();
  const mo = attendanceDate.getUTCMonth();
  const d = attendanceDate.getUTCDate();
  const cutoff = new Date(Date.UTC(y, mo, d, 4, 0, 0, 0));
  return checkInAt > cutoff;
}

function requireOrgId(orgId: number | null | undefined): number {
  if (orgId == null) {
    throw new ApiError(400, "User is not assigned to an organization");
  }
  return orgId;
}

function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function isTeamRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "MANAGEMENT";
}

export async function saveFaceDescriptor(userId: number, descriptor: number[]): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      faceDescriptor: descriptor as unknown as Prisma.InputJsonValue,
      faceEnrolledAt: new Date(),
    },
  });
}

export async function getFaceDescriptor(
  requesterId: number,
  requesterRole: string,
  targetUserId: number | undefined,
): Promise<{ descriptor: number[] }> {
  const uid = targetUserId ?? requesterId;
  if (uid !== requesterId && !isAdminRole(requesterRole)) {
    throw new ApiError(403, "Forbidden");
  }
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { faceDescriptor: true },
  });
  if (!user?.faceDescriptor || !Array.isArray(user.faceDescriptor)) {
    throw new ApiError(404, "Profile photo not set up for face recognition", "FACE_NO_DESCRIPTOR");
  }
  const arr = user.faceDescriptor as unknown[];
  if (arr.length !== 128 || !arr.every(x => typeof x === "number")) {
    throw new ApiError(404, "Profile photo not set up for face recognition", "FACE_NO_DESCRIPTOR");
  }
  return { descriptor: arr as number[] };
}

export async function resetFaceDescriptor(adminUserId: number, targetUserId: number): Promise<void> {
  await prisma.user.update({
    where: { id: targetUserId },
    data: { faceDescriptor: Prisma.DbNull, faceEnrolledAt: null },
  });
  void adminUserId;
}

export async function resetAllFaceDescriptorsForOrg(organizationId: number): Promise<{ count: number }> {
  const result = await prisma.user.updateMany({
    where: { organizationId },
    data: { faceDescriptor: Prisma.DbNull, faceEnrolledAt: null },
  });
  return { count: result.count };
}

export async function countFaceRegisteredInOrg(organizationId: number): Promise<number> {
  return prisma.user.count({
    where: { organizationId, faceEnrolledAt: { not: null } },
  });
}

export async function getConfig(organizationId: number) {
  const config = await prisma.attendanceConfig.findUnique({
    where: { organizationId },
  });
  if (!config) {
    throw new ApiError(404, "Attendance location not configured by admin");
  }
  return config;
}

export async function saveConfig(
  organizationId: number,
  data: {
    officeLat: number;
    officeLng: number;
    perimeterMeters?: number;
    faceMatchThreshold?: number;
  },
) {
  return prisma.attendanceConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      officeLat: data.officeLat,
      officeLng: data.officeLng,
      perimeterMeters: data.perimeterMeters ?? 70,
      faceMatchThreshold: data.faceMatchThreshold ?? 0.7,
    },
    update: {
      officeLat: data.officeLat,
      officeLng: data.officeLng,
      ...(data.perimeterMeters != null ? { perimeterMeters: data.perimeterMeters } : {}),
      ...(data.faceMatchThreshold != null ? { faceMatchThreshold: data.faceMatchThreshold } : {}),
    },
  });
}

export async function verifyGeo(userId: number, organizationId: number, lat: number, lng: number) {
  const config = await prisma.attendanceConfig.findUnique({
    where: { organizationId },
  });
  if (!config) {
    throw new ApiError(404, "Attendance location not configured by admin");
  }
  const distance = haversineDistance(lat, lng, config.officeLat, config.officeLng);
  if (distance <= config.perimeterMeters) {
    const token = issueGeoVerificationToken(userId);
    return { passed: true as const, distance, token };
  }
  return {
    passed: false as const,
    distance,
    perimeterMeters: config.perimeterMeters,
  };
}

export async function checkIn(
  userId: number,
  organizationId: number,
  body: { lat: number; lng: number; faceMatchScore: number; verificationToken: string },
) {
  if (!consumeGeoVerificationToken(body.verificationToken, userId)) {
    throw new ApiError(403, "Invalid or expired location verification", "TOKEN_EXPIRED");
  }
  const config = await getConfig(organizationId);
  if (body.faceMatchScore < config.faceMatchThreshold) {
    throw new ApiError(422, "Face match score below threshold");
  }
  const today = todayUtcDateOnly();
  const distance = haversineDistance(body.lat, body.lng, config.officeLat, config.officeLng);
  if (distance > config.perimeterMeters) {
    throw new ApiError(422, "Location is outside office perimeter");
  }

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const checkInPayload = {
    checkInAt: new Date(),
    checkInLat: body.lat,
    checkInLng: body.lng,
    checkInDistance: distance,
    faceMatchScore: body.faceMatchScore,
    status: AttendanceStatus.PRESENT,
  };

  if (existing) {
    if (existing.status === AttendanceStatus.MANUAL_PRESENT || existing.status === AttendanceStatus.MANUAL_ABSENT) {
      throw new ApiError(
        409,
        "Attendance for today was set by an administrator. Contact HR if this is incorrect.",
        "ATTENDANCE_LOCKED",
      );
    }
    if (existing.status === AttendanceStatus.PRESENT && existing.checkInAt) {
      throw new ApiError(409, "Your attendance for today has already been recorded.", "ALREADY_CHECKED_IN");
    }
    return prisma.attendance.update({
      where: { id: existing.id },
      data: checkInPayload,
    });
  }

  try {
    return await prisma.attendance.create({
      data: {
        userId,
        organizationId,
        date: today,
        ...checkInPayload,
      },
    });
  } catch (e: unknown) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "Your attendance for today has already been recorded.", "ALREADY_CHECKED_IN");
    }
    throw e;
  }
}

export async function checkOut(
  userId: number,
  organizationId: number,
  body: { lat: number; lng: number; faceMatchScore: number; verificationToken: string },
) {
  if (!consumeGeoVerificationToken(body.verificationToken, userId)) {
    throw new ApiError(403, "Invalid or expired location verification", "TOKEN_EXPIRED");
  }
  const config = await getConfig(organizationId);
  if (body.faceMatchScore < config.faceMatchThreshold) {
    throw new ApiError(422, "Face match score below threshold");
  }
  const distance = haversineDistance(body.lat, body.lng, config.officeLat, config.officeLng);
  if (distance > config.perimeterMeters) {
    throw new ApiError(422, "You must be within the office perimeter to check out");
  }
  const today = todayUtcDateOnly();
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (!row || row.status !== AttendanceStatus.PRESENT) {
    throw new ApiError(404, "No active check-in found for today");
  }
  if (row.checkOutAt) {
    throw new ApiError(409, "Already checked out", "ALREADY_CHECKED_OUT");
  }
  return prisma.attendance.update({
    where: { id: row.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: body.lat,
      checkOutLng: body.lng,
      checkOutDistance: distance,
      checkOutFaceMatchScore: body.faceMatchScore,
    },
  });
}

export async function recordFaceFailed(userId: number, organizationId: number) {
  const today = todayUtcDateOnly();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing?.status === AttendanceStatus.PRESENT) {
    return existing;
  }
  return prisma.attendance.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      organizationId,
      date: today,
      status: AttendanceStatus.FACE_FAILED,
    },
    update: {
      status: AttendanceStatus.FACE_FAILED,
    },
  });
}

function attendanceWithComputed(row: {
  checkInAt: Date | null;
  checkOutAt: Date | null;
  date: Date;
  [key: string]: unknown;
}) {
  let durationMinutes: number | null = null;
  if (row.checkInAt && row.checkOutAt) {
    const mins = Math.round((row.checkOutAt.getTime() - row.checkInAt.getTime()) / 60000);
    durationMinutes = mins >= 0 ? mins : null;
  }
  return {
    ...row,
    isLate: row.checkInAt ? isLateCheckIn(row.checkInAt, row.date) : false,
    durationMinutes,
  };
}

export async function getMyAttendance(userId: number, organizationId: number, month?: string) {
  const where: Prisma.AttendanceWhereInput = { userId, organizationId };
  if (month) {
    const { start, end } = monthBounds(month);
    where.date = { gte: start, lte: end };
  } else {
    const { start, end } = monthBounds(
      `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`,
    );
    where.date = { gte: start, lte: end };
  }
  const rows = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return rows.map(attendanceWithComputed);
}

export async function getTodayAttendance(userId: number, organizationId: number) {
  const today = todayUtcDateOnly();
  return prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });
}

export type TeamFilters = {
  date?: string;
  month?: string;
  department?: string;
  status?: AttendanceStatus;
  userId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getTeamAttendance(organizationId: number, filters: TeamFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where: Prisma.AttendanceWhereInput = { organizationId };

  if (filters.date) {
    where.date = parseYmd(filters.date);
  } else if (filters.month) {
    const { start, end } = monthBounds(filters.month);
    where.date = { gte: start, lte: end };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  const userWhere: Prisma.UserWhereInput = {};
  if (filters.department) {
    userWhere.department = { equals: filters.department, mode: "insensitive" };
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    userWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (Object.keys(userWhere).length > 0) {
    where.user = userWhere;
  }

  const [total, rows] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, department: true, role: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { checkInAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const records = rows.map(r => ({
    ...attendanceWithComputed(r),
    userName: r.user.name,
    userEmail: r.user.email,
    department: r.user.department,
    role: r.user.role.name,
    user: undefined,
  }));

  return { records, meta: { total, page, pageSize } };
}

export async function getTodaySummary(organizationId: number) {
  const today = todayUtcDateOnly();
  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: { organizationId, date: today },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {
    PENDING: 0,
    PRESENT: 0,
    FACE_FAILED: 0,
    GEO_FAILED: 0,
    MANUAL_PRESENT: 0,
    MANUAL_ABSENT: 0,
    ABSENT: 0,
  };
  for (const g of grouped) {
    counts[g.status] = g._count._all;
  }
  const totalUsers = await prisma.user.count({ where: { organizationId, isActive: true } });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    totalUsers,
    totalRecordsToday: total,
    present: counts.PRESENT,
    absent: counts.ABSENT,
    faceFailed: counts.FACE_FAILED,
    geoFailed: counts.GEO_FAILED,
    pending: counts.PENDING,
    manualPresent: counts.MANUAL_PRESENT,
    manualAbsent: counts.MANUAL_ABSENT,
  };
}

export async function manualOverride(
  requesterId: number,
  organizationId: number,
  data: { userId: number; date: string; status: "MANUAL_PRESENT" | "MANUAL_ABSENT"; note?: string },
) {
  const target = await prisma.user.findFirst({
    where: { id: data.userId, organizationId },
  });
  if (!target) {
    throw new ApiError(404, "User not found in organization");
  }
  const date = parseYmd(data.date);
  const status =
    data.status === "MANUAL_PRESENT" ? AttendanceStatus.MANUAL_PRESENT : AttendanceStatus.MANUAL_ABSENT;

  return prisma.attendance.upsert({
    where: { userId_date: { userId: data.userId, date } },
    create: {
      userId: data.userId,
      organizationId,
      date,
      status,
      overriddenById: requesterId,
      overrideNote: data.note ?? null,
      ...(status === AttendanceStatus.MANUAL_PRESENT
        ? { checkInAt: new Date() }
        : { checkInAt: null, checkOutAt: null }),
    },
    update: {
      status,
      overriddenById: requesterId,
      overrideNote: data.note ?? null,
      ...(status === AttendanceStatus.MANUAL_PRESENT
        ? { checkInAt: new Date() }
        : {
            checkInAt: null,
            checkOutAt: null,
            faceMatchScore: null,
            checkInLat: null,
            checkInLng: null,
            checkInDistance: null,
            checkOutLat: null,
            checkOutLng: null,
            checkOutDistance: null,
            checkOutFaceMatchScore: null,
          }),
    },
  });
}

export async function getTeamAttendanceForHeatmap(organizationId: number, month: string) {
  const { start, end } = monthBounds(month);
  const rows = await prisma.attendance.findMany({
    where: { organizationId, date: { gte: start, lte: end } },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
  });
  return rows;
}

export { requireOrgId, isAdminRole, isTeamRole };
