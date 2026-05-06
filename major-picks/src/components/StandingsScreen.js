import React, { useState, useEffect } from 'react'
import { supabase, getStandings } from '../lib/supabase'

export default function StandingsScreen({ tournaments, profile }) {
  const [standings, setStandings] = useState([])
  const [allPicks, setAllPicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: s }, { data: p }] = await Promise.all([
        getStandings(),
        supabase.from('picks').select('*, profiles(display_name)').in(
          'tournament_id',
          tournaments.map(t => t.id)
        )
      ])
      setStandings(s || [])
      setAllPicks(p || [])
      setLoading(false)
    }
    if (tournaments.length) load()
  }, [tournaments])

  const completedTournaments = tournaments.filter(t => t.status === 'complete')

  return (
    <>
      <div className="t-header">
        <div className="t-badge">All-Time</div>
        <div className="t-title">Leaderboard</div>
        <div className="t-subtitle">Season standings · 2026</div>
      </div>

      <div className="section-label" style={{ paddingTop: '1.25rem' }}>Season Standings</div>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /></div>
      ) : standings.length === 0 ? (
        <div className="empty-picks">No wins recorded yet — let's play!</div>
      ) : (
        standings.map((row, i) => (
          <div key={row.user_id} className="standings-card">
            <div className={`standings-rank ${i === 0 && row.total_wins > 0 ? 'gold' : ''}`}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div className="standings-name">
                {row.profiles?.display_name}
                {row.profiles?.id === profile?.id && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>you</span>}
              </div>
              <div className="standings-wins">{row.total_wins} tournament win{row.total_wins !== 1 ? 's' : ''}</div>
              {row.total_wins > 0 && (
                <div className="trophy-row">
                  {completedTournaments
                    .filter(t => t.picker_winner_id === row.user_id)
                    .map(t => (
                      <div key={t.id} className="trophy-chip">{t.short_name}</div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}

      <div className="section-label">Tournament History</div>
      {tournaments.map(t => (
        <TournamentCard key={t.id} tournament={t} picks={allPicks.filter(p => p.tournament_id === t.id)} />
      ))}
    </>
  )
}

function TournamentCard({ tournament, picks }) {
  const users = [...new Set(picks.map(p => p.user_id))]

  return (
    <div className="tourney-card">
      <div className="tourney-card-header">
        <div className="tourney-card-name">{tournament.name}</div>
        <div className={`status-chip status-${tournament.status}`}>
          {tournament.status === 'active' ? 'Live' : tournament.status === 'complete' ? 'Complete' : 'Upcoming'}
        </div>
      </div>
      <div className="picks-mini">
        {tournament.status === 'upcoming' ? (
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)', padding: '4px 0' }}>
            {tournament.dates} · Draft opens 1 week prior
          </div>
        ) : users.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)', padding: '4px 0' }}>No picks yet</div>
        ) : (
          users.map(userId => {
            const userPicks = picks.filter(p => p.user_id === userId && !p.is_alternate)
            const name = picks.find(p => p.user_id === userId)?.profiles?.display_name || '?'
            const isWinner = tournament.picker_winner_id === userId
            return (
              <div key={userId} className="picks-mini-row">
                <div className="picks-mini-owner">{name}</div>
                <div className="picks-mini-player">
                  {userPicks.slice(0, 3).map(p => p.player_name).join(', ')}
                  {userPicks.length > 3 ? ` +${userPicks.length - 3} more` : ''}
                </div>
                {isWinner && (
                  <div className="picks-mini-winner">★ Won</div>
                )}
              </div>
            )
          })
        )}
        {tournament.tournament_winner && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem', color: 'var(--t-secondary)' }}>
            Winner: {tournament.tournament_winner}
          </div>
        )}
      </div>
    </div>
  )
}
