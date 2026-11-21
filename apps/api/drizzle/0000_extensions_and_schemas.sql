-- Extensions and the private schema for helper functions (docs/database.md, Conventions).
-- citext is for users' sign-in email; pg_trgm is for the employee search index, which arrives
-- with the 100x scale migration.
CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app_private;
