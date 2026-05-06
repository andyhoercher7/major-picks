-- ============================================================
-- MAJOR PICKS — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable Row Level Security
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE public.tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  venue TEXT NOT NULL,
  dates TEXT NOT NULL,
  theme TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','complete')),
  year INTEGER NOT NULL,
  tournament_winner TEXT,
  picker_winner_id UUID REFERENCES public.profiles(id),
  draft_open BOOLEAN DEFAULT FALSE,
  odds_refreshed_at TIMESTAMPTZ,
  season_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft order per tournament
CREATE TABLE public.draft_orders (
  id SERIAL PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id),
  pick_position INTEGER NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  UNIQUE(tournament_id, pick_position)
);

-- Draft picks (10 picks + 2 alternates per user per tournament)
CREATE TABLE public.picks (
  id SERIAL PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id),
  user_id UUID REFERENCES public.profiles(id),
  slot_number INTEGER NOT NULL,        -- 1-12 (1-10 picks, 11-12 alts)
  is_alternate BOOLEAN DEFAULT FALSE,
  alt_number INTEGER,                  -- 1 or 2 if alternate
  player_name TEXT,
  is_activated BOOLEAN DEFAULT FALSE,  -- true if alt was activated due to withdrawal
  withdrawn_replaced TEXT,             -- name of player who withdrew
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id, slot_number)
);

-- Tournament field + odds (refreshed weekly)
CREATE TABLE public.tournament_field (
  id SERIAL PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id),
  player_name TEXT NOT NULL,
  country TEXT,
  odds TEXT,
  odds_decimal NUMERIC,
  is_withdrawn BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, player_name)
);

-- Season standings cache
CREATE TABLE public.standings (
  user_id UUID REFERENCES public.profiles(id) PRIMARY KEY,
  total_wins INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invite votes
CREATE TABLE public.invites (
  id SERIAL PRIMARY KEY,
  invited_name TEXT NOT NULL,
  invited_email TEXT,
  proposed_by UUID REFERENCES public.profiles(id),
  votes JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_field ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read everything
CREATE POLICY "Authenticated read all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read tournaments" ON public.tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read draft_orders" ON public.draft_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read picks" ON public.picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read field" ON public.tournament_field FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read standings" ON public.standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read invites" ON public.invites FOR SELECT TO authenticated USING (true);

-- Users can only insert/update their own picks
CREATE POLICY "Own picks insert" ON public.picks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own picks update" ON public.picks FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Profile insert on signup
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Admins can update tournaments, field, standings
CREATE POLICY "Admin update tournaments" ON public.tournaments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admin update field" ON public.tournament_field FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admin update standings" ON public.standings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admin insert draft_orders" ON public.draft_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Invites: authenticated users can insert and update
CREATE POLICY "Insert invites" ON public.invites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update invites" ON public.invites FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- SEED DATA — Tournaments 2026
-- ============================================================

INSERT INTO public.tournaments (id, name, short_name, venue, dates, theme, status, year, season_order, draft_open) VALUES
('pga2026',     'PGA Championship',        'PGA',     'Quail Hollow Club',   'May 15–18, 2026',   'theme-pga',      'active',   2026, 1, true),
('usopen2026',  'U.S. Open',               'US Open', 'Oakmont Country Club','Jun 12–15, 2026',   'theme-us-open',  'upcoming', 2026, 2, false),
('open2026',    'The Open Championship',   'Open',    'Royal Portrush',      'Jul 17–20, 2026',   'theme-open',     'upcoming', 2026, 3, false),
('players2027', 'THE PLAYERS Championship','Players', 'TPC Sawgrass',        'Mar 12–15, 2027',   'theme-players',  'upcoming', 2027, 4, false),
('masters2027', 'The Masters',             'Masters', 'Augusta National',    'Apr 9–12, 2027',    'theme-masters',  'upcoming', 2027, 5, false);

-- ============================================================
-- SEED DATA — PGA Championship 2026 Field
-- ============================================================

INSERT INTO public.tournament_field (tournament_id, player_name, country, odds) VALUES
('pga2026','Scottie Scheffler','USA','+350'),
('pga2026','Rory McIlroy','NIR','+600'),
('pga2026','Xander Schauffele','USA','+800'),
('pga2026','Collin Morikawa','USA','+1000'),
('pga2026','Ludvig Åberg','SWE','+1100'),
('pga2026','Viktor Hovland','NOR','+1200'),
('pga2026','Jon Rahm','ESP','+1400'),
('pga2026','Tommy Fleetwood','ENG','+1600'),
('pga2026','Patrick Cantlay','USA','+1800'),
('pga2026','Bryson DeChambeau','USA','+2000'),
('pga2026','Brooks Koepka','USA','+2200'),
('pga2026','Dustin Johnson','USA','+2500'),
('pga2026','Shane Lowry','IRL','+2500'),
('pga2026','Justin Thomas','USA','+2800'),
('pga2026','Max Homa','USA','+2800'),
('pga2026','Tony Finau','USA','+3000'),
('pga2026','Hideki Matsuyama','JPN','+3000'),
('pga2026','Matt Fitzpatrick','ENG','+3000'),
('pga2026','Jordan Spieth','USA','+3500'),
('pga2026','Cameron Smith','AUS','+3500'),
('pga2026','Cameron Young','USA','+4000'),
('pga2026','Adam Scott','AUS','+4000'),
('pga2026','Russell Henley','USA','+4500'),
('pga2026','Wyndham Clark','USA','+4500'),
('pga2026','Harris English','USA','+5000'),
('pga2026','Si Woo Kim','KOR','+5000'),
('pga2026','Sahith Theegala','USA','+5500'),
('pga2026','Tom Kim','KOR','+5500'),
('pga2026','Sungjae Im','KOR','+6000'),
('pga2026','Keegan Bradley','USA','+6000'),
('pga2026','Jason Day','AUS','+6500'),
('pga2026','Ryan Fox','NZL','+7000'),
('pga2026','Sepp Straka','AUT','+7000'),
('pga2026','Nick Taylor','CAN','+7500'),
('pga2026','Denny McCarthy','USA','+8000'),
('pga2026','Adam Hadwin','CAN','+8000'),
('pga2026','Billy Horschel','USA','+9000'),
('pga2026','Thomas Detry','BEL','+9000'),
('pga2026','Matthieu Pavon','FRA','+10000'),
('pga2026','Kurt Kitayama','USA','+10000');

-- ============================================================
-- REALTIME — enable for live draft sync
-- ============================================================
-- Run in Supabase Dashboard → Database → Replication
-- Enable realtime for: picks, tournament_field, tournaments
