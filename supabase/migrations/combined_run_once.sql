-- ============================================================
-- First Valley — Full Schema Migration
-- 001_schema.sql
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- UTILITY: updated_at trigger function
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique,
  display_name        text,
  avatar_url          text,
  role                text not null default 'guest' check (role in ('guest', 'subscriber', 'admin')),
  stripe_customer_id  text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists profiles_username_idx on profiles (username);
create index if not exists profiles_stripe_customer_id_idx on profiles (stripe_customer_id);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create profile on auth.users insert
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

create table if not exists subscriptions (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null references profiles(id) on delete cascade,
  stripe_customer_id       text,
  stripe_subscription_id   text unique,
  status                   text not null check (status in ('active','canceled','past_due','trialing','incomplete','unpaid')),
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions (user_id);
create index if not exists subscriptions_stripe_subscription_id_idx on subscriptions (stripe_subscription_id);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- ============================================================
-- TOKEN WALLETS
-- ============================================================

create table if not exists token_wallets (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null unique references profiles(id) on delete cascade,
  balance             integer not null default 0 check (balance >= 0),
  lifetime_purchased  integer not null default 0 check (lifetime_purchased >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists token_wallets_user_id_idx on token_wallets (user_id);

create trigger token_wallets_updated_at
  before update on token_wallets
  for each row execute function set_updated_at();

-- Auto-create token wallet on profile insert
create or replace function handle_new_profile()
returns trigger as $$
begin
  insert into public.token_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_profile_created
  after insert on profiles
  for each row execute function handle_new_profile();

-- ============================================================
-- TOKEN TRANSACTIONS
-- ============================================================

create table if not exists token_transactions (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references profiles(id) on delete cascade,
  amount                    integer not null,
  balance_after             integer not null check (balance_after >= 0),
  type                      text not null check (type in ('purchase','spend','refund','admin_grant')),
  description               text,
  stripe_payment_intent_id  text,
  metadata                  jsonb,
  created_at                timestamptz not null default now()
);

create index if not exists token_transactions_user_id_idx on token_transactions (user_id);
create index if not exists token_transactions_created_at_idx on token_transactions (created_at desc);

-- ============================================================
-- WORLDS
-- ============================================================

create table if not exists worlds (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null default 'First Valley',
  slug                text not null unique,
  status              text not null default 'active' check (status in ('active','paused','reset')),
  era                 text not null default 'stone_age',
  in_game_day         integer not null default 1,
  in_game_year        integer not null default 1,
  real_started_at     timestamptz not null default now(),
  last_tick_at        timestamptz,
  next_vote_opens_at  timestamptz,
  config              jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists worlds_slug_idx on worlds (slug);
create index if not exists worlds_status_idx on worlds (status);

-- ============================================================
-- WORLD REGIONS
-- ============================================================

create table if not exists world_regions (
  id                 uuid primary key default uuid_generate_v4(),
  world_id           uuid not null references worlds(id) on delete cascade,
  name               text not null,
  slug               text not null,
  biome              text not null,
  description        text,
  fertility_level    integer not null default 5 check (fertility_level between 0 and 10),
  water_access       integer not null default 5 check (water_access between 0 and 10),
  resource_richness  integer not null default 5 check (resource_richness between 0 and 10),
  position_x         numeric not null default 0,
  position_y         numeric not null default 0,
  metadata           jsonb,
  created_at         timestamptz not null default now(),
  unique (world_id, slug)
);

create index if not exists world_regions_world_id_idx on world_regions (world_id);

-- ============================================================
-- WORLD ENVIRONMENT STATE
-- ============================================================

create table if not exists world_environment_state (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id) on delete cascade,
  region_id       uuid references world_regions(id) on delete cascade,
  in_game_day     integer not null,
  in_game_year    integer not null,
  weather         text,
  temperature     numeric,
  rainfall        numeric,
  drought_level   integer not null default 0 check (drought_level between 0 and 10),
  flood_risk      integer not null default 0 check (flood_risk between 0 and 10),
  disease_risk    integer not null default 0 check (disease_risk between 0 and 10),
  notes           text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists world_env_state_world_day_idx on world_environment_state (world_id, in_game_year, in_game_day);
create index if not exists world_env_state_region_idx on world_environment_state (region_id);

-- ============================================================
-- CULTURES
-- ============================================================

create table if not exists cultures (
  id                   uuid primary key default uuid_generate_v4(),
  world_id             uuid not null references worlds(id) on delete cascade,
  name                 text not null,
  slug                 text not null,
  origin_region_id     uuid references world_regions(id) on delete set null,
  ambition_level       integer not null default 5 check (ambition_level between 0 and 10),
  cooperation_level    integer not null default 5 check (cooperation_level between 0 and 10),
  aggression_level     integer not null default 5 check (aggression_level between 0 and 10),
  spiritual_tendency   integer not null default 5 check (spiritual_tendency between 0 and 10),
  family_centrality    integer not null default 5 check (family_centrality between 0 and 10),
  work_ethic           integer not null default 5 check (work_ethic between 0 and 10),
  color_hex            text,
  description          text,
  population_estimate  integer not null default 0 check (population_estimate >= 0),
  metadata             jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (world_id, slug)
);

create index if not exists cultures_world_id_idx on cultures (world_id);

create trigger cultures_updated_at
  before update on cultures
  for each row execute function set_updated_at();

-- ============================================================
-- SETTLEMENTS
-- ============================================================

create table if not exists settlements (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  region_id        uuid references world_regions(id) on delete set null,
  culture_id       uuid references cultures(id) on delete set null,
  name             text not null,
  settlement_type  text not null default 'village' check (settlement_type in ('camp','village','town','city')),
  population       integer not null default 0 check (population >= 0),
  prosperity       integer not null default 5 check (prosperity between 0 and 10),
  stability        integer not null default 5 check (stability between 0 and 10),
  has_walls        boolean not null default false,
  has_market       boolean not null default false,
  has_temple       boolean not null default false,
  position_x       numeric not null default 0,
  position_y       numeric not null default 0,
  status           text not null default 'active' check (status in ('active','abandoned','occupied','destroyed')),
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists settlements_world_id_idx on settlements (world_id);
create index if not exists settlements_region_id_idx on settlements (region_id);
create index if not exists settlements_culture_id_idx on settlements (culture_id);
create index if not exists settlements_status_idx on settlements (status);

create trigger settlements_updated_at
  before update on settlements
  for each row execute function set_updated_at();

-- ============================================================
-- PERSONS
-- ============================================================

create table if not exists persons (
  id                  uuid primary key default uuid_generate_v4(),
  world_id            uuid not null references worlds(id) on delete cascade,
  name                text not null,
  age                 integer not null check (age >= 0),
  life_stage          text not null default 'adult' check (life_stage in ('infant','child','adolescent','young_adult','adult','elder')),
  sex                 text not null default 'unknown',
  birthplace_id       uuid references settlements(id) on delete set null,
  residence_id        uuid references settlements(id) on delete set null,
  household_id        uuid, -- FK added after households table; see below
  culture_id          uuid references cultures(id) on delete set null,
  class_tier          text not null default 'common' check (class_tier in ('destitute','poor','common','skilled','wealthy','noble','elite')),
  occupation          text,
  employment_status   text not null default 'employed' check (employment_status in ('employed','apprenticing','underemployed','displaced','unemployed','unable')),
  is_alive            boolean not null default true,
  is_featured         boolean not null default false,
  health_score        integer not null default 5 check (health_score between 0 and 10),
  wealth_score        integer not null default 5 check (wealth_score between 0 and 10),
  reputation_score    integer not null default 5 check (reputation_score between 0 and 10),
  happiness_score     integer not null default 5 check (happiness_score between 0 and 10),
  -- Position for world viewer
  pos_x               numeric not null default 0,
  pos_y               numeric not null default 0,
  -- Traits (0-10, stored inline for simulation performance)
  trait_ambition        integer not null default 5 check (trait_ambition between 0 and 10),
  trait_honesty         integer not null default 5 check (trait_honesty between 0 and 10),
  trait_loyalty         integer not null default 5 check (trait_loyalty between 0 and 10),
  trait_aggression      integer not null default 5 check (trait_aggression between 0 and 10),
  trait_curiosity       integer not null default 5 check (trait_curiosity between 0 and 10),
  trait_sociability     integer not null default 5 check (trait_sociability between 0 and 10),
  trait_jealousy        integer not null default 5 check (trait_jealousy between 0 and 10),
  trait_generosity      integer not null default 5 check (trait_generosity between 0 and 10),
  trait_spirituality    integer not null default 5 check (trait_spirituality between 0 and 10),
  trait_romance_drive   integer not null default 5 check (trait_romance_drive between 0 and 10),
  trait_vindictiveness  integer not null default 5 check (trait_vindictiveness between 0 and 10),
  trait_greed           integer not null default 5 check (trait_greed between 0 and 10),
  trait_work_ethic      integer not null default 5 check (trait_work_ethic between 0 and 10),
  -- Needs (0-10; higher = more urgent)
  need_hunger     integer not null default 0 check (need_hunger between 0 and 10),
  need_fatigue    integer not null default 0 check (need_fatigue between 0 and 10),
  need_stress     integer not null default 0 check (need_stress between 0 and 10),
  need_safety     integer not null default 0 check (need_safety between 0 and 10),
  need_belonging  integer not null default 0 check (need_belonging between 0 and 10),
  need_intimacy   integer not null default 0 check (need_intimacy between 0 and 10),
  need_hope       integer not null default 0 check (need_hope between 0 and 10),
  -- Goals
  current_goal    text,
  current_action  text,
  secrets         jsonb,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists persons_world_id_idx on persons (world_id);
create index if not exists persons_world_id_alive_idx on persons (world_id, is_alive);
create index if not exists persons_residence_id_idx on persons (residence_id);
create index if not exists persons_household_id_idx on persons (household_id);
create index if not exists persons_culture_id_idx on persons (culture_id);
create index if not exists persons_is_featured_idx on persons (is_featured) where is_featured = true;

create trigger persons_updated_at
  before update on persons
  for each row execute function set_updated_at();

-- ============================================================
-- HOUSEHOLDS
-- ============================================================

create table if not exists households (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id) on delete cascade,
  settlement_id   uuid references settlements(id) on delete set null,
  head_person_id  uuid references persons(id) on delete set null,
  name            text,
  wealth_level    integer not null default 5 check (wealth_level between 0 and 10),
  member_count    integer not null default 0 check (member_count >= 0),
  reputation      integer not null default 5 check (reputation between 0 and 10),
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists households_world_id_idx on households (world_id);
create index if not exists households_settlement_id_idx on households (settlement_id);

create trigger households_updated_at
  before update on households
  for each row execute function set_updated_at();

-- Add deferred FK from persons to households
alter table persons
  add constraint persons_household_id_fkey
  foreign key (household_id) references households(id) on delete set null;

-- ============================================================
-- RELATIONSHIPS
-- ============================================================

create table if not exists relationships (
  id                 uuid primary key default uuid_generate_v4(),
  world_id           uuid not null references worlds(id) on delete cascade,
  person_a_id        uuid not null references persons(id) on delete cascade,
  person_b_id        uuid not null references persons(id) on delete cascade,
  relationship_type  text not null,
  trust              integer not null default 5 check (trust between 0 and 10),
  attraction         integer not null default 0 check (attraction between 0 and 10),
  resentment         integer not null default 0 check (resentment between 0 and 10),
  is_secret          boolean not null default false,
  is_active          boolean not null default true,
  started_day        integer,
  metadata           jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint relationships_no_self check (person_a_id <> person_b_id)
);

create index if not exists relationships_world_id_idx on relationships (world_id);
create index if not exists relationships_person_a_idx on relationships (person_a_id);
create index if not exists relationships_person_b_idx on relationships (person_b_id);
create index if not exists relationships_active_idx on relationships (is_active) where is_active = true;

create trigger relationships_updated_at
  before update on relationships
  for each row execute function set_updated_at();

-- ============================================================
-- PUBLIC EVENTS
-- ============================================================

create table if not exists public_events (
  id                    uuid primary key default uuid_generate_v4(),
  world_id              uuid not null references worlds(id) on delete cascade,
  event_type            text not null,
  title                 text not null,
  description           text not null,
  primary_person_id     uuid references persons(id) on delete set null,
  secondary_person_id   uuid references persons(id) on delete set null,
  settlement_id         uuid references settlements(id) on delete set null,
  culture_id            uuid references cultures(id) on delete set null,
  region_id             uuid references world_regions(id) on delete set null,
  significance_score    integer not null default 1 check (significance_score between 1 and 10),
  is_milestone          boolean not null default false,
  is_featured           boolean not null default false,
  in_game_day           integer not null,
  in_game_year          integer not null,
  metadata              jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists public_events_world_id_idx on public_events (world_id);
create index if not exists public_events_day_idx on public_events (world_id, in_game_year, in_game_day);
create index if not exists public_events_featured_idx on public_events (is_featured) where is_featured = true;
create index if not exists public_events_milestone_idx on public_events (is_milestone) where is_milestone = true;
create index if not exists public_events_primary_person_idx on public_events (primary_person_id);
create index if not exists public_events_event_type_idx on public_events (event_type);

-- ============================================================
-- WORLD VOTES
-- ============================================================

create table if not exists world_votes (
  id                  uuid primary key default uuid_generate_v4(),
  world_id            uuid not null references worlds(id) on delete cascade,
  cycle_number        integer not null,
  title               text not null,
  description         text not null,
  vote_category       text not null,
  status              text not null default 'upcoming' check (status in ('upcoming','open','closed','resolved')),
  opens_at            timestamptz,
  closes_at           timestamptz,
  resolved_at         timestamptz,
  in_game_day_opens   integer,
  winning_option_id   uuid, -- FK added after vote_options; see below
  effect_applied      boolean not null default false,
  total_votes_cast    integer not null default 0 check (total_votes_cast >= 0),
  metadata            jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists world_votes_world_id_idx on world_votes (world_id);
create index if not exists world_votes_status_idx on world_votes (status);

-- ============================================================
-- VOTE OPTIONS
-- ============================================================

create table if not exists vote_options (
  id                 uuid primary key default uuid_generate_v4(),
  vote_id            uuid not null references world_votes(id) on delete cascade,
  title              text not null,
  description        text not null,
  effect_summary     text,
  votes_count        integer not null default 0 check (votes_count >= 0),
  token_votes_count  integer not null default 0 check (token_votes_count >= 0),
  effect_config      jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists vote_options_vote_id_idx on vote_options (vote_id);

-- Now add the FK from world_votes back to vote_options
alter table world_votes
  add constraint world_votes_winning_option_id_fkey
  foreign key (winning_option_id) references vote_options(id) on delete set null;

-- ============================================================
-- VOTE PARTICIPATION
-- ============================================================

create table if not exists vote_participation (
  id            uuid primary key default uuid_generate_v4(),
  vote_id       uuid not null references world_votes(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  option_id     uuid not null references vote_options(id) on delete cascade,
  token_amount  integer not null default 0 check (token_amount >= 0),
  voted_at      timestamptz not null default now(),
  unique (vote_id, user_id)
);

create index if not exists vote_participation_vote_id_idx on vote_participation (vote_id);
create index if not exists vote_participation_user_id_idx on vote_participation (user_id);

-- ============================================================
-- FOLLOWS
-- ============================================================

create table if not exists follows (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  follow_type       text not null check (follow_type in ('person','household','settlement','culture','bloodline')),
  follow_target_id  uuid not null,
  created_at        timestamptz not null default now(),
  unique (user_id, follow_type, follow_target_id)
);

create index if not exists follows_user_id_idx on follows (user_id);
create index if not exists follows_target_idx on follows (follow_type, follow_target_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists notifications (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references profiles(id) on delete cascade,
  type             text not null,
  title            text not null,
  body             text,
  is_read          boolean not null default false,
  public_event_id  uuid references public_events(id) on delete set null,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id);
create index if not exists notifications_user_unread_idx on notifications (user_id, is_read) where is_read = false;
create index if not exists notifications_created_at_idx on notifications (created_at desc);

-- ============================================================
-- DAILY RECAPS
-- ============================================================

create table if not exists daily_recaps (
  id              uuid primary key default uuid_generate_v4(),
  world_id        uuid not null references worlds(id) on delete cascade,
  in_game_day     integer not null,
  in_game_year    integer not null,
  title           text,
  summary         text,
  ai_narrative    text,
  headline_event  text,
  drama_note      text,
  weather_note    text,
  is_published    boolean not null default false,
  published_at    timestamptz,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (world_id, in_game_year, in_game_day)
);

create index if not exists daily_recaps_world_id_idx on daily_recaps (world_id);
create index if not exists daily_recaps_published_idx on daily_recaps (world_id, is_published, in_game_year desc, in_game_day desc);

-- ============================================================
-- WEEKLY RECAPS
-- ============================================================

create table if not exists weekly_recaps (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  week_number      integer not null,
  in_game_year     integer not null,
  in_game_day_end  integer not null,
  title            text,
  summary          text,
  ai_narrative     text,
  top_events       jsonb,
  population_delta integer not null default 0,
  drama_score      integer not null default 0,
  is_published     boolean not null default false,
  published_at     timestamptz,
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  unique (world_id, in_game_year, week_number)
);

create index if not exists weekly_recaps_world_id_idx on weekly_recaps (world_id);
create index if not exists weekly_recaps_published_idx on weekly_recaps (world_id, is_published);

-- ============================================================
-- BILLING EVENTS
-- ============================================================

create table if not exists billing_events (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references profiles(id) on delete set null,
  event_type           text not null,
  stripe_event_id      text unique,
  stripe_customer_id   text,
  amount_cents         integer,
  currency             text not null default 'usd',
  metadata             jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists billing_events_user_id_idx on billing_events (user_id);
create index if not exists billing_events_stripe_event_id_idx on billing_events (stripe_event_id);
create index if not exists billing_events_created_at_idx on billing_events (created_at desc);

-- ============================================================
-- TOKEN PURCHASE ORDERS
-- ============================================================

create table if not exists token_purchase_orders (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references profiles(id) on delete cascade,
  token_pack_id      text not null,
  token_amount       integer not null check (token_amount > 0),
  price_cents        integer not null check (price_cents > 0),
  stripe_session_id  text unique,
  status             text not null default 'pending' check (status in ('pending','completed','failed','refunded')),
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists token_purchase_orders_user_id_idx on token_purchase_orders (user_id);
create index if not exists token_purchase_orders_status_idx on token_purchase_orders (status);
create index if not exists token_purchase_orders_stripe_session_idx on token_purchase_orders (stripe_session_id);

-- ============================================================
-- FEATURE FLAGS
-- ============================================================

create table if not exists feature_flags (
  id                   uuid primary key default uuid_generate_v4(),
  flag_key             text not null unique,
  is_enabled           boolean not null default false,
  rollout_percentage   integer not null default 100 check (rollout_percentage between 0 and 100),
  description          text,
  updated_at           timestamptz not null default now()
);

create trigger feature_flags_updated_at
  before update on feature_flags
  for each row execute function set_updated_at();

-- ============================================================
-- ADMIN CONFIGS
-- ============================================================

create table if not exists admin_configs (
  id           uuid primary key default uuid_generate_v4(),
  key          text not null unique,
  value        jsonb,
  description  text,
  updated_at   timestamptz not null default now()
);

create trigger admin_configs_updated_at
  before update on admin_configs
  for each row execute function set_updated_at();

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table if not exists audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete set null,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  old_value    jsonb,
  new_value    jsonb,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on audit_logs (user_id);
create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);

-- ============================================================
-- MILESTONE EVENTS
-- ============================================================

create table if not exists milestone_events (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  milestone_type   text not null,
  title            text not null,
  description      text not null,
  in_game_day      integer not null,
  in_game_year     integer not null,
  person_id        uuid references persons(id) on delete set null,
  settlement_id    uuid references settlements(id) on delete set null,
  culture_id       uuid references cultures(id) on delete set null,
  is_world_event   boolean not null default false,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists milestone_events_world_id_idx on milestone_events (world_id);
create index if not exists milestone_events_day_idx on milestone_events (world_id, in_game_year, in_game_day);

-- ============================================================
-- SCANDALS
-- ============================================================

create table if not exists scandals (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  title            text not null,
  description      text not null,
  primary_person_id  uuid references persons(id) on delete set null,
  secondary_person_id uuid references persons(id) on delete set null,
  settlement_id    uuid references settlements(id) on delete set null,
  scandal_type     text not null,
  severity         integer not null default 3 check (severity between 1 and 10),
  is_resolved      boolean not null default false,
  resolved_day     integer,
  in_game_day      integer not null,
  in_game_year     integer not null,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists scandals_world_id_idx on scandals (world_id);
create index if not exists scandals_primary_person_idx on scandals (primary_person_id);
create index if not exists scandals_unresolved_idx on scandals (world_id, is_resolved) where is_resolved = false;

-- ============================================================
-- CONFLICTS
-- ============================================================

create table if not exists conflicts (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  conflict_type    text not null,
  title            text not null,
  description      text not null,
  aggressor_culture_id  uuid references cultures(id) on delete set null,
  defender_culture_id   uuid references cultures(id) on delete set null,
  aggressor_settlement_id uuid references settlements(id) on delete set null,
  defender_settlement_id  uuid references settlements(id) on delete set null,
  region_id        uuid references world_regions(id) on delete set null,
  status           text not null default 'active' check (status in ('brewing','active','resolved','stalemate')),
  severity         integer not null default 5 check (severity between 1 and 10),
  started_day      integer not null,
  started_year     integer not null,
  ended_day        integer,
  ended_year       integer,
  outcome          text,
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists conflicts_world_id_idx on conflicts (world_id);
create index if not exists conflicts_status_idx on conflicts (world_id, status);

create trigger conflicts_updated_at
  before update on conflicts
  for each row execute function set_updated_at();

-- ============================================================
-- CRIMES
-- ============================================================

create table if not exists crimes (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  crime_type       text not null,
  description      text not null,
  perpetrator_id   uuid references persons(id) on delete set null,
  victim_id        uuid references persons(id) on delete set null,
  settlement_id    uuid references settlements(id) on delete set null,
  severity         integer not null default 3 check (severity between 1 and 10),
  is_solved        boolean not null default false,
  punishment       text,
  in_game_day      integer not null,
  in_game_year     integer not null,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists crimes_world_id_idx on crimes (world_id);
create index if not exists crimes_perpetrator_idx on crimes (perpetrator_id);
create index if not exists crimes_victim_idx on crimes (victim_id);

-- ============================================================
-- UNIONS (MARRIAGES / PARTNERSHIPS)
-- ============================================================

create table if not exists unions (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  person_a_id      uuid not null references persons(id) on delete cascade,
  person_b_id      uuid not null references persons(id) on delete cascade,
  union_type       text not null default 'marriage' check (union_type in ('marriage','partnership','betrothal','concubinage')),
  status           text not null default 'active' check (status in ('active','dissolved','widowed')),
  formed_day       integer not null,
  formed_year      integer not null,
  dissolved_day    integer,
  dissolved_year   integer,
  dissolution_reason text,
  household_id     uuid references households(id) on delete set null,
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint unions_no_self check (person_a_id <> person_b_id)
);

create index if not exists unions_world_id_idx on unions (world_id);
create index if not exists unions_person_a_idx on unions (person_a_id);
create index if not exists unions_person_b_idx on unions (person_b_id);
create index if not exists unions_active_idx on unions (world_id, status) where status = 'active';

create trigger unions_updated_at
  before update on unions
  for each row execute function set_updated_at();

-- ============================================================
-- BIRTHS
-- ============================================================

create table if not exists births (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  child_id         uuid not null references persons(id) on delete cascade,
  mother_id        uuid references persons(id) on delete set null,
  father_id        uuid references persons(id) on delete set null,
  settlement_id    uuid references settlements(id) on delete set null,
  household_id     uuid references households(id) on delete set null,
  in_game_day      integer not null,
  in_game_year     integer not null,
  is_stillbirth    boolean not null default false,
  notes            text,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists births_world_id_idx on births (world_id);
create index if not exists births_child_id_idx on births (child_id);
create index if not exists births_mother_id_idx on births (mother_id);
create index if not exists births_father_id_idx on births (father_id);

-- ============================================================
-- DEATHS
-- ============================================================

create table if not exists deaths (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  person_id        uuid not null references persons(id) on delete cascade,
  cause_of_death   text not null default 'unknown',
  manner           text check (manner in ('natural','violence','accident','illness','starvation','execution','other')),
  in_game_day      integer not null,
  in_game_year     integer not null,
  age_at_death     integer,
  settlement_id    uuid references settlements(id) on delete set null,
  killer_id        uuid references persons(id) on delete set null,
  notes            text,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists deaths_world_id_idx on deaths (world_id);
create index if not exists deaths_person_id_idx on deaths (person_id);
create index if not exists deaths_in_game_day_idx on deaths (world_id, in_game_year, in_game_day);

-- ============================================================
-- BLOODLINES
-- ============================================================

create table if not exists bloodlines (
  id               uuid primary key default uuid_generate_v4(),
  world_id         uuid not null references worlds(id) on delete cascade,
  name             text not null,
  founder_id       uuid references persons(id) on delete set null,
  origin_culture_id uuid references cultures(id) on delete set null,
  origin_settlement_id uuid references settlements(id) on delete set null,
  prestige         integer not null default 5 check (prestige between 0 and 10),
  is_extinct       boolean not null default false,
  notes            text,
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bloodlines_world_id_idx on bloodlines (world_id);
create index if not exists bloodlines_founder_idx on bloodlines (founder_id);

create trigger bloodlines_updated_at
  before update on bloodlines
  for each row execute function set_updated_at();

-- Bloodline membership (many persons can belong to a bloodline)
create table if not exists bloodline_members (
  id            uuid primary key default uuid_generate_v4(),
  bloodline_id  uuid not null references bloodlines(id) on delete cascade,
  person_id     uuid not null references persons(id) on delete cascade,
  joined_day    integer,
  joined_year   integer,
  membership_type text not null default 'born' check (membership_type in ('born','married','adopted')),
  created_at    timestamptz not null default now(),
  unique (bloodline_id, person_id)
);

create index if not exists bloodline_members_bloodline_idx on bloodline_members (bloodline_id);
create index if not exists bloodline_members_person_idx on bloodline_members (person_id);

-- ============================================================
-- INSTITUTIONS
-- ============================================================

create table if not exists institutions (
  id                uuid primary key default uuid_generate_v4(),
  world_id          uuid not null references worlds(id) on delete cascade,
  name              text not null,
  institution_type  text not null check (institution_type in ('council','guild','court','tribunal','school','market','militia')),
  settlement_id     uuid references settlements(id) on delete set null,
  region_id         uuid references world_regions(id) on delete set null,
  head_person_id    uuid references persons(id) on delete set null,
  influence         integer not null default 5 check (influence between 0 and 10),
  wealth            integer not null default 5 check (wealth between 0 and 10),
  stability         integer not null default 5 check (stability between 0 and 10),
  is_active         boolean not null default true,
  founded_day       integer,
  founded_year      integer,
  description       text,
  metadata          jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists institutions_world_id_idx on institutions (world_id);
create index if not exists institutions_settlement_idx on institutions (settlement_id);
create index if not exists institutions_active_idx on institutions (world_id, is_active) where is_active = true;

create trigger institutions_updated_at
  before update on institutions
  for each row execute function set_updated_at();

-- Institution memberships
create table if not exists institution_members (
  id              uuid primary key default uuid_generate_v4(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  person_id       uuid not null references persons(id) on delete cascade,
  role_title      text,
  rank            integer not null default 1,
  joined_day      integer,
  joined_year     integer,
  is_active       boolean not null default true,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (institution_id, person_id)
);

create index if not exists institution_members_institution_idx on institution_members (institution_id);
create index if not exists institution_members_person_idx on institution_members (person_id);

-- ============================================================
-- RELIGIONS
-- ============================================================

create table if not exists religions (
  id                  uuid primary key default uuid_generate_v4(),
  world_id            uuid not null references worlds(id) on delete cascade,
  name                text not null,
  slug                text not null,
  origin_culture_id   uuid references cultures(id) on delete set null,
  origin_region_id    uuid references world_regions(id) on delete set null,
  deity_name          text,
  theology_summary    text,
  afterlife_belief    text,
  moral_code          text,
  ritual_frequency    text,
  spread_tendency     integer not null default 5 check (spread_tendency between 0 and 10),
  orthodoxy           integer not null default 5 check (orthodoxy between 0 and 10),
  follower_count      integer not null default 0 check (follower_count >= 0),
  is_active           boolean not null default true,
  founded_day         integer,
  founded_year        integer,
  description         text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (world_id, slug)
);

create index if not exists religions_world_id_idx on religions (world_id);
create index if not exists religions_origin_culture_idx on religions (origin_culture_id);

create trigger religions_updated_at
  before update on religions
  for each row execute function set_updated_at();

-- Religion followers
create table if not exists religion_followers (
  id            uuid primary key default uuid_generate_v4(),
  religion_id   uuid not null references religions(id) on delete cascade,
  person_id     uuid not null references persons(id) on delete cascade,
  devotion      integer not null default 5 check (devotion between 0 and 10),
  is_clergy     boolean not null default false,
  joined_day    integer,
  joined_year   integer,
  created_at    timestamptz not null default now(),
  unique (religion_id, person_id)
);

create index if not exists religion_followers_religion_idx on religion_followers (religion_id);
create index if not exists religion_followers_person_idx on religion_followers (person_id);

-- ============================================================
-- FUNCTIONS: credit_tokens
-- ============================================================

create or replace function credit_tokens(
  p_user_id    uuid,
  p_amount     integer,
  p_description text
) returns integer as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'credit_tokens: amount must be positive, got %', p_amount;
  end if;

  update token_wallets
  set
    balance            = balance + p_amount,
    lifetime_purchased = case
      when p_description ilike '%purchase%' or p_description ilike '%admin_grant%'
      then lifetime_purchased + p_amount
      else lifetime_purchased
    end,
    updated_at = now()
  where user_id = p_user_id
  returning balance into v_new_balance;

  if not found then
    raise exception 'credit_tokens: no wallet found for user %', p_user_id;
  end if;

  insert into token_transactions
    (user_id, amount, balance_after, type, description)
  values
    (p_user_id, p_amount, v_new_balance, 'purchase', p_description);

  return v_new_balance;
end;
$$ language plpgsql security definer;

-- ============================================================
-- FUNCTIONS: spend_tokens
-- ============================================================

create or replace function spend_tokens(
  p_user_id     uuid,
  p_amount      integer,
  p_description text
) returns boolean as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'spend_tokens: amount must be positive, got %', p_amount;
  end if;

  update token_wallets
  set
    balance    = balance - p_amount,
    updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount
  returning balance into v_new_balance;

  if not found then
    return false;
  end if;

  insert into token_transactions
    (user_id, amount, balance_after, type, description)
  values
    (p_user_id, -p_amount, v_new_balance, 'spend', p_description);

  return true;
end;
$$ language plpgsql security definer;

-- ============================================================
-- FUNCTIONS: get_world_state
-- ============================================================

create or replace function get_world_state(p_world_slug text)
returns jsonb as $$
declare
  v_world worlds%rowtype;
  v_result jsonb;
begin
  select * into v_world
  from worlds
  where slug = p_world_slug
  limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'world', row_to_json(v_world),
    'settlement_count', (select count(*) from settlements where world_id = v_world.id and status = 'active'),
    'population', (select coalesce(sum(population), 0) from settlements where world_id = v_world.id and status = 'active'),
    'person_count', (select count(*) from persons where world_id = v_world.id and is_alive = true),
    'culture_count', (select count(*) from cultures where world_id = v_world.id),
    'latest_events', (
      select jsonb_agg(e order by e.created_at desc)
      from (
        select id, event_type, title, in_game_day, in_game_year, significance_score, created_at
        from public_events
        where world_id = v_world.id
        order by created_at desc
        limit 10
      ) e
    ),
    'open_votes', (
      select jsonb_agg(v order by v.opens_at asc)
      from (
        select id, title, vote_category, status, opens_at, closes_at, total_votes_cast
        from world_votes
        where world_id = v_world.id
          and status in ('open', 'upcoming')
        order by opens_at asc
        limit 5
      ) v
    )
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer stable;
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
-- ============================================================
-- Migration 003: Fix scale constraints, add RPCs, owner setup
-- ============================================================

-- ============================================================
-- FIX PERSONS TABLE: change 0-10 constraints to 0-100
-- ============================================================

ALTER TABLE persons
  DROP CONSTRAINT IF EXISTS persons_health_score_check,
  DROP CONSTRAINT IF EXISTS persons_wealth_score_check,
  DROP CONSTRAINT IF EXISTS persons_happiness_score_check,
  DROP CONSTRAINT IF EXISTS persons_reputation_score_check,
  DROP CONSTRAINT IF EXISTS persons_need_hunger_check,
  DROP CONSTRAINT IF EXISTS persons_need_fatigue_check,
  DROP CONSTRAINT IF EXISTS persons_need_stress_check,
  DROP CONSTRAINT IF EXISTS persons_need_safety_check,
  DROP CONSTRAINT IF EXISTS persons_need_belonging_check,
  DROP CONSTRAINT IF EXISTS persons_need_intimacy_check,
  DROP CONSTRAINT IF EXISTS persons_need_hope_check,
  DROP CONSTRAINT IF EXISTS persons_trait_ambition_check,
  DROP CONSTRAINT IF EXISTS persons_trait_honesty_check,
  DROP CONSTRAINT IF EXISTS persons_trait_loyalty_check,
  DROP CONSTRAINT IF EXISTS persons_trait_aggression_check,
  DROP CONSTRAINT IF EXISTS persons_trait_curiosity_check,
  DROP CONSTRAINT IF EXISTS persons_trait_sociability_check,
  DROP CONSTRAINT IF EXISTS persons_trait_jealousy_check,
  DROP CONSTRAINT IF EXISTS persons_trait_generosity_check,
  DROP CONSTRAINT IF EXISTS persons_trait_spirituality_check,
  DROP CONSTRAINT IF EXISTS persons_trait_romance_drive_check,
  DROP CONSTRAINT IF EXISTS persons_trait_vindictiveness_check,
  DROP CONSTRAINT IF EXISTS persons_trait_greed_check,
  DROP CONSTRAINT IF EXISTS persons_trait_work_ethic_check;

ALTER TABLE persons
  ADD CONSTRAINT persons_health_score_check CHECK (health_score BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_wealth_score_check CHECK (wealth_score BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_happiness_score_check CHECK (happiness_score BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_reputation_score_check CHECK (reputation_score BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_hunger_check CHECK (need_hunger BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_fatigue_check CHECK (need_fatigue BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_stress_check CHECK (need_stress BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_safety_check CHECK (need_safety BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_belonging_check CHECK (need_belonging BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_intimacy_check CHECK (need_intimacy BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_need_hope_check CHECK (need_hope BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_ambition_check CHECK (trait_ambition BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_honesty_check CHECK (trait_honesty BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_loyalty_check CHECK (trait_loyalty BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_aggression_check CHECK (trait_aggression BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_curiosity_check CHECK (trait_curiosity BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_sociability_check CHECK (trait_sociability BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_jealousy_check CHECK (trait_jealousy BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_generosity_check CHECK (trait_generosity BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_spirituality_check CHECK (trait_spirituality BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_romance_drive_check CHECK (trait_romance_drive BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_vindictiveness_check CHECK (trait_vindictiveness BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_greed_check CHECK (trait_greed BETWEEN 0 AND 100),
  ADD CONSTRAINT persons_trait_work_ethic_check CHECK (trait_work_ethic BETWEEN 0 AND 100);

-- ============================================================
-- FIX CULTURES TABLE: change 0-10 constraints to 0-100
-- ============================================================

ALTER TABLE cultures
  DROP CONSTRAINT IF EXISTS cultures_ambition_level_check,
  DROP CONSTRAINT IF EXISTS cultures_cooperation_level_check,
  DROP CONSTRAINT IF EXISTS cultures_aggression_level_check,
  DROP CONSTRAINT IF EXISTS cultures_spiritual_tendency_check,
  DROP CONSTRAINT IF EXISTS cultures_family_centrality_check,
  DROP CONSTRAINT IF EXISTS cultures_work_ethic_check;

ALTER TABLE cultures
  ADD CONSTRAINT cultures_ambition_level_check CHECK (ambition_level BETWEEN 0 AND 100),
  ADD CONSTRAINT cultures_cooperation_level_check CHECK (cooperation_level BETWEEN 0 AND 100),
  ADD CONSTRAINT cultures_aggression_level_check CHECK (aggression_level BETWEEN 0 AND 100),
  ADD CONSTRAINT cultures_spiritual_tendency_check CHECK (spiritual_tendency BETWEEN 0 AND 100),
  ADD CONSTRAINT cultures_family_centrality_check CHECK (family_centrality BETWEEN 0 AND 100),
  ADD CONSTRAINT cultures_work_ethic_check CHECK (work_ethic BETWEEN 0 AND 100);

-- ============================================================
-- FIX SETTLEMENTS TABLE: change 0-10 constraints to 0-100
-- ============================================================

ALTER TABLE settlements
  DROP CONSTRAINT IF EXISTS settlements_prosperity_check,
  DROP CONSTRAINT IF EXISTS settlements_stability_check,
  DROP CONSTRAINT IF EXISTS settlements_settlement_type_check;

ALTER TABLE settlements
  ADD CONSTRAINT settlements_prosperity_check CHECK (prosperity BETWEEN 0 AND 100),
  ADD CONSTRAINT settlements_stability_check CHECK (stability BETWEEN 0 AND 100),
  ADD CONSTRAINT settlements_settlement_type_check
    CHECK (settlement_type IN ('camp','hamlet','village','town','city','fortress','ruins'));

-- ============================================================
-- FIX PUBLIC_EVENTS TABLE: change 1-10 significance to 1-100
-- ============================================================

ALTER TABLE public_events
  DROP CONSTRAINT IF EXISTS public_events_significance_score_check;

ALTER TABLE public_events
  ADD CONSTRAINT public_events_significance_score_check CHECK (significance_score BETWEEN 1 AND 100);

-- ============================================================
-- RPC: spend_tokens
-- Deducts tokens from a user wallet atomically.
-- Returns true on success, false if insufficient balance.
-- ============================================================

CREATE OR REPLACE FUNCTION spend_tokens(
  p_user_id   uuid,
  p_amount    integer,
  p_description text DEFAULT 'Token spend'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance     integer;
  v_new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO v_balance
  FROM token_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN false;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE token_wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO token_transactions (user_id, amount, balance_after, type, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'spend', p_description);

  RETURN true;
END;
$$;

-- ============================================================
-- RPC: credit_tokens
-- Adds tokens to a user wallet.
-- Returns the new balance.
-- ============================================================

CREATE OR REPLACE FUNCTION credit_tokens(
  p_user_id   uuid,
  p_amount    integer,
  p_type      text DEFAULT 'purchase',
  p_description text DEFAULT 'Token credit'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE token_wallets
  SET balance            = balance + p_amount,
      lifetime_purchased = lifetime_purchased + CASE WHEN p_type = 'purchase' THEN p_amount ELSE 0 END,
      updated_at         = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    -- Wallet doesn't exist yet; create it
    INSERT INTO token_wallets (user_id, balance, lifetime_purchased)
    VALUES (
      p_user_id,
      p_amount,
      CASE WHEN p_type = 'purchase' THEN p_amount ELSE 0 END
    )
    RETURNING balance INTO v_new_balance;
  END IF;

  INSERT INTO token_transactions (user_id, amount, balance_after, type, description)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_description);

  RETURN v_new_balance;
END;
$$;

-- ============================================================
-- RPC: increment_vote_count
-- Increments vote count for an option.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_vote_count(
  p_option_id    uuid,
  p_token_amount integer DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE vote_options
  SET votes_count       = votes_count + 1,
      token_votes_count = token_votes_count + GREATEST(p_token_amount, 0)
  WHERE id = p_option_id;
END;
$$;

-- ============================================================
-- OWNER AUTO-ADMIN
-- When zacharynelson96@gmail.com registers, auto-grant admin role.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text := 'guest';
BEGIN
  IF new.email = 'zacharynelson96@gmail.com' THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, role)
  VALUES (new.id, v_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  RETURN new;
END;
$$;

-- ============================================================
-- OWNER AUTO-TOKENS
-- When the owner's profile is created, grant unlimited tokens.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_initial_balance integer := 0;
  v_user_email      text;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = new.id;

  IF v_user_email = 'zacharynelson96@gmail.com' THEN
    v_initial_balance := 999999;
  END IF;

  INSERT INTO public.token_wallets (user_id, balance)
  VALUES (new.id, v_initial_balance)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- ============================================================
-- HELPER: is_owner — returns true for the owner email
-- Used in RLS policies for extra bypass
-- ============================================================

CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND email = 'zacharynelson96@gmail.com'
  )
$$;
