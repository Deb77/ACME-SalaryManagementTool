import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit reads the TypeScript schema and writes SQL migrations into ./drizzle
 * (`npm run db:generate`). It never needs a database to do that. The app applies the
 * migrations itself (`npm run db:migrate`, src/db/migrate.ts), so production needs no drizzle-kit.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATOR ?? '' },
});
