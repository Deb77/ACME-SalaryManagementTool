-- Functions row-level security reads the request's scope from (docs/auth.md, RLS policies).
-- Missing settings return null, so a query outside a scoped transaction sees no rows. The Ask AI
-- branch (app_private.ai_scope) is added with the Ask AI migration.
CREATE FUNCTION app_private.scope_countries() RETURNS char(2)[]
LANGUAGE sql STABLE AS $$
  SELECT string_to_array(nullif(current_setting('app.countries', true), ''), ',')::char(2)[]
$$;--> statement-breakpoint

CREATE FUNCTION app_private.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
