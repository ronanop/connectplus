const { PrismaClient } = require("./src/generated/prisma");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function ensureRole(name) {
  const existing = await prisma.role.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      name,
      permissionsJson: {},
    },
  });
}

/** Aligns user “Department” dropdowns with CRM functional areas: Sales, Presales, SCM, Deployment, Cloud. */
async function ensureDepartment(name) {
  const existing = await prisma.department.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.department.create({ data: { name } });
}

async function main() {
  const superAdminRole = await ensureRole("SUPER_ADMIN");
  const adminRole = await ensureRole("ADMIN");
  const userRole = await ensureRole("USER");

  for (const dept of [
    "Sales",
    "Presales",
    "SCM",
    "Deployment",
    "Cloud",
    "Cyber Security",
    "Network Security",
    "ISR",
    "Accounts",
    "IT Support",
    "Software Development",
    "Legal and Compliance",
    "Creative Department",
    "HR Department",
    "Network Help Desk",
  ]) {
    await ensureDepartment(dept);
  }

  const superAdminPwd = await bcrypt.hash("SuperAdmin@123", 10);
  const adminPwd = await bcrypt.hash("Admin@123", 10);
  const userPwd = await bcrypt.hash("User@123", 10);

  const defaultOrg = await prisma.organization.upsert({
    where: { code: "cachedigitech-internal" },
    update: {},
    create: {
      name: "Connectplus Internal",
      code: "cachedigitech-internal",
      modules: ["CRM"],
    },
  });

  /** Default office coordinates for attendance geo-fence (ConnectPlus standard location). */
  const OFFICE_LAT = 28.497293941267056;
  const OFFICE_LNG = 77.16323783636463;
  await prisma.attendanceConfig.upsert({
    where: { organizationId: defaultOrg.id },
    update: { officeLat: OFFICE_LAT, officeLng: OFFICE_LNG },
    create: {
      organizationId: defaultOrg.id,
      officeLat: OFFICE_LAT,
      officeLng: OFFICE_LNG,
      perimeterMeters: 70,
      faceMatchThreshold: 0.7,
    },
  });

  await prisma.user.upsert({
    where: { email: "superadmin@cachedigitech.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@cachedigitech.com",
      passwordHash: superAdminPwd,
      roleId: superAdminRole.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@cachedigitech.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@cachedigitech.com",
      passwordHash: adminPwd,
      roleId: adminRole.id,
      organizationId: defaultOrg.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "user@cachedigitech.com" },
    update: {},
    create: {
      name: "User",
      email: "user@cachedigitech.com",
      passwordHash: userPwd,
      roleId: userRole.id,
      organizationId: defaultOrg.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "vikas@cachedigitech.com" },
    update: { organizationId: defaultOrg.id },
    create: {
      name: "Vikas",
      email: "vikas@cachedigitech.com",
      passwordHash: userPwd,
      roleId: userRole.id,
      organizationId: defaultOrg.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "anil2@cachedigitech.com" },
    update: { organizationId: defaultOrg.id },
    create: {
      name: "Anil",
      email: "anil2@cachedigitech.com",
      passwordHash: userPwd,
      roleId: userRole.id,
      organizationId: defaultOrg.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "shraddha@cachedigitech.com" },
    update: { organizationId: defaultOrg.id },
    create: {
      name: "Shraddha",
      email: "shraddha@cachedigitech.com",
      passwordHash: userPwd,
      roleId: userRole.id,
      organizationId: defaultOrg.id,
      isActive: true,
    },
  });

  const leadCount = await prisma.lead.count();
  if (leadCount === 0) {
    const admin = await prisma.user.findFirst({
      where: { email: "admin@cachedigitech.com" },
    });

    const assignedToId = admin?.id ?? null;

    await prisma.lead.createMany({
      data: [
        {
          companyName: "Zenora Health Systems",
          contactName: "Aritra Singh",
          designation: "IT Head",
          phone: "+91-9876543210",
          email: "aritra.singh@zenorahealth.com",
          source: "Inbound – Website",
          industry: "Healthcare",
          city: "Mumbai",
          state: "Maharashtra",
          requirement: "Enterprise CRM rollout across 12 hospitals with OPD integration",
          estimatedValue: 18000000,
          status: "Qualified",
          assignedToId,
        },
        {
          companyName: "Northfield Logistics",
          contactName: "Megha Rao",
          designation: "COO",
          phone: "+91-9833011122",
          email: "megha.rao@northfieldlogistics.in",
          source: "Partner – Channel",
          industry: "Logistics",
          city: "Bengaluru",
          state: "Karnataka",
          requirement: "Control tower for fleet, invoicing and collections",
          estimatedValue: 12500000,
          status: "Proposal",
          assignedToId,
        },
        {
          companyName: "Aurelius Finance",
          contactName: "Rahul Verma",
          designation: "CIO",
          phone: "+91-9819002211",
          email: "rahul.verma@aureliusfinance.com",
          source: "Outbound – SDR",
          industry: "Financial Services",
          city: "Delhi",
          state: "Delhi NCR",
          requirement: "Unified CRM for wealth, retail and SME lending teams",
          estimatedValue: 22000000,
          status: "New",
          assignedToId,
        },
      ],
    });
  }
}

main()
  .then(async () => {
    console.log("Seed complete");
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
