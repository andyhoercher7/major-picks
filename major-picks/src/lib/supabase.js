import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Auth helpers ────────────────────────────────────────────
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  return supabase.auth.getSession()
}

// ─── Profile ─────────────────────────────────────────────────
export async function getProfile(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

export async function createProfile(userId, username, displayName, isAdmin = false) {
  return supabase.from('profiles').insert({
    id: userId,
    username,
    display_name: displayName,
    is_admin: isAdmin
  })
}

export async function getAllProfiles() {
  return supabase.from('profiles').select('*').order('display_name')
}

// ─── Tournaments ─────────────────────────────────────────────
export async function getTournaments() {
  return supabase.from('tournaments').select('*').order('season_order')
}

export async function getActiveTournament() {
  return supabase.from('tournaments').select('*').eq('status', 'active').single()
}

export async function updateTournament(id, updates) {
  return supabase.from('tournaments').update(updates).eq('id', id)
}

// ─── Draft Order ─────────────────────────────────────────────
export async function getDraftOrder(tournamentId) {
  return supabase
    .from('draft_orders')
    .select('*, profiles(display_name)')
    .eq('tournament_id', tournamentId)
    .order('pick_position')
}

export async function setDraftOrder(tournamentId, orderedUserIds) {
  const rows = orderedUserIds.map((userId, i) => ({
    tournament_id: tournamentId,
    pick_position: i + 1,
    user_id: userId
  }))
  await supabase.from('draft_orders').delete().eq('tournament_id', tournamentId)
  return supabase.from('draft_orders').insert(rows)
}

// ─── Picks ───────────────────────────────────────────────────
export async function getPicks(tournamentId) {
  return supabase
    .from('picks')
    .select('*, profiles(display_name, username)')
    .eq('tournament_id', tournamentId)
    .order('slot_number')
}

export async function upsertPick(pick) {
  return supabase.from('picks').upsert(pick, {
    onConflict: 'tournament_id,user_id,slot_number'
  })
}

export async function activateAlternate(tournamentId, userId, altNumber, withdrawnPlayerName) {
  // Mark the withdrawn player's slot
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('is_alternate', false)

  const slotToReplace = picks?.find(p => p.player_name === withdrawnPlayerName)
  if (!slotToReplace) return { error: 'Player not found in picks' }

  // Get the alternate
  const { data: alt } = await supabase
    .from('picks')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('alt_number', altNumber)
    .single()

  if (!alt?.player_name) return { error: 'Alternate not picked yet' }

  // Activate alternate — overwrite the withdrawn slot
  return supabase.from('picks').update({
    player_name: alt.player_name,
    is_activated: true,
    withdrawn_replaced: withdrawnPlayerName,
    updated_at: new Date().toISOString()
  }).eq('id', slotToReplace.id)
}

// ─── Tournament Field & Odds ──────────────────────────────────
export async function getField(tournamentId) {
  return supabase
    .from('tournament_field')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('odds_decimal', { ascending: true, nullsLast: true })
}

// Maps each tournament to its The Odds API sport key so odds refresh
// pulls the correct event instead of always defaulting to the PGA.
const ODDS_SPORT_KEYS = {
  pga2026: 'golf_pga_championship',
  usopen2026: 'golf_us_open',
  open2026: 'golf_the_open_championship',
  players2027: 'golf_players_championship',
  masters2027: 'golf_masters_tournament'
}

export async function refreshOdds(tournamentId) {
  const apiKey = process.env.REACT_APP_ODDS_API_KEY
  if (!apiKey || apiKey === 'YOUR_ODDS_API_KEY') {
    return { error: 'No Odds API key configured' }
  }

  const sportKey = ODDS_SPORT_KEYS[tournamentId] || 'golf_pga_championship'

  try {
    // The Odds API — outright winner odds for this tournament
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`
    )
    const data = await res.json()
    if (!data || data.error) return { error: data?.message || 'API error' }

    // Parse and upsert odds
    const updates = []
    data.forEach(event => {
      event.bookmakers?.[0]?.markets?.[0]?.outcomes?.forEach(outcome => {
        updates.push({
          tournament_id: tournamentId,
          player_name: outcome.name,
          odds: outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`,
          odds_decimal: outcome.price,
          updated_at: new Date().toISOString()
        })
      })
    })

    if (updates.length > 0) {
      await supabase.from('tournament_field').upsert(updates, {
        onConflict: 'tournament_id,player_name'
      })
    }

    await supabase.from('tournaments').update({
      odds_refreshed_at: new Date().toISOString()
    }).eq('id', tournamentId)

    return { data: updates }
  } catch (err) {
    return { error: err.message }
  }
}

// ─── Standings ───────────────────────────────────────────────
export async function getStandings() {
  return supabase
    .from('standings')
    .select('*, profiles(display_name, username)')
    .order('total_wins', { ascending: false })
}

export async function recordTournamentWinner(tournamentId, winnerPlayerName, pickerUserId) {
  // Update tournament
  await supabase.from('tournaments').update({
    status: 'complete',
    tournament_winner: winnerPlayerName,
    picker_winner_id: pickerUserId
  }).eq('id', tournamentId)

  // Increment picker's standings
  const { data: existing } = await supabase
    .from('standings')
    .select('total_wins')
    .eq('user_id', pickerUserId)
    .single()

  return supabase.from('standings').upsert({
    user_id: pickerUserId,
    total_wins: (existing?.total_wins || 0) + 1,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })
}

// ─── Draft Order Logic ────────────────────────────────────────
export function computeNextDraftOrder(currentOrder) {
  // Rule: 2nd→1st, 3rd→2nd, 1st→3rd
  return [currentOrder[1], currentOrder[2], currentOrder[0]]
}

export function buildSnakeDraftSlots(orderedUserIds, numPicks = 10, numAlts = 2) {
  // Generates the full snake slot list
  // Returns array of {slotNumber, userId, isAlternate, altNumber}
  const slots = []
  const total = numPicks + numAlts

  for (let round = 0; round < total; round++) {
    const order = round % 2 === 0 ? [...orderedUserIds] : [...orderedUserIds].reverse()
    order.forEach(userId => {
      const slotNum = slots.length + 1
      const isAlt = round >= numPicks
      slots.push({
        slot_number: slotNum,
        user_id: userId,
        is_alternate: isAlt,
        alt_number: isAlt ? round - numPicks + 1 : null
      })
    })
  }
  return slots
}

// ─── Invites ─────────────────────────────────────────────────
export async function getInvites() {
  return supabase.from('invites').select('*, profiles(display_name)').eq('status', 'pending')
}

export async function submitInvite(invitedName, invitedEmail, proposedById) {
  return supabase.from('invites').insert({
    invited_name: invitedName,
    invited_email: invitedEmail,
    proposed_by: proposedById,
    votes: { [proposedById]: true }
  })
}

export async function voteOnInvite(inviteId, userId, vote, allProfileIds) {
  const { data: invite } = await supabase.from('invites').select('votes').eq('id', inviteId).single()
  const updatedVotes = { ...invite.votes, [userId]: vote }

  const allVoted = allProfileIds.every(id => updatedVotes[id] !== undefined)
  const allApproved = allProfileIds.every(id => updatedVotes[id] === true)

  return supabase.from('invites').update({
    votes: updatedVotes,
    status: allVoted ? (allApproved ? 'approved' : 'rejected') : 'pending'
  }).eq('id', inviteId)
}
