// Load .env from project root (Prisma CLI may not load it before validating schema with WASM).
import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

config({ path: resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
    directUrl: process.env["DATABASE_URL_DIRECT"] ?? "",
  },
});
