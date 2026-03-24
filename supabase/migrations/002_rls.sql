-- ============================================================
-- First Valley — Row Level Security Policies
-- 002_rls.sql
-- ============================================================

-- ============================================================
-- HELPER: is_admin()
-- ============================================================

create or replace function is_admin()
returns boolean as $$
  select exists(
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin'
  )
$$ language sql security definer stable;

-- ============================================================
-- PROFILES
-- ============================================================

alter table profiles enable row level security;

create policy "profiles: users can read own"
  on profiles for select
  using (id = auth.uid());

create policy "profiles: users can update own"
  on profiles for update
  using (id = auth.uid());

create policy "profiles: admins can read all"
  on profiles for select
  using (is_admin());

create policy "profiles: admins can update all"
  on profiles for update
  using (is_admin());

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

alter table subscriptions enable row level security;

create policy "subscriptions: users can read own"
  on subscriptions for select
  using (user_id = auth.uid());

create policy "subscriptions: admins can read all"
  on subscriptions for select
  using (is_admin());

create policy "subscriptions: admins can write"
  on subscriptions for all
  using (is_admin());

-- ============================================================
-- TOKEN WALLETS
-- ============================================================

alter table token_wallets enable row level security;

create policy "token_wallets: users can read own"
  on token_wallets for select
  using (user_id = auth.uid());

create policy "token_wallets: admins can read all"
  on token_wallets for select
  using (is_admin());

create policy "token_wallets: admins can write"
  on token_wallets for all
  using (is_admin());

-- ============================================================
-- TOKEN TRANSACTIONS
-- ============================================================

alter table token_transactions enable row level security;

create policy "token_transactions: users can read own"
  on token_transactions for select
  using (user_id = auth.uid());

create policy "token_transactions: admins can read all"
  on token_transactions for select
  using (is_admin());

-- No direct insert/update/delete — all mutations go through credit_tokens / spend_tokens functions.

-- ============================================================
-- WORLDS
-- ============================================================

alter table worlds enable row level security;

create policy "worlds: anyone can read"
  on worlds for select
  using (true);

create policy "worlds: admins can write"
  on worlds for all
  using (is_admin());

-- ============================================================
-- WORLD REGIONS
-- ============================================================

alter table world_regions enable row level security;

create policy "world_regions: anyone can read"
  on world_regions for select
  using (true);

create policy "world_regions: admins can write"
  on world_regions for all
  using (is_admin());

-- ============================================================
-- WORLD ENVIRONMENT STATE
-- ============================================================

alter table world_environment_state enable row level security;

create policy "world_environment_state: anyone can read"
  on world_environment_state for select
  using (true);

create policy "world_environment_state: admins can write"
  on world_environment_state for all
  using (is_admin());

-- ============================================================
-- CULTURES
-- ============================================================

alter table cultures enable row level security;

create policy "cultures: anyone can read"
  on cultures for select
  using (true);

create policy "cultures: admins can write"
  on cultures for all
  using (is_admin());

-- ============================================================
-- SETTLEMENTS
-- ============================================================

alter table settlements enable row level security;

create policy "settlements: anyone can read"
  on settlements for select
  using (true);

create policy "settlements: admins can write"
  on settlements for all
  using (is_admin());

-- ============================================================
-- PERSONS
-- ============================================================

alter table persons enable row level security;

create policy "persons: anyone can read"
  on persons for select
  using (true);

create policy "persons: admins can write"
  on persons for all
  using (is_admin());

-- ============================================================
-- HOUSEHOLDS
-- ============================================================

alter table households enable row level security;

create policy "households: anyone can read"
  on households for select
  using (true);

create policy "households: admins can write"
  on households for all
  using (is_admin());

-- ============================================================
-- RELATIONSHIPS
-- ============================================================

alter table relationships enable row level security;

-- Non-secret relationships are visible to all; secret ones are admin-only.
create policy "relationships: anyone can read non-secret"
  on relationships for select
  using (is_secret = false);

create policy "relationships: admins can read all"
  on relationships for select
  using (is_admin());

create policy "relationships: admins can write"
  on relationships for all
  using (is_admin());

