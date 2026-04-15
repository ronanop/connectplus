import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../prisma";
import { getAppGraphClient } from "../utils/graphAppClient";
import { tagsFromJson } from "./tagsFromJson";

export type GraphDirectoryRow = {
  graphId: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  userPrincipalName: string;
};

function rowFromGraphUser(u: Record<string, unknown>): GraphDirectoryRow | null {
  const mail = String(u.mail ?? "")
    .trim()
    .toLowerCase();
  const upn = String(u.userPrincipalName ?? "")
    .trim()
    .toLowerCase();
  const email = mail || (upn.includes("@") ? upn : "");
  if (!email) {
    return null;
  }
  const jobTitle = u.jobTitle;
  return {
    graphId: String(u.id ?? ""),
    displayName: String(u.displayName ?? email.split("@")[0] ?? "User"),
    email,
    department: u.department != null ? String(u.department) : null,
    jobTitle: typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : null,
    userPrincipalName: String(u.userPrincipalName ?? ""),
  };
}

function domainSuffixFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) {
    return "";
  }
  return email.slice(at).toLowerCase();
}

export type FetchGraphResult =
  | { ok: true; users: GraphDirectoryRow[] }
  | { ok: false; reason: "graph_not_configured" | "graph_error"; message?: string };

/**
 * Lists Microsoft 365 users whose mail/UPN matches the given email domain suffix (e.g. "@contoso.com").
 * When `textSearch` is set (2+ chars), prefers a Graph $filter query; falls back to paging all users.
 */
export async function fetchGraphUsersForEmailDomain(
  requesterEmail: string,
  options?: { textSearch?: string },
): Promise<FetchGraphResult> {
  const suffix = domainSuffixFromEmail(requesterEmail);
  if (!suffix || suffix === "@") {
    return { ok: false, reason: "graph_error", message: "Invalid requester email domain" };
  }

  const client = await getAppGraphClient();
  if (!client) {
    return { ok: false, reason: "graph_not_configured" };
  }

  const q = options?.textSearch?.trim().toLowerCase() ?? "";
  const collected: GraphDirectoryRow[] = [];

  const pushRow = (u: Record<string, unknown>) => {
    const row = rowFromGraphUser(u);
    if (!row || !row.email.endsWith(suffix)) {
      return;
    }
    if (q.length >= 2) {
      const name = row.displayName.toLowerCase();
      const em = row.email.toLowerCase();
      if (!name.includes(q) && !em.includes(q)) {
        return;
      }
    }
    collected.push(row);
  };

  const tryFilteredQuery = async (): Promise<boolean> => {
    if (q.length < 2) {
      return false;
    }
    const safe = q.slice(0, 80).replace(/'/g, "''");
    try {
      const filter = `contains(tolower(displayName),'${safe}')`;
      const res: { value?: Record<string, unknown>[] } = await client
        .api(`/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle&$filter=${encodeURIComponent(filter)}&$top=100`)
        .header("ConsistencyLevel", "eventual")
        .get();
      const rows = res.value ?? [];
      for (const u of rows) {
        pushRow(u);
      }
      return true;
    } catch {
      return false;
    }
  };

  try {
    const filterAttemptOk = await tryFilteredQuery();
    if (!filterAttemptOk || collected.length === 0) {
      let path: string | null =
        "/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle&$top=999";
      while (path) {
        const res: { value?: Record<string, unknown>[]; "@odata.nextLink"?: string } = await client.api(path).get();
        const rows = res.value ?? [];
        for (const u of rows) {
          pushRow(u);
        }
        const next = res["@odata.nextLink"];
        if (next) {
          const url = new URL(next);
          path = url.pathname.replace(/^\/v1\.0\b/i, "") + url.search;
        } else {
          path = null;
        }
      }
    }
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
    const code =
      e && typeof e === "object" && "statusCode" in e ? (e as { statusCode?: number }).statusCode : undefined;
    if (code === 403 || /Insufficient privileges|Authorization_RequestDenied|403/i.test(msg)) {
      return {
        ok: false,
        reason: "graph_error",
        message:
          "Directory read was denied. Grant this app Microsoft Graph application permission User.Read.All with admin consent.",
      };
    }
    return { ok: false, reason: "graph_error", message: msg };
  }

  const byEmail = new Map<string, GraphDirectoryRow>();
  for (const row of collected) {
    const k = row.email.toLowerCase();
    if (!byEmail.has(k)) {
      byEmail.set(k, row);
    }
  }
  return { ok: true, users: Array.from(byEmail.values()) };
}

function mergeProfileTags(existingJson: unknown, row: GraphDirectoryRow): string[] {
  const fromJob = row.jobTitle ? [row.jobTitle] : [];
  const fromDept = row.department?.trim() ? [`dept:${row.department.trim()}`] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...tagsFromJson(existingJson), ...fromJob, ...fromDept]) {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(t.trim());
    if (out.length >= 30) {
      break;
    }
  }
  return out;
}

/**
 * Creates or updates CRM users from Graph rows, scoped to one organization.
 * Skips rows where an existing user belongs to a different organization (multi-tenant safety).
 */
export async function upsertGraphUsersForOrganization(
  organizationId: number,
  rows: GraphDirectoryRow[],
  defaultRoleId: number,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: row.email, mode: "insensitive" } },
      select: {
        id: true,
        organizationId: true,
        tagsJson: true,
        department: true,
      },
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString("base64url"), 10);
      const tags = mergeProfileTags([], row);
      await prisma.user.create({
        data: {
          name: row.displayName,
          email: row.email,
          passwordHash,
          roleId: defaultRoleId,
          organizationId,
          department: row.department ?? undefined,
          tagsJson: tags.length ? tags : undefined,
        },
      });
      created += 1;
      continue;
    }

    if (existing.organizationId != null && existing.organizationId !== organizationId) {
      continue;
    }

    const tags = mergeProfileTags(existing.tagsJson, row);
    const nextDept = row.department?.trim() ? row.department : existing.department;

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: row.displayName,
        organizationId: existing.organizationId ?? organizationId,
        ...(nextDept !== null && nextDept !== undefined ? { department: nextDept } : {}),
        ...(tags.length ? { tagsJson: tags } : {}),
      },
    });
    updated += 1;
  }

  return { created, updated };
}
