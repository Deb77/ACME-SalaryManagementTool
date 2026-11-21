-- Catalogue rows, the permission catalogue and the two system roles. Not editable in v1, so the
-- migrations own this data. The permission keys match `permissionKeys` in @acme/shared; the
-- server checks they still match at start-up (docs/auth.md, RBAC).
INSERT INTO countries (code, name, currency, minor_units) VALUES
  ('US', 'United States', 'USD', 2),
  ('GB', 'United Kingdom', 'GBP', 2),
  ('DE', 'Germany', 'EUR', 2),
  ('CA', 'Canada', 'CAD', 2),
  ('IN', 'India', 'INR', 2),
  ('SG', 'Singapore', 'SGD', 2),
  ('AU', 'Australia', 'AUD', 2),
  ('BR', 'Brazil', 'BRL', 2);--> statement-breakpoint

INSERT INTO departments (id, name) VALUES
  ('engineering', 'Engineering'),
  ('product', 'Product'),
  ('data', 'Data'),
  ('support', 'Support'),
  ('sales', 'Sales'),
  ('people', 'People');--> statement-breakpoint

INSERT INTO job_titles (id, name) VALUES
  ('engineering-manager', 'Engineering Manager'),
  ('product-manager', 'Product Manager'),
  ('senior-software-engineer', 'Senior Software Engineer'),
  ('software-engineer', 'Software Engineer'),
  ('data-analyst', 'Data Analyst'),
  ('sales-executive', 'Sales Executive'),
  ('hr-generalist', 'HR Generalist'),
  ('customer-support-specialist', 'Customer Support Specialist');--> statement-breakpoint

INSERT INTO fx_rates (as_of, currency, usd_per_unit) VALUES
  ('2026-11-01', 'USD', 1),
  ('2026-11-01', 'GBP', 1.27),
  ('2026-11-01', 'EUR', 1.08),
  ('2026-11-01', 'CAD', 0.73),
  ('2026-11-01', 'INR', 0.012),
  ('2026-11-01', 'SGD', 0.74),
  ('2026-11-01', 'AUD', 0.66),
  ('2026-11-01', 'BRL', 0.2);--> statement-breakpoint

INSERT INTO permissions (key, description) VALUES
  ('employees:read', 'List, search and view employees and their salary history'),
  ('employees:write', 'Add employees and edit their details'),
  ('employees:terminate', 'Record a leaver'),
  ('salary:change', 'Record a salary change, including confirming an Ask AI draft'),
  ('employees:export', 'Download the CSV export'),
  ('imports:run', 'Download the template, upload, map, commit and undo imports'),
  ('insights:read', 'Pay insights'),
  ('ai:ask', 'Ask AI'),
  ('audit:read', 'The audit log'),
  ('users:manage', 'Invite, edit, deactivate and reactivate users; assign roles and countries'),
  ('roles:manage', 'Create, edit and delete roles');--> statement-breakpoint

INSERT INTO roles (key, name, description, country_scope, is_system) VALUES
  ('global_hr', 'Global HR', 'Every permission, in every country', 'all', true),
  ('country_hr', 'Country HR', 'Day-to-day HR for the countries assigned to each person', 'assigned', true);--> statement-breakpoint

INSERT INTO role_permissions (role_id, permission_key)
  SELECT r.id, p.key FROM roles r CROSS JOIN permissions p
  WHERE r.key = 'global_hr'
     OR (r.key = 'country_hr' AND p.key NOT IN ('users:manage', 'roles:manage'));
