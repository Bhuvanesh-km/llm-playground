import { loadEnvFile } from "node:process";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * The Prisma CLI reads `.env`, but this project keeps real secrets in
 * `.env.local` (Next.js's convention, and the file `.gitignore` covers).
 * Without this the CLI would report DATABASE_URL as missing even though the
 * running app can see it. `loadEnvFile` does not overwrite variables that are
 * already set, so a real deployment environment still wins.
 */
loadEnvFile(path.join(__dirname, ".env.local"));

/**
 * Prisma 7 moved the connection URL out of `schema.prisma` and into here.
 * The app itself never uses this: it connects through the driver adapter in
 * `lib/prisma.ts`. This entry exists only so the CLI's migrate and introspect
 * commands know which database to talk to.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Missing or invalid environment variable(s): DATABASE_URL. Add it to .env.local and re-run the Prisma CLI.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: { path: path.join(__dirname, "prisma", "migrations") },
  datasource: { url: databaseUrl },
});
