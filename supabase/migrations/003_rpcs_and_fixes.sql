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
