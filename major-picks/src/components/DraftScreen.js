import React, { useState, useEffect, useCallback } from 'react'
import {
  supabase, getPicks, getField, getDraftOrder,
  upsertPick, refreshOdds, buildSnakeDraftSlots
} from '../lib/supabase'
import PlayerPickerModal from './PlayerPickerModal'

export default function DraftScreen({ profile, tournament, showToast, onTournamentUpdate }) {
  const [picks, setPicks] = useState([])
  const [field, setField] = useState([])
  const [draftOrder, setDraftOrder] = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!tournament) return
    setLoading(true)
    const [{ data: p }, { data: f }, { data: d }, { data: profs }] = await Promise.all([
      getPicks(tournament.id),
      getField(tournament.id),
      getDraftOrder(tournament.id),
      supabase.from('profiles').select('*').order('display_name')
    ])
    setPicks(p || [])
    setField(f || [])
    setDraftOrder(d || [])
    setAllProfiles(profs || [])
    setLoading(false)
  }, [tournament])

  useEffect(() => { load() }, [load])

  // Realtime subscription — sync picks from other users live
  useEffect(() => {
    if (!tournament) return
    const channel = supabase
      .channel(`picks:${tournament.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'picks',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => load())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tournament_field',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tournament, load])

  // Build the full snake slot list from draft order
  const snakeSlots = React.useMemo(() => {
    if (!draftOrder.length || !allProfiles.length) return []
    const orderedIds = draftOrder.map(d => d.user_id)
    return buildSnakeDraftSlots(orderedIds, 10, 2)
  }, [draftOrder, allProfiles])

  // Merge picks data into slots
  const mergedSlots = React.useMemo(() => {
    return snakeSlots.map(slot => {
      const pick = picks.find(p =>
        p.user_id === slot.user_id &&
        p.slot_number === slot.slot_number
      )
      const prof = allProfiles.find(p => p.id === slot.user_id)
      return {
        ...slot,
        displayName: prof?.display_name || '?',
        username: prof?.username || '',
        player_name: pick?.player_name || null,
        is_activated: pick?.is_activated || false,
        withdrawn_replaced: pick?.withdrawn_replaced || null,
        pickId: pick?.id || null
      }
    })
  }, [snakeSlots, picks, allProfiles])

  const takenPlayers = new Set(picks.map(p => p.player_name).filter(Boolean))

  // Determine current pick slot (first empty non-alternate)
  const currentPickIdx = mergedSlots.findIndex(s => !s.is_alternate && !s.player_name)
  const currentAltIdx = mergedSlots.findIndex(s => s.is_alternate && !s.player_name)

  // Is it this user's turn?
  const myTurnPick = currentPickIdx !== -1 && mergedSlots[currentPickIdx]?.user_id === profile?.id
  const myTurnAlt = currentPickIdx === -1 && currentAltIdx !== -1 && mergedSlots[currentAltIdx]?.user_id === profile?.id

  async function handleSelectPlayer(playerName) {
    if (!activeSlot || !profile || !tournament) return
    const { error } = await upsertPick({
      tournament_id: tournament.id,
      user_id: profile.id,
      slot_number: activeSlot.slot_number,
      is_alternate: activeSlot.is_alternate,
      alt_number: activeSlot.alt_number,
      player_name: playerName,
      updated_at: new Date().toISOString()
    })
    if (error) { showToast('Error saving pick: ' + error.message); return }
    setModalOpen(false)
    showToast(playerName + ' drafted!')
    load()
  }

  async function handleRefreshOdds() {
    setRefreshing(true)
    const { error } = await refreshOdds(tournament.id)
    setRefreshing(false)
    if (error) {
      showToast(error === 'No Odds API key configured'
        ? 'Add your Odds API key to .env.local to enable live odds'
        : 'Odds refresh failed: ' + error)
    } else {
      showToast('Odds updated!')
      load()
    }
  }

  function openPicker(slot) {
    if (slot.user_id !== profile?.id) return
    setActiveSlot(slot)
    setModalOpen(true)
  }

  if (!tournament) {
    return (
      <div style={{ padding: '2rem 1.5rem', color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem', lineHeight: 1.7 }}>
        <div className="t-header">
          <div className="t-badge">2026 Season</div>
          <div className="t-title">No Active Tournament</div>
          <div className="t-subtitle">Check back closer to the next major</div>
        </div>
        <div style={{ padding: '1.5rem' }}>
          The next draft will open approximately one week before each tournament.
        </div>
      </div>
    )
  }

  const oddsRefreshed = tournament.odds_refreshed_at
    ? new Date(tournament.odds_refreshed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Not yet refreshed'

  return (
    <>
      {/* Header */}
      <div className="t-header">
        <div className="t-badge">{tournament.year} Season</div>
        <div className="t-title">{tournament.name}</div>
        <div className="t-subtitle">{tournament.venue} · {tournament.dates}</div>
      </div>

      {/* Odds bar */}
      <div className="odds-bar">
        <div className="odds-bar-text">Odds last updated: {oddsRefreshed}</div>
        <button className="odds-refresh-btn" onClick={handleRefreshOdds} disabled={refreshing}>
          {refreshing ? '...' : '↻ Refresh'}
        </button>
      </div>

      {/* Draft status */}
      <DraftStatusBar
        mergedSlots={mergedSlots}
        currentPickIdx={currentPickIdx}
        currentAltIdx={currentAltIdx}
        myTurnPick={myTurnPick}
        myTurnAlt={myTurnAlt}
        allProfiles={allProfiles}
        profile={profile}
      />

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /></div>
      ) : draftOrder.length === 0 ? (
        <div style={{ padding: '2rem 1.5rem', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', textAlign: 'center' }}>
          Draft order not set yet. Andy can set it from the Profile tab.
        </div>
      ) : (
        <>
          {/* Main picks */}
          <PickRounds
            mergedSlots={mergedSlots.filter(s => !s.is_alternate)}
            field={field}
            profile={profile}
            currentPickIdx={currentPickIdx}
            onPickSlot={openPicker}
          />

          {/* Alternates */}
          <div className="section-label" style={{ paddingTop: '0.75rem' }}>Alternates (injury replacements)</div>
          <AltSlots
            mergedSlots={mergedSlots.filter(s => s.is_alternate)}
            field={field}
            profile={profile}
            mainPicksDone={currentPickIdx === -1}
            currentAltIdx={currentAltIdx}
            globalOffset={mergedSlots.filter(s => !s.is_alternate).length}
            onPickSlot={openPicker}
          />

          {/* Withdrawal log */}
          <WithdrawalLog picks={picks} />
        </>
      )}

      <PlayerPickerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelectPlayer}
        field={field}
        takenPlayers={takenPlayers}
        slot={activeSlot}
        profile={profile}
        tournament={tournament}
      />
    </>
  )
}

// ── Draft Status Bar ──────────────────────────────────────────
function DraftStatusBar({ mergedSlots, currentPickIdx, currentAltIdx, myTurnPick, myTurnAlt, allProfiles, profile }) {
  const allDone = currentPickIdx === -1 && currentAltIdx === -1

  let cls = 'draft-bar'
  let dot = null
  let text = null

  if (allDone) {
    cls += ' complete'
    dot = <div className="draft-bar-dot" style={{ background: 'var(--t-secondary)', animation: 'none' }} />
    text = <div className="draft-bar-text"><strong style={{ color: 'var(--t-secondary)' }}>Draft complete!</strong> All picks and alternates locked in.</div>
  } else if (myTurnPick || myTurnAlt) {
    cls += ' myturn'
    dot = <div className="draft-bar-dot" />
    text = <div className="draft-bar-text"><strong>Your turn to pick!</strong>{myTurnAlt ? ' Choose your alternate.' : ' You\'re on the clock.'}</div>
  } else {
    const idx = currentPickIdx !== -1 ? currentPickIdx : currentAltIdx
    const waitingSlot = mergedSlots[idx]
    const waitingName = waitingSlot?.displayName || '?'
    dot = <div className="draft-bar-dot" style={{ background: '#4caf50' }} />
    text = <div className="draft-bar-text">Waiting on <strong style={{ color: '#81c784' }}>{waitingName}</strong>{currentAltIdx !== -1 && currentPickIdx === -1 ? ' · Alternate pick' : ''}</div>
  }

  return <div className={cls}>{dot}{text}</div>
}

// ── Pick Rounds ───────────────────────────────────────────────
function PickRounds({ mergedSlots, field, profile, currentPickIdx, onPickSlot }) {
  const rounds = []
  for (let i = 0; i < mergedSlots.length; i += 3) {
    rounds.push(mergedSlots.slice(i, i + 3))
  }
  let globalIdx = 0
  return (
    <>
      <div className="section-label">Draft Board — Snake Order</div>
      {rounds.map((round, ri) => (
        <React.Fragment key={ri}>
          <div className="round-label">Round {ri + 1}</div>
          {round.map(slot => {
            const idx = globalIdx++
            const isCurrent = idx === currentPickIdx
            const isClickable = isCurrent && slot.user_id === profile?.id && !slot.player_name
            const playerData = field.find(f => f.player_name === slot.player_name)
            return (
              <PickSlot
                key={slot.slot_number}
                slot={slot}
                isCurrent={isCurrent}
                isClickable={isClickable}
                odds={playerData?.odds}
                isMe={slot.user_id === profile?.id}
                onClick={() => isClickable && onPickSlot(slot)}
              />
            )
          })}
        </React.Fragment>
      ))}
    </>
  )
}

// ── Alt Slots ─────────────────────────────────────────────────
function AltSlots({ mergedSlots, field, profile, mainPicksDone, currentAltIdx, globalOffset, onPickSlot }) {
  return (
    <>
      {mergedSlots.map((slot, i) => {
        const globalIdx = globalOffset + i
        const isCurrent = globalIdx === currentAltIdx
        const isClickable = mainPicksDone && isCurrent && slot.user_id === profile?.id && !slot.player_name
        const playerData = field.find(f => f.player_name === slot.player_name)
        return (
          <PickSlot
            key={slot.slot_number}
            slot={slot}
            isCurrent={isCurrent}
            isClickable={isClickable}
            odds={playerData?.odds}
            isMe={slot.user_id === profile?.id}
            isAlt
            onClick={() => isClickable && onPickSlot(slot)}
          />
        )
      })}
    </>
  )
}

// ── Single Pick Slot ──────────────────────────────────────────
function PickSlot({ slot, isCurrent, isClickable, odds, isMe, isAlt, onClick }) {
  const { displayName, player_name, slot_number, alt_number, is_activated, withdrawn_replaced } = slot
  const classes = [
    'pick-slot',
    isMe ? 'mine' : '',
    isClickable ? 'clickable' : '',
    is_activated ? 'activated' : ''
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} onClick={onClick}>
      <div className={`pick-num ${isAlt ? 'alt' : ''}`}>
        {isAlt ? `A${alt_number}` : slot_number}
      </div>
      <div className="pick-info">
        <div className="pick-owner">{displayName}{is_activated && ' — ALT ACTIVE'}</div>
        <div className={`pick-player ${player_name ? (is_activated ? 'activated' : '') : 'empty'}`}>
          {player_name
            ? is_activated
              ? `${player_name} ★ (replaced ${withdrawn_replaced})`
              : player_name
            : isCurrent && isClickable
              ? 'Tap to pick →'
              : isCurrent
                ? 'On the clock...'
                : isAlt
                  ? 'Alternate not picked'
                  : 'Awaiting pick...'}
        </div>
      </div>
      {player_name && odds && <div className="pick-odds">{odds}</div>}
      {isCurrent && !player_name && <div className="current-dot" />}
    </div>
  )
}

// ── Withdrawal Log ────────────────────────────────────────────
function WithdrawalLog({ picks }) {
  const activations = picks.filter(p => p.is_activated && p.withdrawn_replaced)
  if (!activations.length) return (
    <>
      <div className="section-label">Injury / Alternate Activations</div>
      <div style={{ padding: '0.5rem 1.5rem 1rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.22)' }}>
        No withdrawals reported.
      </div>
    </>
  )
  return (
    <>
      <div className="section-label">Injury / Alternate Activations</div>
      <div style={{ padding: '0 1rem 1rem' }}>
        {activations.map(p => (
          <div key={p.id} style={{ background: 'rgba(200,168,75,0.07)', border: '1px solid rgba(200,168,75,0.18)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
            ⚡ <span style={{ color: '#e57373' }}>{p.withdrawn_replaced}</span> withdrawn · Replaced by <span style={{ color: '#81c784' }}>{p.player_name}</span> ({p.profiles?.display_name})
          </div>
        ))}
      </div>
    </>
  )
}
