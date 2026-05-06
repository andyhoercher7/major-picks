# Major Picks 🏆
### PGA Golf Major Draft App — Andy, Buck & Co 

---

## What this app does
- Snake draft board for 5 tournaments per year (PGA, US Open, The Open, Players, Masters)
- 10 picks + 2 alternates per person per tournament
- Injury withdrawal system — alternates activate automatically
- Live betting odds via The Odds API
- Real-time sync — all three of you see picks live as they happen
- Running all-time standings and tournament history
- Works on any phone or laptop — no app store download needed
- Add to home screen on iPhone/Android for a native app feel

---

## SETUP GUIDE (one-time, ~20 minutes)

### STEP 1 — Set up Supabase (free database)

1. Go to https://supabase.com and sign up / sign in
2. Click **"New Project"**
3. Name it `major-picks`, set a strong database password, pick the **East US** region
4. Wait ~2 minutes for it to provision
5. Go to **SQL Editor** → click **"New Query"**
6. Open the file `supabase/migrations/001_schema.sql` from this project
7. Paste the entire contents into the SQL Editor and click **"Run"**
8. Go to **Settings → API**
9. Copy your **Project URL** (looks like `https://abc123.supabase.co`)
10. Copy your **anon public** key (long string starting with `eyJ`)

### STEP 2 — Create user accounts in Supabase

1. In Supabase, go to **Authentication → Users → Add User**
2. Create three users:
   - Email: `andy@yourdomain.com`  Password: (choose something strong)
   - Email: `buck@yourdomain.com`  Password: (choose something strong)
   - Email: `co@yourdomain.com`    Password: (choose something strong)
3. After creating each user, you need to add their profile. Go to **SQL Editor** and run:

```sql
-- Replace the UUIDs with the actual user IDs shown in Authentication → Users
INSERT INTO public.profiles (id, username, display_name, is_admin) VALUES
('ANDY-UUID-HERE',  'andy', 'Andy', true),
('BUCK-UUID-HERE',  'buck', 'Buck', false),
('CO-UUID-HERE',    'co',   'Co',   false);

-- Also initialize their standings rows
INSERT INTO public.standings (user_id, total_wins) VALUES
('ANDY-UUID-HERE', 0),
('BUCK-UUID-HERE', 0),
('CO-UUID-HERE',   0);
```

4. Enable **Realtime** for the picks table:
   - Go to **Database → Replication**
   - Enable realtime for: `picks`, `tournament_field`, `tournaments`

### STEP 3 — Get The Odds API key (free)

1. Go to https://the-odds-api.com
2. Sign up for the **free tier** (500 requests/month — plenty for our use)
3. Copy your API key from the dashboard

### STEP 4 — Set up the project locally

```bash
# Clone or download this project folder, then:
cd major-picks
npm install

# Copy the environment template
cp .env.example .env.local

# Open .env.local and fill in your three values:
#   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
#   REACT_APP_SUPABASE_ANON_KEY=eyJ...
#   REACT_APP_ODDS_API_KEY=your-odds-key

# Test it locally
npm start
```

### STEP 5 — Deploy to Vercel

```bash
# Push to GitHub first
git init
git add .
git commit -m "Initial Major Picks setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/major-picks.git
git push -u origin main
```

Then in Vercel:
1. Go to https://vercel.com → **Add New Project**
2. Import your `major-picks` GitHub repo
3. Go to **Settings → Environment Variables** and add all three:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_ODDS_API_KEY`
4. Click **Deploy**
5. Your app is live at something like `major-picks.vercel.app`

### STEP 6 — Add to home screen

**iPhone (Safari):**
1. Open the app URL in Safari
2. Tap the Share button → "Add to Home Screen"
3. Tap "Add" — it installs like a native app

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the three-dot menu → "Add to Home Screen"
3. Tap "Add"

---

## HOW TO USE THE APP

### Before each tournament (Andy — Admin)

1. Log in as Andy
2. Go to **Profile** tab
3. If it's the first tournament of the season: tap **"Randomize Order"** to set the initial draft order
4. One week before the tournament, go to **Profile → Admin Tools → Report Withdrawal** won't be needed yet — but the draft opens automatically
5. Tap **↻ Refresh** on the draft screen to pull the latest odds from The Odds API

### During the draft

- Each person logs in and taps their slot when it's their turn
- Players go off the board once picked — no duplicates
- The green dot shows whose pick it is
- After all 10 picks are done, each person picks their 2 alternates

### During the tournament

- If a player withdraws, Andy goes to **Profile → Admin Tools → Report Withdrawal**
- Type the withdrawn player's name exactly as it appears in picks
- Their alternate activates automatically

### After the tournament

1. Andy goes to **Profile → Admin Tools → Record Tournament Winner**
2. Enter the winning player's name and select which picker had them
3. The standings update automatically
4. Tap **"Advance to Next Tournament"** — this opens the next draft and rotates the order

### Draft order rotation
- Tournament 1: Random (e.g., Andy → Buck → Co)
- Tournament 2: 2nd→1st, 3rd→2nd, 1st→3rd (Buck → Co → Andy)
- Tournament 3: Co → Andy → Buck
- Tournament 4: Andy → Buck → Co (back to start)

---

## FILE STRUCTURE

```
major-picks/
├── public/
│   ├── index.html          # PWA-ready HTML
│   └── manifest.json       # Add to home screen config
├── src/
│   ├── App.js              # Root app + auth
│   ├── index.js            # Entry point
│   ├── index.css           # All styles + tournament themes
│   ├── lib/
│   │   ├── supabase.js     # All database functions
│   │   └── themes.js       # Tournament color themes
│   └── components/
│       ├── LoginScreen.js
│       ├── DraftScreen.js
│       ├── PlayerPickerModal.js
│       ├── StandingsScreen.js
│       ├── ProfileScreen.js
│       └── Toast.js
├── supabase/
│   └── migrations/
│       └── 001_schema.sql  # Run this in Supabase SQL Editor
├── .env.example            # Copy to .env.local and fill in
├── vercel.json             # Vercel deployment config
└── package.json
```

---

## ADDING A NEW SEASON

At the start of 2027, run this SQL in Supabase to add the next season's tournaments:

```sql
INSERT INTO public.tournaments (id, name, short_name, venue, dates, theme, status, year, season_order, draft_open) VALUES
('players2027', 'THE PLAYERS Championship', 'Players', 'TPC Sawgrass',      'Mar 2027', 'theme-players', 'active',   2027, 1, true),
('masters2027', 'The Masters',              'Masters', 'Augusta National',   'Apr 2027', 'theme-masters', 'upcoming', 2027, 2, false),
('pga2027',     'PGA Championship',         'PGA',     'TBD',                'May 2027', 'theme-pga',     'upcoming', 2027, 3, false),
('usopen2027',  'U.S. Open',                'US Open', 'TBD',                'Jun 2027', 'theme-us-open', 'upcoming', 2027, 4, false),
('open2027',    'The Open Championship',    'Open',    'TBD',                'Jul 2027', 'theme-open',    'upcoming', 2027, 5, false);
```

Then add the new season's field for each tournament via the tournament_field table.
