-- ============================================================
-- MAJOR PICKS — Automatic tournament field population
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Instead of hand-loading each major's field, this pulls the real
-- field directly from ESPN's public golf feed, server-side, and keeps
-- the active tournament's field synced automatically once per day.
--
-- This is what fixed "The Open has no players to pick": the field was
-- never loaded. With this in place, whenever a tournament becomes the
-- active event on ESPN, its field fills in on its own.
-- ============================================================

-- 1) Outbound HTTP from the database (runs on Supabase's servers).
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2) Sync one tournament's draftable field from ESPN.
--    Additive-only: inserts players not already present, never deletes,
--    so it is safe to run repeatedly (including mid-tournament, where
--    ESPN's competitor list shrinks after the cut). Returns field size.
CREATE OR REPLACE FUNCTION public.sync_tournament_field(p_tournament_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pattern    text;
  v_event      jsonb;
  v_field_size int;
  v_count      int;
BEGIN
  -- Map our tournament id to the ESPN scoreboard event-name pattern.
  v_pattern := CASE p_tournament_id
    WHEN 'pga2026'     THEN 'PGA Championship'
    WHEN 'usopen2026'  THEN 'U.S. Open'
    WHEN 'open2026'    THEN 'The Open'
    WHEN 'players2027' THEN 'THE PLAYERS'
    WHEN 'masters2027' THEN 'Masters'
    ELSE NULL
  END;
  IF v_pattern IS NULL THEN
    RETURN 0;
  END IF;

  -- Find the matching event in ESPN's current golf scoreboard.
  SELECT e INTO v_event
  FROM (
    SELECT jsonb_array_elements(
      (extensions.http_get('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard')::extensions.http_response).content::jsonb -> 'events'
    ) AS e
  ) evs
  WHERE evs.e ->> 'name' ILIKE '%' || v_pattern || '%'
  LIMIT 1;

  -- Tournament not currently featured on ESPN: leave existing field as-is.
  IF v_event IS NULL THEN
    RETURN (SELECT COUNT(*) FROM public.tournament_field WHERE tournament_id = p_tournament_id);
  END IF;

  v_field_size := jsonb_array_length(v_event -> 'competitions' -> 0 -> 'competitors');
  IF v_field_size IS NULL OR v_field_size < 30 THEN
    RETURN (SELECT COUNT(*) FROM public.tournament_field WHERE tournament_id = p_tournament_id);
  END IF;

  -- Additive upsert of the field (never deletes).
  INSERT INTO public.tournament_field (tournament_id, player_name, country)
  SELECT DISTINCT
    p_tournament_id,
    comp -> 'athlete' ->> 'fullName',
    upper(substring(comp -> 'athlete' -> 'flag' ->> 'href' from 'countries/500/([a-z]+)\.png'))
  FROM jsonb_array_elements(v_event -> 'competitions' -> 0 -> 'competitors') AS comp
  WHERE comp -> 'athlete' ->> 'fullName' IS NOT NULL
  ON CONFLICT (tournament_id, player_name) DO NOTHING;

  UPDATE public.tournaments SET odds_refreshed_at = NOW() WHERE id = p_tournament_id;

  SELECT COUNT(*) INTO v_count FROM public.tournament_field WHERE tournament_id = p_tournament_id;
  RETURN v_count;
END;
$$;

-- 3) Schedule a daily sync of whichever tournament is currently active.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync_active_tournament_field';

SELECT cron.schedule(
  'sync_active_tournament_field',
  '0 6 * * *',
  $$SELECT public.sync_tournament_field(id) FROM public.tournaments WHERE status = 'active'$$
);

-- One-time backfill of the currently active tournament (e.g. The Open).
SELECT public.sync_tournament_field(id) FROM public.tournaments WHERE status = 'active';