-- ============================================================
-- PUBLIC EVENTS
-- ============================================================

alter table public_events enable row level security;

create policy "public_events: anyone can read"
  on public_events for select
  using (true);

create policy "public_events: admins can write"
  on public_events for all
  using (is_admin());

-- ============================================================
-- WORLD VOTES
-- ============================================================

alter table world_votes enable row level security;

create policy "world_votes: anyone can read"
  on world_votes for select
  using (true);

create policy "world_votes: admins can write"
  on world_votes for all
  using (is_admin());

-- ============================================================
-- VOTE OPTIONS
-- ============================================================

alter table vote_options enable row level security;

create policy "vote_options: anyone can read"
  on vote_options for select
  using (true);

create policy "vote_options: admins can write"
  on vote_options for all
  using (is_admin());

-- ============================================================
-- VOTE PARTICIPATION
-- ============================================================

alter table vote_participation enable row level security;

create policy "vote_participation: users can read own"
  on vote_participation for select
  using (user_id = auth.uid());

create policy "vote_participation: users can insert own"
  on vote_participation for insert
  with check (user_id = auth.uid());

create policy "vote_participation: admins can read all"
  on vote_participation for select
  using (is_admin());

create policy "vote_participation: admins can write"
  on vote_participation for all
  using (is_admin());

-- ============================================================
-- FOLLOWS
-- ============================================================

alter table follows enable row level security;

create policy "follows: users can read own"
  on follows for select
  using (user_id = auth.uid());

create policy "follows: users can insert own"
  on follows for insert
  with check (user_id = auth.uid());

create policy "follows: users can delete own"
  on follows for delete
  using (user_id = auth.uid());

