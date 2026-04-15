/**
 * Prisma output is under src/generated/prisma (see schema.prisma).
 * tsc only emits compiled .ts into dist/, so copy the generated client for production.
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "generated", "prisma");
const dest = path.join(__dirname, "..", "dist", "generated", "prisma");

if (!fs.existsSync(src)) {
  console.error("copy-generated-prisma: missing", src, "— run prisma generate first");
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("copy-generated-prisma: copied to", dest);
