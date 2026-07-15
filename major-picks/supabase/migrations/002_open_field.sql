-- ============================================================
-- MAJOR PICKS — The Open Championship 2026 Field
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- (Safe to re-run — uses ON CONFLICT DO NOTHING)
--
-- Fixes: the draft picker showed "No players found" for The Open
-- because tournament_field only had rows seeded for pga2026.
-- Also corrects the 2026 Open venue (Royal Birkdale, not Portrush).
-- ============================================================

-- Correct the venue for existing installs (2026 Open is at Royal Birkdale).
UPDATE public.tournaments SET venue = 'Royal Birkdale'
  WHERE id = 'open2026' AND venue = 'Royal Portrush';

INSERT INTO public.tournament_field (tournament_id, player_name, country, odds) VALUES
('open2026','Rory McIlroy','NIR','+700'),
('open2026','Scottie Scheffler','USA','+750'),
('open2026','Xander Schauffele','USA','+1200'),
('open2026','Jon Rahm','ESP','+1400'),
('open2026','Ludvig Åberg','SWE','+1600'),
('open2026','Tommy Fleetwood','ENG','+1800'),
('open2026','Viktor Hovland','NOR','+1800'),
('open2026','Collin Morikawa','USA','+2000'),
('open2026','Shane Lowry','IRL','+2200'),
('open2026','Tyrrell Hatton','ENG','+2500'),
('open2026','Bryson DeChambeau','USA','+2500'),
('open2026','Patrick Cantlay','USA','+2800'),
('open2026','Justin Thomas','USA','+2800'),
('open2026','Robert MacIntyre','SCO','+3000'),
('open2026','Matt Fitzpatrick','ENG','+3000'),
('open2026','Brooks Koepka','USA','+3300'),
('open2026','Hideki Matsuyama','JPN','+3300'),
('open2026','Cameron Smith','AUS','+3500'),
('open2026','Jordan Spieth','USA','+3500'),
('open2026','Sepp Straka','AUT','+4000'),
('open2026','Russell Henley','USA','+4000'),
('open2026','Cameron Young','USA','+4500'),
('open2026','Wyndham Clark','USA','+4500'),
('open2026','Justin Rose','ENG','+5000'),
('open2026','Sungjae Im','KOR','+5000'),
('open2026','Adam Scott','AUS','+5500'),
('open2026','Sahith Theegala','USA','+5500'),
('open2026','Aaron Rai','ENG','+6000'),
('open2026','Corey Conners','CAN','+6000'),
('open2026','Keegan Bradley','USA','+6500'),
('open2026','Tom Kim','KOR','+6500'),
('open2026','Harris English','USA','+7000'),
('open2026','Ryan Fox','NZL','+7000'),
('open2026','Si Woo Kim','KOR','+7500'),
('open2026','Jason Day','AUS','+7500'),
('open2026','Thomas Detry','BEL','+8000'),
('open2026','Nick Taylor','CAN','+8000'),
('open2026','Billy Horschel','USA','+9000'),
('open2026','Matthieu Pavon','FRA','+9000'),
('open2026','Sam Burns','USA','+10000'),
('open2026','Min Woo Lee','AUS','+10000'),
('open2026','Nicolai Højgaard','DEN','+11000'),
('open2026','Kurt Kitayama','USA','+12000')
ON CONFLICT (tournament_id, player_name) DO NOTHING;
