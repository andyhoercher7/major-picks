import React, { useState, useEffect, useCallback } from 'react'
import {
  supabase, getDraftOrder, setDraftOrder, computeNextDraftOrder,
  recordTournamentWinner, activateAlternate, getInvites,
  submitInvite, voteOnInvite, getAllProfiles
} from '../lib/supabase'

export default function ProfileScreen({ profile, tournament, tournaments, showToast, onTournamentUpdate, onLogout }) {
  const [draftOrder, setDraftOrderState] = useState([])
  const [invites, setInvites] = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)

  // Admin: winner form
  const [winnerPlayer, setWinnerPlayer] = useState('')
  const [winnerPicker, setWinnerPicker] = useState('')

  // Admin: withdrawal form
  const [withdrawPlayer, setWithdrawPlayer] = useState('')

  const load = useCallback(async () => {
    const [{ data: d }, { data: invs }, { data: profs }] = await Promise.all([
      tournament ? getDraftOrder(tournament.id) : { data: [] },
      getInvites(),
      getAllProfiles()
    ])
    setDraftOrderState(d || [])
    setInvites(invs || [])
    setAllProfiles(profs || [])
  }, [tournament])

  useEffect(() => { load() }, [load])

  // ── Admin: initialize draft order (randomize) ─────────────
  async function handleInitDraftOrder() {
    if (!tournament || !allProfiles.length) return
    const shuffled = [...allProfiles].sort(() => Math.random() - 0.5).map(p => p.id)
    const { error } = await setDraftOrder(tournament.id, shuffled)
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Draft order randomized!')
    load()
  }

  // ── Admin: advance to next tournament ─────────────────────
  async function handleAdvanceTournament() {
    if (!tournament) return
    // Set current to complete, next to active with rotated order
    const currentOrderIds = draftOrder.map(d => d.user_id)
    const nextOrderIds = computeNextDraftOrder(currentOrderIds)

    // Find next upcoming tournament
    const sorted = [...tournaments].sort((a, b) => a.season_order - b.season_order)
    const nextT = sorted.find(t => t.status === 'upcoming')
    if (!nextT) { showToast('No upcoming tournament found'); return }

    await supabase.from('tournaments').update({ status: 'complete' }).eq('id', tournament.id)
    await supabase.from('tournaments').update({ status: 'active', draft_open: true }).eq('id', nextT.id)
    await setDraftOrder(nextT.id, nextOrderIds)

    showToast('Advanced to ' + nextT.name + '!')
    onTournamentUpdate()
    load()
  }

  // ── Admin: record tournament winner ───────────────────────
  async function handleRecordWinner(e) {
    e.preventDefault()
    if (!winnerPlayer || !winnerPicker) return
    const pickerProfile = allProfiles.find(p => p.id === winnerPicker)
    const { error } = await recordTournamentWinner(tournament.id, winnerPlayer, winnerPicker)
    if (error) { showToast('Error: ' + error.message); return }
    showToast(`${winnerPlayer} wins! ${pickerProfile?.display_name} gets the point!`)
    setWinnerPlayer(''); setWinnerPicker('')
    onTournamentUpdate()
  }

  // ── Admin: report withdrawal ──────────────────────────────
  async function handleWithdrawal(e) {
    e.preventDefault()
    if (!withdrawPlayer) return
    // Find who picked this player
    const { data: pick } = await supabase
      .from('picks')
      .select('*, profiles(display_name)')
      .eq('tournament_id', tournament.id)
      .eq('player_name', withdrawPlayer)
      .eq('is_alternate', false)
      .single()

    if (!pick) { showToast(withdrawPlayer + ' not found in any picks'); return }

    // Find their next unused alternate
    const { data: alts } = await supabase
      .from('picks')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('user_id', pick.user_id)
      .eq('is_alternate', true)
      .eq('is_activated', false)
      .order('alt_number')

    if (!alts?.length || !alts[0].player_name) {
      showToast('No available alternate for ' + pick.profiles?.display_name)
      return
    }

    const { error } = await activateAlternate(tournament.id, pick.user_id, alts[0].alt_number, withdrawPlayer)
    if (error) { showToast('Error: ' + error.message); return }
    showToast(`${withdrawPlayer} withdrawn · ${alts[0].player_name} activated for ${pick.profiles?.display_name}!`)
    setWithdrawPlayer('')
  }

  // ── Invites ───────────────────────────────────────────────
  async function handleSubmitInvite(e) {
    e.preventDefault()
    if (!inviteName) return
    const { error } = await submitInvite(inviteName, inviteEmail, profile.id)
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Invite submitted — waiting for votes from others')
    setInviteName(''); setInviteEmail('')
    load()
  }

  async function handleVote(inviteId, vote) {
    const { error } = await voteOnInvite(inviteId, profile.id, vote, allProfiles.map(p => p.id))
    if (error) { showToast('Error: ' + error.message); return }
    load()
  }

  // ── Next draft order preview ──────────────────────────────
  const nextOrderIds = draftOrder.length ? computeNextDraftOrder(draftOrder.map(d => d.user_id)) : []
  const nextOrderNames = nextOrderIds.map(id => allProfiles.find(p => p.id === id)?.display_name || '?')
  const currentOrderNames = draftOrder.map(d => d.profiles?.display_name || '?')

  const nextTournament = [...tournaments].sort((a, b) => a.season_order - b.season_order)
    .find(t => t.status === 'upcoming')

  return (
    <>
      <div className="t-header">
        <div className="t-badge">Account</div>
        <div className="t-title">{profile?.display_name}</div>
        <div className="t-subtitle">
          Member since 2026{profile?.is_admin ? ' · Admin' : ''}
        </div>
      </div>

      {/* Account */}
      <div className="section-label" style={{ paddingTop: '1.25rem' }}>Account</div>
      <div style={{ padding: '0 1rem' }}>
        <div className="settings-row" onClick={onLogout}>
          <div className="settings-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--t-secondary)" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div>
            <div className="settings-label">Sign Out</div>
            <div className="settings-sub">See you on the course</div>
          </div>
        </div>
      </div>

      {/* Draft order */}
      <div className="section-label">Draft Order</div>
      <div style={{ padding: '0 1rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.75rem' }}>
            Current ({tournament?.short_name || 'Active'}): {currentOrderNames.join(' → ') || 'Not set'}
          </div>
          {nextOrderNames.length > 0 && (
            <>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.6rem' }}>
                Next ({nextTournament?.short_name || 'Upcoming'}):
              </div>
              {nextOrderNames.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(200,168,75,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t-secondary)', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: '0.9rem', color: '#f0f0f0' }}>{name}{allProfiles.find(p => p.display_name === name)?.id === profile?.id ? ' (you)' : ''}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Invites */}
      <div className="section-label">Member Invites</div>
      <div style={{ padding: '0 1rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#fff', marginBottom: 4 }}>Invite a New Member</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>All three members must vote yes before access is granted.</div>
          <form onSubmit={handleSubmitInvite}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="field-label">Name</label>
              <input className="field-input" type="text" placeholder="Full name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="field-label">Email (optional)</label>
              <input className="field-input" type="email" placeholder="email@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <button className="btn-primary" type="submit">Submit for Vote</button>
          </form>

          {invites.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
              {invites.map(inv => (
                <div key={inv.id} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#fff', marginBottom: 6 }}>Invite: {inv.invited_name}</div>
                  {allProfiles.map(p => {
                    const vote = inv.votes?.[p.id]
                    return (
                      <div key={p.id} className="vote-row">
                        <div className="vote-name">{p.display_name}</div>
                        {vote === true ? <div className="vote-yes">Yes ✓</div>
                          : vote === false ? <div className="vote-no">No ✗</div>
                          : p.id === profile?.id
                            ? <div>
                                <button className="vote-btn yes" onClick={() => handleVote(inv.id, true)}>Yes</button>
                                <button className="vote-btn no" onClick={() => handleVote(inv.id, false)}>No</button>
                              </div>
                            : <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)' }}>Pending</div>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin Tools */}
      {profile?.is_admin && (
        <>
          <div className="section-label">Admin Tools</div>
          <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingBottom: '1rem' }}>

            {/* Initialize draft order */}
            {draftOrder.length === 0 && (
              <div className="card">
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#fff', marginBottom: 4 }}>Initialize Draft Order</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>Randomly sets the first draft order for the season.</div>
                <button className="btn-primary" onClick={handleInitDraftOrder}>Randomize Order</button>
              </div>
            )}

            {/* Report withdrawal */}
            <div className="card">
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#fff', marginBottom: 4 }}>Report Withdrawal</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>Activates the picker's next unused alternate.</div>
              <form onSubmit={handleWithdrawal} style={{ display: 'flex', gap: 8 }}>
                <input className="field-input" type="text" placeholder="Withdrawn player name" value={withdrawPlayer} onChange={e => setWithdrawPlayer(e.target.value)} style={{ flex: 1 }} />
                <button className="btn-primary" type="submit" style={{ width: 'auto', padding: '0 16px', flexShrink: 0 }}>Apply</button>
              </form>
            </div>

            {/* Record tournament winner */}
            <div className="card">
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#fff', marginBottom: 4 }}>Record Tournament Winner</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>Awards 1 point to the picker who had the winner.</div>
              <form onSubmit={handleRecordWinner}>
                <div style={{ marginBottom: '0.65rem' }}>
                  <label className="field-label">Winning Player Name</label>
                  <input className="field-input" type="text" placeholder="e.g. Scottie Scheffler" value={winnerPlayer} onChange={e => setWinnerPlayer(e.target.value)} />
                </div>
                <div style={{ marginBottom: '0.65rem' }}>
                  <label className="field-label">Winning Picker</label>
                  <select className="field-input" value={winnerPicker} onChange={e => setWinnerPicker(e.target.value)}>
                    <option value="">Select...</option>
                    {allProfiles.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                </div>
                <button className="btn-primary" type="submit">Record Win</button>
              </form>
            </div>

            {/* Advance tournament */}
            <div className="card">
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#fff', marginBottom: 4 }}>Advance to Next Tournament</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>
                Marks current tournament complete, opens draft for the next one, and rotates the pick order.
              </div>
              <button className="btn-secondary" onClick={handleAdvanceTournament}>
                {nextTournament ? `Open ${nextTournament.short_name} Draft →` : 'No upcoming tournament'}
              </button>
            </div>

          </div>
        </>
      )}
    </>
  )
}
