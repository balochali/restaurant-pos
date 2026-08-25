import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  earlyAccess: true,

  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "ts-node-dev --transpile-only prisma/seed.ts",
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});