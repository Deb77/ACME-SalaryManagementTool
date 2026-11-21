-- S4: salary changes by country and date (Ask AI aggregates), and the direct RLS predicate once
-- salary_changes gets its country policy (decision #27). Hand-written because Drizzle's index
-- builder has no INCLUDE.
CREATE INDEX salary_changes_country_effective ON salary_changes (country_code, effective_date)
  INCLUDE (amount_minor, previous_amount_minor, reason);
