-- ============================================================
-- RESET: Drop all app tables so combined_run_once.sql can
-- create them fresh. Safe to run on a new/empty project.
-- Does NOT touch auth.users.
-- ============================================================

drop table if exists religion_followers       cascade;
drop table if exists religions                cascade;
drop table if exists institution_members      cascade;
drop table if exists institutions             cascade;
drop table if exists bloodline_members        cascade;
drop table if exists bloodlines               cascade;
drop table if exists deaths                   cascade;
drop table if exists births                   cascade;
drop table if exists unions                   cascade;
drop table if exists crimes                   cascade;
drop table if exists conflicts                cascade;
drop table if exists scandals                 cascade;
drop table if exists milestone_events         cascade;
drop table if exists audit_logs               cascade;
drop table if exists admin_configs            cascade;
drop table if exists feature_flags            cascade;
drop table if exists token_purchase_orders    cascade;
drop table if exists billing_events           cascade;
drop table if exists weekly_recaps            cascade;
drop table if exists daily_recaps             cascade;
drop table if exists notifications            cascade;
drop table if exists follows                  cascade;
drop table if exists vote_participation       cascade;
drop table if exists vote_options             cascade;
drop table if exists world_votes              cascade;
drop table if exists public_events            cascade;
drop table if exists relationships            cascade;
drop table if exists persons                  cascade;
drop table if exists households               cascade;
drop table if exists settlements              cascade;
drop table if exists cultures                 cascade;
drop table if exists world_environment_state  cascade;
drop table if exists world_regions            cascade;
drop table if exists worlds                   cascade;
drop table if exists token_transactions       cascade;
drop table if exists token_wallets            cascade;
drop table if exists subscriptions            cascade;
drop table if exists profiles                 cascade;

-- Drop helper functions so they get recreated cleanly
drop function if exists set_updated_at()        cascade;
drop function if exists handle_new_user()       cascade;
drop function if exists handle_new_profile()    cascade;
drop function if exists is_admin()              cascade;
drop function if exists is_owner()              cascade;
drop function if exists get_world_overview(uuid) cascade;
drop function if exists get_my_profile()        cascade;

-- Done — now run combined_run_once.sql
