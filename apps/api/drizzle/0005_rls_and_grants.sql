-- Runtime database role, grants and row-level security (docs/auth.md, "Database roles" and
-- "RLS policies"; decision #31).
--
-- acme_app is created NOLOGIN here and the migrator is made a member, so the API can connect
-- with the owner's URL and immediately `SET ROLE acme_app` (apps/api/src/db/database.ts). A
-- deployment that wants a separate login can run `ALTER ROLE acme_app LOGIN PASSWORD ...` once;
-- passwords never live in a migration. acme_ai_reader arrives with the Ask AI migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acme_app') THEN
    CREATE ROLE acme_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
GRANT acme_app TO CURRENT_USER;--> statement-breakpoint

REVOKE CREATE ON SCHEMA public FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA public, app_private TO acme_app;--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO acme_app;--> statement-breakpoint

-- Catalogue: read only (seeded by migrations).
GRANT SELECT ON countries, departments, job_titles, fx_rates, permissions TO acme_app;--> statement-breakpoint
-- Access management.
GRANT SELECT, INSERT, UPDATE ON users TO acme_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, invites TO acme_app;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON user_countries TO acme_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON roles, role_permissions TO acme_app;--> statement-breakpoint
-- Business data. No DELETE: leavers are terminated, history is append-only.
GRANT SELECT, INSERT, UPDATE ON employees, imports TO acme_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON import_rows TO acme_app;--> statement-breakpoint
GRANT SELECT, INSERT ON salary_changes, audit_events TO acme_app;--> statement-breakpoint

-- True when the request's role covers every country (set by the API next to app.countries).
CREATE FUNCTION app_private.scope_is_all() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.all_countries', true), '') = 'on'
$$;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.scope_is_all() TO acme_app;--> statement-breakpoint

-- employees: the only table that carries the country directly. WITH CHECK also blocks moving
-- an employee into a country outside the scope.
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY employees_in_scope ON employees FOR ALL TO acme_app
  USING (country_code = ANY ((SELECT app_private.scope_countries())::char(2)[]))
  WITH CHECK (country_code = ANY ((SELECT app_private.scope_countries())::char(2)[]));--> statement-breakpoint

-- salary_changes carries the employee's country (composite FK), so the rule is the same and
-- needs no join.
ALTER TABLE salary_changes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY salary_changes_in_scope ON salary_changes FOR ALL TO acme_app
  USING (country_code = ANY ((SELECT app_private.scope_countries())::char(2)[]))
  WITH CHECK (country_code = ANY ((SELECT app_private.scope_countries())::char(2)[]));--> statement-breakpoint

-- audit_events: events in scope, plus the actor's own events (exports, imports), plus
-- country-less admin events (users, roles) for all-country roles. Inserts name the actor.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_events_read ON audit_events FOR SELECT TO acme_app
  USING (
    country_code = ANY ((SELECT app_private.scope_countries())::char(2)[])
    OR actor_id = (SELECT app_private.current_user_id())
    OR (country_code IS NULL AND (SELECT app_private.scope_is_all()))
  );--> statement-breakpoint
CREATE POLICY audit_events_insert ON audit_events FOR INSERT TO acme_app
  WITH CHECK (actor_id = (SELECT app_private.current_user_id()));--> statement-breakpoint

-- imports: your own, or ones whose rows all fall inside your countries.
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY imports_read ON imports FOR SELECT TO acme_app
  USING (
    created_by = (SELECT app_private.current_user_id())
    OR (cardinality(country_codes) > 0 AND country_codes <@ (SELECT app_private.scope_countries()))
  );--> statement-breakpoint
CREATE POLICY imports_insert ON imports FOR INSERT TO acme_app
  WITH CHECK (created_by = (SELECT app_private.current_user_id()));--> statement-breakpoint
CREATE POLICY imports_update ON imports FOR UPDATE TO acme_app
  USING (created_by = (SELECT app_private.current_user_id()))
  WITH CHECK (created_by = (SELECT app_private.current_user_id()));--> statement-breakpoint

ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY import_rows_via_import ON import_rows FOR ALL TO acme_app
  USING (EXISTS (SELECT 1 FROM imports i WHERE i.id = import_id))
  WITH CHECK (EXISTS (SELECT 1 FROM imports i WHERE i.id = import_id));--> statement-breakpoint

-- Import undo: the single, audited exception to "nothing is deleted" (docs/api.md, Import flow).
-- Removes the employees a committed import created, with their import-only history, and only
-- when nothing else has touched them since. Runs as owner, limited to one batch in scope.
CREATE FUNCTION app_private.delete_import_created_employees(p_import_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  deleted integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM imports
     WHERE id = p_import_id AND status = 'committed'
       AND created_by = app_private.current_user_id()
  ) THEN
    RAISE EXCEPTION 'import % is not a committed import of the current user', p_import_id
      USING ERRCODE = '42501';
  END IF;

  WITH targets AS (
    SELECT e.id FROM employees e
     WHERE e.created_by_import_id = p_import_id
       AND e.country_code = ANY (app_private.scope_countries())
       AND NOT EXISTS (
         SELECT 1 FROM salary_changes s
          WHERE s.employee_id = e.id AND s.import_id IS DISTINCT FROM p_import_id
       )
  ), history AS (
    DELETE FROM salary_changes s USING targets t WHERE s.employee_id = t.id
  )
  DELETE FROM employees e USING targets t WHERE e.id = t.id;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.delete_import_created_employees(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.delete_import_created_employees(uuid) TO acme_app;
--> statement-breakpoint

-- Generated employee codes (ACM-000123). Runs as owner so it sees every country's codes, not
-- only the caller's; a clash with a hand-entered or imported code jumps the sequence forward.
CREATE SEQUENCE app_private.employee_code_seq;--> statement-breakpoint
CREATE FUNCTION app_private.next_employee_code()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := 'ACM-' || lpad(nextval('app_private.employee_code_seq')::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM employees WHERE employee_code = candidate);
    PERFORM setval('app_private.employee_code_seq', greatest(
      currval('app_private.employee_code_seq'),
      (SELECT max(substring(employee_code FROM 5)::bigint) FROM employees
        WHERE employee_code ~ '^ACM-[0-9]{6}$')
    ));
  END LOOP;
  RETURN candidate;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.next_employee_code() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.next_employee_code() TO acme_app;
