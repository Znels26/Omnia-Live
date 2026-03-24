-- ============================================================
-- PATCH: Add missing columns to existing profiles table
-- Run this FIRST if profiles table already exists from a
-- previous partial migration or Supabase Auth setup.
-- ============================================================

-- Ensure uuid extension exists
create extension if not exists "uuid-ossp";

-- Add missing columns to profiles (safe to run even if they exist)
alter table profiles add column if not exists username            text unique;
alter table profiles add column if not exists display_name        text;
alter table profiles add column if not exists avatar_url          text;
alter table profiles add column if not exists role                text not null default 'guest';
alter table profiles add column if not exists stripe_customer_id  text unique;
alter table profiles add column if not exists created_at          timestamptz not null default now();
alter table profiles add column if not exists updated_at          timestamptz not null default now();

-- Add the role check constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table profiles add constraint profiles_role_check
      check (role in ('guest', 'subscriber', 'admin'));
  end if;
end $$;

-- Done — now run combined_run_once.sql
