-- ============================================================
-- First Valley — Direct SQL Seed
-- Run after combined_run_once.sql
-- ============================================================

do $$
declare
  v_world_id        uuid;
  v_river_clan_id   uuid;
  v_stone_clan_id   uuid;
  v_tide_clan_id    uuid;
  v_riverwatch_id   uuid;
  v_stonecrag_id    uuid;
  v_tidehaven_id    uuid;
begin
  -- Skip if world already exists
  select id into v_world_id from worlds where slug = 'first-valley';
  if v_world_id is not null then
    raise notice 'World already exists, skipping seed.';
    return;
  end if;

  -- 1. World
  insert into worlds (slug, name, era, in_game_day, in_game_year, config)
  values (
    'first-valley', 'First Valley', 'Dawn Age', 1, 1,
    '{"paused":false,"world_time":8,"weather":{"type":"clear","intensity":0.3},"season":{"name":"spring","progress":0.1}}'
  )
  returning id into v_world_id;

  -- 2. Cultures
  insert into cultures (world_id, name, slug, color_hex, population_estimate,
    aggression_level, cooperation_level, spiritual_tendency)
  values (v_world_id, 'River Clan', 'river-clan', '#4a90d9', 45, 20, 80, 55)
  returning id into v_river_clan_id;

  insert into cultures (world_id, name, slug, color_hex, population_estimate,
    aggression_level, cooperation_level, spiritual_tendency)
  values (v_world_id, 'Stone Clan', 'stone-clan', '#8b7355', 38, 50, 55, 40)
  returning id into v_stone_clan_id;

  insert into cultures (world_id, name, slug, color_hex, population_estimate,
    aggression_level, cooperation_level, spiritual_tendency)
  values (v_world_id, 'Tide Clan', 'tide-clan', '#2ec4b6', 32, 30, 65, 70)
  returning id into v_tide_clan_id;

  -- 3. Settlements
  insert into settlements (world_id, name, settlement_type, population,
    prosperity, stability, position_x, position_y, culture_id)
  values (v_world_id, 'Riverwatch', 'village', 45, 60, 70, 420, 310, v_river_clan_id)
  returning id into v_riverwatch_id;

  insert into settlements (world_id, name, settlement_type, population,
    prosperity, stability, position_x, position_y, culture_id)
  values (v_world_id, 'Stonecrag', 'camp', 38, 45, 65, 360, 130, v_stone_clan_id)
  returning id into v_stonecrag_id;

  insert into settlements (world_id, name, settlement_type, population,
    prosperity, stability, position_x, position_y, culture_id)
  values (v_world_id, 'Tidehaven', 'camp', 32, 50, 60, 430, 490, v_tide_clan_id)
  returning id into v_tidehaven_id;

  -- 4. Households (one per settlement)
  insert into households (world_id, settlement_id, name, wealth_level, member_count)
  values
    (v_world_id, v_riverwatch_id, 'Riverwatch Household', 4, 5),
    (v_world_id, v_stonecrag_id,  'Stonecrag Household',  3, 5),
    (v_world_id, v_tidehaven_id,  'Tidehaven Household',  4, 5);

  -- 5. Persons (15 starting persons)
  insert into persons (world_id, name, age, life_stage, occupation, employment_status,
    is_alive, is_featured, health_score, wealth_score, happiness_score,
    culture_id, residence_id,
    trait_ambition, trait_honesty, trait_aggression, trait_sociability,
    need_hunger, need_stress, need_hope)
  values
    -- River Clan
    (v_world_id,'Aelindra',34,'adult',    'Elder',    'employed',  true,true, 72,55,68, v_river_clan_id,v_riverwatch_id, 40,80,15,85, 20,30,75),
    (v_world_id,'Brath',   22,'young_adult','Hunter', 'employed',  true,false,88,30,72, v_river_clan_id,v_riverwatch_id, 60,65,35,55, 35,20,80),
    (v_world_id,'Caelith',  8,'child',    null,       'unemployed',true,false,95,10,90, v_river_clan_id,v_riverwatch_id, 30,90,10,75, 45, 5,95),
    (v_world_id,'Darana',  52,'elder',    'Healer',   'employed',  true,true, 60,65,74, v_river_clan_id,v_riverwatch_id, 35,88,10,90, 25,40,70),
    (v_world_id,'Evar',    28,'adult',    'Fisher',   'employed',  true,false,82,40,66, v_river_clan_id,v_riverwatch_id, 45,72,22,60, 30,25,70),
    -- Stone Clan
    (v_world_id,'Gorvath', 41,'adult',    'Chieftain','employed',  true,true, 78,70,62, v_stone_clan_id,v_stonecrag_id,  80,55,65,50, 20,50,60),
    (v_world_id,'Hilda',   25,'young_adult','Scout',  'employed',  true,false,91,25,70, v_stone_clan_id,v_stonecrag_id,  70,60,55,45, 40,30,72),
    (v_world_id,'Ironmar', 19,'young_adult','Guard',  'employed',  true,false,85,20,65, v_stone_clan_id,v_stonecrag_id,  55,50,72,40, 50,35,65),
    (v_world_id,'Jorra',   37,'adult',    'Crafter',  'employed',  true,false,74,50,68, v_stone_clan_id,v_stonecrag_id,  48,75,30,58, 28,28,74),
    (v_world_id,'Krath',   14,'child',    null,       'unemployed',true,false,93,15,82, v_stone_clan_id,v_stonecrag_id,  42,70,38,55, 55,10,88),
    -- Tide Clan
    (v_world_id,'Lirath',  30,'adult',    'Trader',   'employed',  true,true, 80,60,76, v_tide_clan_id, v_tidehaven_id,  65,68,25,82, 22,22,80),
    (v_world_id,'Maren',   44,'adult',    'Navigator','employed',  true,false,71,55,70, v_tide_clan_id, v_tidehaven_id,  58,76,20,70, 30,32,72),
    (v_world_id,'Noel',    17,'young_adult','Apprentice','employed',true,false,90,18,78, v_tide_clan_id, v_tidehaven_id,  72,80,18,78, 42,15,85),
    (v_world_id,'Orvine',  58,'elder',    'Shaman',   'employed',  true,true, 58,62,72, v_tide_clan_id, v_tidehaven_id,  30,90,12,85, 18,38,78),
    (v_world_id,'Petra',   26,'young_adult','Fisher',  'employed', true,false,85,32,73, v_tide_clan_id, v_tidehaven_id,  50,74,22,68, 33,20,76);

  -- 6. Founding event
  insert into public_events (world_id, event_type, title, description,
    significance_score, is_milestone, is_featured, in_game_day, in_game_year, metadata)
  values (
    v_world_id,
    'ERA_TRANSITION',
    'First Valley stirs to life',
    'In the dawn of a new age, three clans make their home in First Valley. The river flows, the stones endure, and the tides call. History begins.',
    100, true, true, 1, 1,
    '{"founding":true}'
  );

  raise notice 'Seed complete: world_id=%, 3 cultures, 3 settlements, 15 persons', v_world_id;
end $$;
