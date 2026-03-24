// Auto-maintained Supabase database types for First Valley
// Run: npx supabase gen types typescript --project-id YOUR_ID > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          role: 'guest' | 'subscriber' | 'admin'
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: 'guest' | 'subscriber' | 'admin'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: 'guest' | 'subscriber' | 'admin'
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: never[]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'unpaid'
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'unpaid'
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'unpaid'
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          updated_at?: string
        }
        Relationships: never[]
      }
      token_wallets: {
        Row: {
          id: string
          user_id: string
          balance: number
          lifetime_purchased: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          lifetime_purchased?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          lifetime_purchased?: number
          updated_at?: string
        }
        Relationships: never[]
      }
      token_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          balance_after: number
          type: 'purchase' | 'spend' | 'refund' | 'admin_grant'
          description: string | null
          stripe_payment_intent_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          balance_after: number
          type: 'purchase' | 'spend' | 'refund' | 'admin_grant'
          description?: string | null
          stripe_payment_intent_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: never
        Relationships: never[]
      }
      worlds: {
        Row: {
          id: string
          name: string
          slug: string
          status: 'active' | 'paused' | 'reset'
          era: string
          in_game_day: number
          in_game_year: number
          real_started_at: string
          last_tick_at: string | null
          next_vote_opens_at: string | null
          config: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          name?: string
          slug?: string
          status?: 'active' | 'paused' | 'reset'
          era?: string
          in_game_day?: number
          in_game_year?: number
          real_started_at?: string
          last_tick_at?: string | null
          next_vote_opens_at?: string | null
          config?: Json | null
          created_at?: string
        }
        Update: {
          status?: 'active' | 'paused' | 'reset'
          era?: string
          in_game_day?: number
          in_game_year?: number
          last_tick_at?: string | null
          next_vote_opens_at?: string | null
          config?: Json | null
        }
        Relationships: never[]
      }
      world_regions: {
        Row: {
          id: string
          world_id: string
          name: string
          slug: string
          biome: string
          description: string | null
          fertility_level: number
          water_access: number
          resource_richness: number
          position_x: number
          position_y: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          world_id: string
          name: string
          slug: string
          biome: string
          description?: string | null
          fertility_level?: number
          water_access?: number
          resource_richness?: number
          position_x?: number
          position_y?: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          fertility_level?: number
          water_access?: number
          resource_richness?: number
          metadata?: Json | null
        }
        Relationships: never[]
      }
      cultures: {
        Row: {
          id: string
          world_id: string
          name: string
          slug: string
          origin_region_id: string | null
          ambition_level: number
          cooperation_level: number
          aggression_level: number
          spiritual_tendency: number
          family_centrality: number
          work_ethic: number
          color_hex: string | null
          description: string | null
          population_estimate: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          world_id: string
          name: string
          slug: string
          origin_region_id?: string | null
          ambition_level?: number
          cooperation_level?: number
          aggression_level?: number
          spiritual_tendency?: number
          family_centrality?: number
          work_ethic?: number
          color_hex?: string | null
          description?: string | null
          population_estimate?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          ambition_level?: number
          cooperation_level?: number
          aggression_level?: number
          spiritual_tendency?: number
          family_centrality?: number
          work_ethic?: number
          population_estimate?: number
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: never[]
      }
      settlements: {
        Row: {
          id: string
          world_id: string
          region_id: string | null
          culture_id: string | null
          name: string
          settlement_type: 'camp' | 'village' | 'town' | 'city'
          population: number
          prosperity: number
          stability: number
          has_walls: boolean
          has_market: boolean
          has_temple: boolean
          position_x: number
          position_y: number
          status: 'active' | 'abandoned' | 'occupied' | 'destroyed'
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          world_id: string
          region_id?: string | null
          culture_id?: string | null
          name: string
          settlement_type?: 'camp' | 'village' | 'town' | 'city'
          population?: number
          prosperity?: number
          stability?: number
          has_walls?: boolean
          has_market?: boolean
          has_temple?: boolean
          position_x?: number
          position_y?: number
          status?: 'active' | 'abandoned' | 'occupied' | 'destroyed'
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          population?: number
          prosperity?: number
          stability?: number
          has_walls?: boolean
          has_market?: boolean
          has_temple?: boolean
          settlement_type?: 'camp' | 'village' | 'town' | 'city'
          status?: 'active' | 'abandoned' | 'occupied' | 'destroyed'
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: never[]
      }
      persons: {
        Row: {
          id: string
          world_id: string
          name: string
          age: number
          life_stage: 'infant' | 'child' | 'adolescent' | 'young_adult' | 'adult' | 'elder'
          sex: string
          birthplace_id: string | null
          residence_id: string | null
          household_id: string | null
          culture_id: string | null
          class_tier: 'destitute' | 'poor' | 'common' | 'skilled' | 'wealthy' | 'noble' | 'elite'
          occupation: string | null
          employment_status: 'employed' | 'apprenticing' | 'underemployed' | 'displaced' | 'unemployed' | 'unable'
          is_alive: boolean
          is_featured: boolean
          health_score: number
          wealth_score: number
          reputation_score: number
          happiness_score: number
          // Position for world viewer
          pos_x: number
          pos_y: number
          // Traits (stored inline for performance)
          trait_ambition: number
          trait_honesty: number
          trait_loyalty: number
          trait_aggression: number
          trait_curiosity: number
          trait_sociability: number
          trait_jealousy: number
          trait_generosity: number
          trait_spirituality: number
          trait_romance_drive: number
          trait_vindictiveness: number
          trait_greed: number
          trait_work_ethic: number
          // Needs
          need_hunger: number
          need_fatigue: number
          need_stress: number
          need_safety: number
          need_belonging: number
          need_intimacy: number
          need_hope: number
          // Goals
          current_goal: string | null
          current_action: string | null
          secrets: Json | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          world_id: string
          name: string
          age: number
          life_stage?: 'infant' | 'child' | 'adolescent' | 'young_adult' | 'adult' | 'elder'
          sex?: string
          birthplace_id?: string | null
          residence_id?: string | null
          household_id?: string | null
          culture_id?: string | null
          class_tier?: 'destitute' | 'poor' | 'common' | 'skilled' | 'wealthy' | 'noble' | 'elite'
          occupation?: string | null
          employment_status?: 'employed' | 'apprenticing' | 'underemployed' | 'displaced' | 'unemployed' | 'unable'
          is_alive?: boolean
          is_featured?: boolean
          health_score?: number
          wealth_score?: number
          reputation_score?: number
          happiness_score?: number
          pos_x?: number
          pos_y?: number
          trait_ambition?: number
          trait_honesty?: number
          trait_loyalty?: number
          trait_aggression?: number
          trait_curiosity?: number
          trait_sociability?: number
          trait_jealousy?: number
          trait_generosity?: number
          trait_spirituality?: number
          trait_romance_drive?: number
          trait_vindictiveness?: number
          trait_greed?: number
          trait_work_ethic?: number
          need_hunger?: number
          need_fatigue?: number
          need_stress?: number
          need_safety?: number
          need_belonging?: number
          need_intimacy?: number
          need_hope?: number
          current_goal?: string | null
          current_action?: string | null
          secrets?: Json | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          age?: number
          life_stage?: 'infant' | 'child' | 'adolescent' | 'young_adult' | 'adult' | 'elder'
          sex?: string
          birthplace_id?: string | null
          residence_id?: string | null
          household_id?: string | null
          culture_id?: string | null
          class_tier?: 'destitute' | 'poor' | 'common' | 'skilled' | 'wealthy' | 'noble' | 'elite'
          occupation?: string | null
          employment_status?: 'employed' | 'apprenticing' | 'underemployed' | 'displaced' | 'unemployed' | 'unable'
          is_alive?: boolean
          is_featured?: boolean
          health_score?: number
          wealth_score?: number
          reputation_score?: number
          happiness_score?: number
          pos_x?: number
          pos_y?: number
          trait_ambition?: number
          trait_honesty?: number
          trait_loyalty?: number
          trait_aggression?: number
          trait_curiosity?: number
          trait_sociability?: number
          trait_jealousy?: number
          trait_generosity?: number
          trait_spirituality?: number
          trait_romance_drive?: number
          trait_vindictiveness?: number
          trait_greed?: number
          trait_work_ethic?: number
          need_hunger?: number
          need_fatigue?: number
          need_stress?: number
          need_safety?: number
          need_belonging?: number
          need_intimacy?: number
          need_hope?: number
          current_goal?: string | null
          current_action?: string | null
          secrets?: Json | null
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: never[]
      }
      households: {
        Row: {
          id: string
          world_id: string
          settlement_id: string | null
          head_person_id: string | null
          name: string | null
          wealth_level: number
          member_count: number
          reputation: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          world_id: string
          settlement_id?: string | null
          head_person_id?: string | null
          name?: string | null
          wealth_level?: number
          member_count?: number
          reputation?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          head_person_id?: string | null
          wealth_level?: number
          member_count?: number
          reputation?: number
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: never[]
      }
      relationships: {
        Row: {
          id: string
          world_id: string
          person_a_id: string
          person_b_id: string
          relationship_type: string
          trust: number
          attraction: number
          resentment: number
          is_secret: boolean
          is_active: boolean
          started_day: number | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          world_id: string
          person_a_id: string
          person_b_id: string
          relationship_type: string
          trust?: number
          attraction?: number
          resentment?: number
          is_secret?: boolean
          is_active?: boolean
          started_day?: number | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          trust?: number
          attraction?: number
          resentment?: number
          is_secret?: boolean
          is_active?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: never[]
      }
      public_events: {
        Row: {
          id: string
          world_id: string
          event_type: string
          title: string
          description: string
          primary_person_id: string | null
          secondary_person_id: string | null
          settlement_id: string | null
          culture_id: string | null
          region_id: string | null
          significance_score: number
          is_milestone: boolean
          is_featured: boolean
          in_game_day: number
          in_game_year: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          world_id: string
          event_type: string
          title: string
          description: string
          primary_person_id?: string | null
          secondary_person_id?: string | null
          settlement_id?: string | null
          culture_id?: string | null
          region_id?: string | null
          significance_score?: number
          is_milestone?: boolean
          is_featured?: boolean
          in_game_day: number
          in_game_year: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          is_featured?: boolean
          significance_score?: number
          metadata?: Json | null
        }
        Relationships: never[]
      }
      world_votes: {
        Row: {
          id: string
          world_id: string
          cycle_number: number
          title: string
          description: string
          vote_category: string
          status: 'upcoming' | 'open' | 'closed' | 'resolved'
          opens_at: string | null
          closes_at: string | null
          resolved_at: string | null
          in_game_day_opens: number | null
          winning_option_id: string | null
          effect_applied: boolean
          total_votes_cast: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          world_id: string
          cycle_number: number
          title: string
          description: string
          vote_category: string
          status?: 'upcoming' | 'open' | 'closed' | 'resolved'
          opens_at?: string | null
          closes_at?: string | null
          in_game_day_opens?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          status?: 'upcoming' | 'open' | 'closed' | 'resolved'
          closes_at?: string | null
          resolved_at?: string | null
          winning_option_id?: string | null
          effect_applied?: boolean
          total_votes_cast?: number
          metadata?: Json | null
        }
        Relationships: never[]
      }
      vote_options: {
        Row: {
          id: string
          vote_id: string
          title: string
          description: string
          effect_summary: string | null
          votes_count: number
          token_votes_count: number
          effect_config: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          vote_id: string
          title: string
          description: string
          effect_summary?: string | null
          votes_count?: number
          token_votes_count?: number
          effect_config?: Json | null
          created_at?: string
        }
        Update: {
          votes_count?: number
          token_votes_count?: number
        }
        Relationships: never[]
      }
      vote_participation: {
        Row: {
          id: string
          vote_id: string
          user_id: string
          option_id: string
          token_amount: number
          voted_at: string
        }
        Insert: {
          id?: string
          vote_id: string
          user_id: string
          option_id: string
          token_amount?: number
          voted_at?: string
        }
        Update: never
        Relationships: never[]
      }
      follows: {
        Row: {
          id: string
          user_id: string
          follow_type: 'person' | 'household' | 'settlement' | 'culture' | 'bloodline'
          follow_target_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          follow_type: 'person' | 'household' | 'settlement' | 'culture' | 'bloodline'
          follow_target_id: string
          created_at?: string
        }
        Update: never
        Relationships: never[]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          is_read: boolean
          public_event_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          is_read?: boolean
          public_event_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          is_read?: boolean
        }
        Relationships: never[]
      }
      daily_recaps: {
        Row: {
          id: string
          world_id: string
          in_game_day: number
          in_game_year: number
          title: string | null
          summary: string | null
          ai_narrative: string | null
          headline_event: string | null
          drama_note: string | null
          weather_note: string | null
          is_published: boolean
          published_at: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          world_id: string
          in_game_day: number
          in_game_year: number
          title?: string | null
          summary?: string | null
          ai_narrative?: string | null
          headline_event?: string | null
          drama_note?: string | null
          weather_note?: string | null
          is_published?: boolean
          published_at?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          title?: string | null
          summary?: string | null
          ai_narrative?: string | null
          is_published?: boolean
          published_at?: string | null
        }
        Relationships: never[]
      }
      billing_events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          stripe_event_id: string | null
          stripe_customer_id: string | null
          amount_cents: number | null
          currency: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          stripe_event_id?: string | null
          stripe_customer_id?: string | null
          amount_cents?: number | null
          currency?: string
          metadata?: Json | null
          created_at?: string
        }
        Update: never
        Relationships: never[]
      }
      token_purchase_orders: {
        Row: {
          id: string
          user_id: string
          token_pack_id: string
          token_amount: number
          price_cents: number
          stripe_session_id: string | null
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token_pack_id: string
          token_amount: number
          price_cents: number
          stripe_session_id?: string | null
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          stripe_session_id?: string | null
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          completed_at?: string | null
        }
        Relationships: never[]
      }
      feature_flags: {
        Row: {
          id: string
          flag_key: string
          is_enabled: boolean
          rollout_percentage: number
          description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          flag_key: string
          is_enabled?: boolean
          rollout_percentage?: number
          description?: string | null
          updated_at?: string
        }
        Update: {
          is_enabled?: boolean
          rollout_percentage?: number
          description?: string | null
          updated_at?: string
        }
        Relationships: never[]
      }
      admin_configs: {
        Row: {
          id: string
          key: string
          value: Json | null
          description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value?: Json | null
          description?: string | null
          updated_at?: string
        }
        Update: {
          value?: Json | null
          description?: string | null
          updated_at?: string
        }
        Relationships: never[]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          old_value: Json | null
          new_value: Json | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          metadata?: Json | null
          created_at?: string
        }
        Update: never
        Relationships: never[]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_world_state: {
        Args: { p_world_slug: string }
        Returns: Json
      }
      credit_tokens: {
        Args: { p_user_id: string; p_amount: number; p_description: string }
        Returns: number
      }
      spend_tokens: {
        Args: { p_user_id: string; p_amount: number; p_description: string }
        Returns: boolean
      }
      increment_vote_count: {
        Args: { p_option_id: string; p_token_amount: number }
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
