-- Indexes from the end-to-end query review (decision #35). Both use only leakproof comparisons,
-- so they stay usable under row-level security.
--
-- The directory's default sort (last name, first name, id): lets a page be read in index order
-- instead of sorting every row in scope.
CREATE INDEX IF NOT EXISTS employees_name ON employees (last_name, first_name, id);--> statement-breakpoint
-- Audit filtered by actor ("what did this person change"), newest first.
CREATE INDEX IF NOT EXISTS audit_events_actor_occurred
  ON audit_events (actor_id, occurred_at DESC NULLS FIRST, id DESC NULLS FIRST);