create policy "follows: admins can read all"
  on follows for select
  using (is_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

alter table notifications enable row level security;

create policy "notifications: users can read own"
  on notifications for select
  using (user_id = auth.uid());

create policy "notifications: users can update own"
  on notifications for update
  using (user_id = auth.uid());

create policy "notifications: admins can read all"
  on notifications for select
  using (is_admin());

create policy "notifications: admins can write"
  on notifications for all
  using (is_admin());

-- ============================================================
-- DAILY RECAPS
-- ============================================================

alter table daily_recaps enable row level security;

create policy "daily_recaps: anyone can read published"
  on daily_recaps for select
  using (is_published = true);

create policy "daily_recaps: admins can read all"
  on daily_recaps for select
  using (is_admin());

create policy "daily_recaps: admins can write"
  on daily_recaps for all
  using (is_admin());

-- ============================================================
-- WEEKLY RECAPS
-- ============================================================

alter table weekly_recaps enable row level security;

create policy "weekly_recaps: anyone can read published"
  on weekly_recaps for select
  using (is_published = true);

create policy "weekly_recaps: admins can read all"
  on weekly_recaps for select
  using (is_admin());

create policy "weekly_recaps: admins can write"
  on weekly_recaps for all
  using (is_admin());

-- ============================================================
-- BILLING EVENTS
-- ============================================================

alter table billing_events enable row level security;

create policy "billing_events: users can read own"
  on billing_events for select
  using (user_id = auth.uid());

create policy "billing_events: admins can read all"
  on billing_events for select
  using (is_admin());

create policy "billing_events: admins can write"
  on billing_events for all
  using (is_admin());

-- ============================================================
-- TOKEN PURCHASE ORDERS
-- ============================================================

alter table token_purchase_orders enable row level security;

create policy "token_purchase_orders: users can read own"
  on token_purchase_orders for select
  using (user_id = auth.uid());

create policy "token_purchase_orders: admins can read all"
  on token_purchase_orders for select
  using (is_admin());

create policy "token_purchase_orders: admins can write"
  on token_purchase_orders for all
  using (is_admin());

-- ============================================================
-- FEATURE FLAGS
-- ============================================================

alter table feature_flags enable row level security;

-- Readable by all authenticated and anonymous users for client-side flag checks.
create policy "feature_flags: anyone can read"
  on feature_flags for select
  using (true);

create policy "feature_flags: admins can write"
  on feature_flags for all
  using (is_admin());

-- ============================================================
-- ADMIN CONFIGS
-- ============================================================

alter table admin_configs enable row level security;

create policy "admin_configs: admins only read"
  on admin_configs for select
  using (is_admin());

create policy "admin_configs: admins only write"
  on admin_configs for all
  using (is_admin());

-- ============================================================
-- AUDIT LOGS
-- ============================================================

alter table audit_logs enable row level security;

create policy "audit_logs: admins only read"
  on audit_logs for select
  using (is_admin());

create policy "audit_logs: admins only write"
  on audit_logs for all
  using (is_admin());

-- ============================================================
-- WORLD ENVIRONMENT STATE (world-data tables — read-only for public)
-- ============================================================

-- Already handled above.

-- ============================================================
-- MILESTONE EVENTS
-- ============================================================

alter table milestone_events enable row level security;

create policy "milestone_events: anyone can read"
  on milestone_events for select
  using (true);

create policy "milestone_events: admins can write"
  on milestone_events for all
  using (is_admin());

-- ============================================================
-- SCANDALS
-- ============================================================

alter table scandals enable row level security;

create policy "scandals: anyone can read"
  on scandals for select
  using (true);

create policy "scandals: admins can write"
  on scandals for all
  using (is_admin());

-- ============================================================
-- CONFLICTS
-- ============================================================

alter table conflicts enable row level security;

create policy "conflicts: anyone can read"
  on conflicts for select
  using (true);

create policy "conflicts: admins can write"
  on conflicts for all
  using (is_admin());

-- ============================================================
-- CRIMES
-- ============================================================

alter table crimes enable row level security;

create policy "crimes: anyone can read"
  on crimes for select
  using (true);

create policy "crimes: admins can write"
  on crimes for all
  using (is_admin());

-- ============================================================
-- UNIONS
-- ============================================================

alter table unions enable row level security;

create policy "unions: anyone can read"
  on unions for select
  using (true);

create policy "unions: admins can write"
  on unions for all
  using (is_admin());

-- ============================================================
-- BIRTHS
-- ============================================================

alter table births enable row level security;

create policy "births: anyone can read"
  on births for select
  using (true);

create policy "births: admins can write"
  on births for all
  using (is_admin());

-- ============================================================
-- DEATHS
-- ============================================================

alter table deaths enable row level security;

create policy "deaths: anyone can read"
  on deaths for select
  using (true);

create policy "deaths: admins can write"
  on deaths for all
  using (is_admin());

-- ============================================================
-- BLOODLINES
-- ============================================================

alter table bloodlines enable row level security;

create policy "bloodlines: anyone can read"
  on bloodlines for select
  using (true);

create policy "bloodlines: admins can write"
  on bloodlines for all
  using (is_admin());

-- ============================================================
-- BLOODLINE MEMBERS
-- ============================================================

alter table bloodline_members enable row level security;

create policy "bloodline_members: anyone can read"
  on bloodline_members for select
  using (true);

create policy "bloodline_members: admins can write"
  on bloodline_members for all
  using (is_admin());

-- ============================================================
-- INSTITUTIONS
-- ============================================================

alter table institutions enable row level security;

create policy "institutions: anyone can read"
  on institutions for select
  using (true);

create policy "institutions: admins can write"
  on institutions for all
  using (is_admin());

-- ============================================================
-- INSTITUTION MEMBERS
-- ============================================================

alter table institution_members enable row level security;

create policy "institution_members: anyone can read"
  on institution_members for select
  using (true);

create policy "institution_members: admins can write"
  on institution_members for all
  using (is_admin());

-- ============================================================
-- RELIGIONS
-- ============================================================

alter table religions enable row level security;

create policy "religions: anyone can read"
  on religions for select
  using (true);

create policy "religions: admins can write"
  on religions for all
  using (is_admin());

-- ============================================================
-- RELIGION FOLLOWERS
-- ============================================================

alter table religion_followers enable row level security;

create policy "religion_followers: anyone can read"
  on religion_followers for select
  using (true);

create policy "religion_followers: admins can write"
  on religion_followers for all
  using (is_admin());
