-- Migrate contacts from a single `name` column to `first_name`, `last_name`, and `birthday`.
-- Run this against your Supabase project SQL editor.

BEGIN;

-- 1. Add the new columns (nullable initially to allow migration)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS birthday date;

-- 2. Copy existing names into the new columns.
--    First word becomes first_name; anything after the first space becomes last_name.
UPDATE public.contacts
SET
  first_name = split_part(name, ' ', 1),
  last_name = CASE
    WHEN name LIKE '% %' THEN NULLIF(trim(substring(name from position(' ' in name) + 1)), '')
    ELSE NULL
  END
WHERE first_name IS NULL
  AND name IS NOT NULL;

-- 3. Enforce first_name as required
ALTER TABLE public.contacts
  ALTER COLUMN first_name SET NOT NULL;

-- 4. Remove the old column
ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS name;

COMMIT;
