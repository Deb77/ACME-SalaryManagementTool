CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'deactivated');--> statement-breakpoint
CREATE TABLE "countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency" char(3) NOT NULL,
	"minor_units" smallint NOT NULL,
	CONSTRAINT "countries_name_unique" UNIQUE("name"),
	CONSTRAINT "countries_code_currency" UNIQUE("code","currency"),
	CONSTRAINT "countries_code_format" CHECK ("countries"."code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "countries_currency_format" CHECK ("countries"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "countries_minor_units" CHECK ("countries"."minor_units" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_id_format" CHECK ("departments"."id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"as_of" date NOT NULL,
	"currency" char(3) NOT NULL,
	"usd_per_unit" numeric(20, 10) NOT NULL,
	CONSTRAINT "fx_rates_as_of_currency_pk" PRIMARY KEY("as_of","currency"),
	CONSTRAINT "fx_rates_currency_format" CHECK ("fx_rates"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "fx_rates_positive" CHECK ("fx_rates"."usd_per_unit" > 0)
);
--> statement-breakpoint
CREATE TABLE "job_titles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "job_titles_name_unique" UNIQUE("name"),
	CONSTRAINT "job_titles_id_format" CHECK ("job_titles"."id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"token_hash" "bytea" PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "invites_token_length" CHECK (octet_length("invites"."token_hash") = 32)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"country_scope" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key"),
	CONSTRAINT "roles_name_unique" UNIQUE("name"),
	CONSTRAINT "roles_key_format" CHECK ("roles"."key" ~ '^[a-z][a-z0-9_]{1,39}$'),
	CONSTRAINT "roles_country_scope" CHECK ("roles"."country_scope" in ('all', 'assigned')),
	CONSTRAINT "roles_version" CHECK ("roles"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "sessions_id_length" CHECK (octet_length("sessions"."id") = 32),
	CONSTRAINT "sessions_expiry" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "user_countries" (
	"user_id" uuid NOT NULL,
	"country_code" char(2) NOT NULL,
	CONSTRAINT "user_countries_user_id_country_code_pk" PRIMARY KEY("user_id","country_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"role_id" uuid NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"password_hash" text,
	"failed_sign_ins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_failed_sign_ins" CHECK ("users"."failed_sign_ins" >= 0),
	CONSTRAINT "users_version" CHECK ("users"."version" >= 1),
	CONSTRAINT "users_active_has_password" CHECK ("users"."status" <> 'active' or "users"."password_hash" is not null),
	CONSTRAINT "users_deactivated_at" CHECK (("users"."status" = 'deactivated') = ("users"."deactivated_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"job_title_id" text NOT NULL,
	"department_id" text NOT NULL,
	"hire_date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"termination_date" date,
	"termination_reason" text,
	"termination_note" text,
	"salary_amount_minor" bigint NOT NULL,
	"salary_currency" char(3) NOT NULL,
	"salary_effective_date" date NOT NULL,
	"created_by_import_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employeeCode_unique" UNIQUE("employee_code"),
	CONSTRAINT "employees_email_unique" UNIQUE("email"),
	CONSTRAINT "employees_id_country" UNIQUE("id","country_code"),
	CONSTRAINT "employees_code_format" CHECK ("employees"."employee_code" ~ '^[A-Z0-9-]{3,20}$'),
	CONSTRAINT "employees_first_name_length" CHECK (char_length("employees"."first_name") between 1 and 100),
	CONSTRAINT "employees_last_name_length" CHECK (char_length("employees"."last_name") between 1 and 100),
	CONSTRAINT "employees_email_lower" CHECK ("employees"."email" = lower("employees"."email")),
	CONSTRAINT "employees_status" CHECK ("employees"."status" in ('active', 'terminated')),
	CONSTRAINT "employees_termination_reason" CHECK ("employees"."termination_reason" in ('resignation', 'dismissal', 'redundancy', 'retirement', 'end_of_contract', 'other')),
	CONSTRAINT "employees_termination_note_length" CHECK (char_length("employees"."termination_note") <= 500),
	CONSTRAINT "employees_salary_positive" CHECK ("employees"."salary_amount_minor" > 0),
	CONSTRAINT "employees_version" CHECK ("employees"."version" >= 1),
	CONSTRAINT "employees_terminated_fields" CHECK (("employees"."status" = 'terminated') = ("employees"."termination_date" is not null and "employees"."termination_reason" is not null)),
	CONSTRAINT "employees_note_only_when_terminated" CHECK ("employees"."status" = 'terminated' or "employees"."termination_note" is null),
	CONSTRAINT "employees_termination_after_hire" CHECK ("employees"."termination_date" is null or "employees"."termination_date" >= "employees"."hire_date")
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"outcome" text,
	"employee_code" text,
	"employee_id" uuid,
	"country_code" char(2),
	"changes" jsonb,
	"errors" jsonb,
	CONSTRAINT "import_rows_import_id_row_number_pk" PRIMARY KEY("import_id","row_number"),
	CONSTRAINT "import_rows_row_number" CHECK ("import_rows"."row_number" >= 1),
	CONSTRAINT "import_rows_outcome" CHECK ("import_rows"."outcome" in ('create', 'update', 'unchanged', 'error')),
	CONSTRAINT "import_rows_error_detail" CHECK ("import_rows"."outcome" <> 'error' or "import_rows"."errors" is not null)
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"file_name" text NOT NULL,
	"file_format" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"file_sha256" "bytea" NOT NULL,
	"columns" jsonb NOT NULL,
	"mapping" jsonb,
	"defaults" jsonb,
	"summary" jsonb,
	"country_codes" char(2)[] DEFAULT '{}' NOT NULL,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"validated_at" timestamp with time zone,
	"committed_at" timestamp with time zone,
	"undone_at" timestamp with time zone,
	CONSTRAINT "imports_status" CHECK ("imports"."status" in ('uploaded', 'validated', 'committed', 'undone', 'failed')),
	CONSTRAINT "imports_file_format" CHECK ("imports"."file_format" in ('xlsx', 'csv')),
	CONSTRAINT "imports_file_size" CHECK ("imports"."file_size_bytes" between 1 and 5242880)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"entity_label" text NOT NULL,
	"country_code" char(2),
	"before" jsonb,
	"after" jsonb,
	"import_id" uuid,
	"details" jsonb,
	CONSTRAINT "audit_events_action" CHECK ("audit_events"."action" in ('employee.created', 'employee.updated', 'employee.terminated', 'salary.changed', 'import.committed', 'import.undone', 'export.created', 'user.invited', 'user.updated', 'user.deactivated', 'role.created', 'role.updated', 'role.deleted')),
	CONSTRAINT "audit_events_entity_type" CHECK ("audit_events"."entity_type" in ('employee', 'import', 'export', 'user', 'role'))
);
--> statement-breakpoint
CREATE TABLE "salary_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"country_code" char(2) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"previous_amount_minor" bigint,
	"currency" char(3) NOT NULL,
	"effective_date" date NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "salary_changes_amount_positive" CHECK ("salary_changes"."amount_minor" > 0),
	CONSTRAINT "salary_changes_previous_positive" CHECK ("salary_changes"."previous_amount_minor" > 0),
	CONSTRAINT "salary_changes_reason" CHECK ("salary_changes"."reason" in ('annual_review', 'promotion', 'market_adjustment', 'correction', 'other', 'hire', 'import', 'import_undo')),
	CONSTRAINT "salary_changes_note_length" CHECK (char_length("salary_changes"."note") <= 500),
	CONSTRAINT "salary_changes_note_required" CHECK ("salary_changes"."reason" not in ('correction', 'other') or "salary_changes"."note" is not null),
	CONSTRAINT "salary_changes_import_reason" CHECK ("salary_changes"."reason" not in ('import', 'import_undo') or "salary_changes"."import_id" is not null),
	CONSTRAINT "salary_changes_first_entry" CHECK ("salary_changes"."previous_amount_minor" is not null or "salary_changes"."reason" in ('hire', 'import'))
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_countries" ADD CONSTRAINT "user_countries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_countries" ADD CONSTRAINT "user_countries_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_title_id_job_titles_id_fk" FOREIGN KEY ("job_title_id") REFERENCES "public"."job_titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_import_id_imports_id_fk" FOREIGN KEY ("created_by_import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_country_currency_fk" FOREIGN KEY ("country_code","salary_currency") REFERENCES "public"."countries"("code","currency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_employee_country_fk" FOREIGN KEY ("employee_id","country_code") REFERENCES "public"."employees"("id","country_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_open_by_user" ON "invites" USING btree ("user_id") WHERE "invites"."used_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employees_active_country_title_salary" ON "employees" USING btree ("country_code","job_title_id","salary_amount_minor") WHERE "employees"."status" = 'active';--> statement-breakpoint
CREATE INDEX "employees_created_by_import" ON "employees" USING btree ("created_by_import_id") WHERE "employees"."created_by_import_id" is not null;--> statement-breakpoint
CREATE INDEX "import_rows_outcome" ON "import_rows" USING btree ("import_id","outcome","row_number");--> statement-breakpoint
CREATE INDEX "audit_events_occurred" ON "audit_events" USING btree ("occurred_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_events_country_occurred" ON "audit_events" USING btree ("country_code","occurred_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_events_entity" ON "audit_events" USING btree ("entity_type","entity_id","occurred_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "salary_changes_employee_effective" ON "salary_changes" USING btree ("employee_id","effective_date" DESC NULLS FIRST,"created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "salary_changes_import" ON "salary_changes" USING btree ("import_id") WHERE "salary_changes"."import_id" is not null;