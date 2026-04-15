/**
 * One-off / maintenance: point all users at ConnectPlus internal org (code cachedigitech-internal),
 * then print department duplicate / consistency reports.
 *
 * Usage (from backend/, with DATABASE_URL in .env):
 *   node scripts/align-internal-org-and-audit-departments.js
 *   node scripts/align-internal-org-and-audit-departments.js --dry-run
 */

require("dotenv").config();
const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();

const TARGET_ORG_CODE = "cachedigitech-internal";

function norm(s) {
  return (s ?? "").trim().toLowerCase();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const org = await prisma.organization.findUnique({ where: { code: TARGET_ORG_CODE } });
  if (!org) {
    throw new Error(
      `Organization with code "${TARGET_ORG_CODE}" not found. Create it (e.g. run npm run seed) or fix the code.`,
    );
  }

  console.log(`Target organization: id=${org.id} code=${org.code} name="${org.name}"`);
  console.log(dryRun ? "MODE: --dry-run (no user updates)\n" : "MODE: applying user updates\n");

  const usersByOrg = await prisma.user.groupBy({
    by: ["organizationId"],
    _count: { _all: true },
  });
  console.log("--- Users by organizationId (before) ---");
  for (const row of usersByOrg.sort((a, b) => (a.organizationId ?? 0) - (b.organizationId ?? 0))) {
    const oid = row.organizationId;
    const label = oid == null ? "null" : String(oid);
    console.log(`  organizationId ${label}: ${row._count._all} users`);
  }

  const notTarget = await prisma.user.count({
    where: {
      OR: [{ organizationId: null }, { organizationId: { not: org.id } }],
    },
  });
  console.log(`\nUsers not on target org (null or other id): ${notTarget}`);

  if (!dryRun) {
    const result = await prisma.user.updateMany({
      data: { organizationId: org.id },
    });
    console.log(`\nUpdated ${result.count} user rows -> organizationId = ${org.id}`);
  } else {
    console.log("\n(dry-run: skipped user updateMany)");
  }

  // --- CRM master departments: same normalized name, different rows (e.g. "Sales" vs "sales") ---
  const deptRows = await prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const byNorm = new Map();
  for (const d of deptRows) {
    const k = norm(d.name);
    if (!k) {
      continue;
    }
    if (!byNorm.has(k)) {
      byNorm.set(k, []);
    }
    byNorm.get(k).push(d);
  }

  console.log("\n--- CRM departments (masters.departments): groups with case/trim collisions ---");
  let dupMaster = 0;
  for (const [k, list] of [...byNorm.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (list.length > 1) {
      dupMaster += 1;
      console.log(`  normalized "${k}":`);
      for (const x of list) {
        console.log(`    - id ${x.id} name stored as: "${x.name}"`);
      }
    }
  }
  if (dupMaster === 0) {
    console.log("  (no duplicate normalized names — table enforces unique raw name, so this is usually empty)");
  }

  // --- HR departments: duplicate normalized name within same organization ---
  const hrDepts = await prisma.hrDepartment.findMany({
    select: { id: true, organizationId: true, name: true },
    orderBy: [{ organizationId: "asc" }, { name: "asc" }],
  });
  const hrByKey = new Map();
  for (const d of hrDepts) {
    const k = norm(d.name);
    if (!k) {
      continue;
    }
    const key = `${d.organizationId}|${k}`;
    if (!hrByKey.has(key)) {
      hrByKey.set(key, []);
    }
    hrByKey.get(key).push(d);
  }

  console.log("\n--- HR departments (hr_departments): duplicate normalized name within same org ---");
  let dupHr = 0;
  for (const [, list] of [...hrByKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (list.length > 1) {
      dupHr += 1;
      console.log(`  orgId ${list[0].organizationId}:`);
      for (const x of list) {
        console.log(`    - id ${x.id} name: "${x.name}"`);
      }
    }
  }
  if (dupHr === 0) {
    console.log("  (none)");
  }

  // --- User.department free text: multiple raw strings for same normalized value ---
  const users = await prisma.user.findMany({ select: { id: true, department: true } });
  const uByNorm = new Map();
  for (const u of users) {
    const k = norm(u.department);
    if (!k) {
      continue;
    }
    if (!uByNorm.has(k)) {
      uByNorm.set(k, new Set());
    }
    uByNorm.get(k).add(u.department ?? "");
  }

  console.log("\n--- User.department: multiple raw spellings for the same normalized value ---");
  let uSpell = 0;
  for (const [k, set] of [...uByNorm.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (set.size > 1) {
      uSpell += 1;
      console.log(`  normalized "${k}": ${[...set].map(s => JSON.stringify(s)).join(", ")}`);
    }
  }
  if (uSpell === 0) {
    console.log("  (none)");
  }

  // --- User.department not matching any CRM master name (exact) ---
  const masterNames = new Set(deptRows.map(d => d.name));
  const oddDept = users.filter(u => u.department && u.department.trim() && !masterNames.has(u.department.trim()));
  console.log("\n--- Users whose User.department does not exactly match a CRM Department.name ---");
  if (oddDept.length === 0) {
    console.log("  (none or all empty)");
  } else {
    const byVal = new Map();
    for (const u of oddDept) {
      const d = u.department.trim();
      if (!byVal.has(d)) {
        byVal.set(d, 0);
      }
      byVal.set(d, byVal.get(d) + 1);
    }
    for (const [name, count] of [...byVal.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count} user(s): ${JSON.stringify(name)}`);
    }
  }

  // --- HrEmployee org vs User org (after update, all users should be target; HR rows may still differ) ---
  const hrEmployees = await prisma.hrEmployee.findMany({
    where: { userId: { not: null } },
    select: { id: true, organizationId: true, userId: true, user: { select: { id: true, organizationId: true, email: true } } },
  });
  const hrMismatch = hrEmployees.filter(
    e => e.user && e.organizationId !== e.user.organizationId,
  );
  console.log("\n--- HrEmployee (linked to user) where hr.organizationId !== user.organizationId ---");
  if (hrMismatch.length === 0) {
    console.log("  (none)");
  } else {
    console.log(`  count: ${hrMismatch.length} (fix manually or run a separate HR org migration)`);
    for (const e of hrMismatch.slice(0, 25)) {
      console.log(
        `  hrEmployee id ${e.id} user ${e.user?.email}: hrOrg=${e.organizationId} userOrg=${e.user?.organizationId}`,
      );
    }
    if (hrMismatch.length > 25) {
      console.log(`  ... and ${hrMismatch.length - 25} more`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
