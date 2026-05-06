import React, { useState, useMemo } from 'react'

export default function PlayerPickerModal({ open, onClose, onSelect, field, takenPlayers, slot, profile, tournament }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return field.filter(p => q === '' || p.player_name.toLowerCase().includes(q))
  }, [field, search])

  if (!open) return null

  const isAlt = slot?.is_alternate
  const slotLabel = isAlt ? `Alternate #${slot.alt_number}` : `Pick #${slot?.slot_number}`

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ flex: 1 }} onClick={onClose} />
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{slotLabel} — {profile?.display_name}</div>
          <div className="modal-sub">{tournament?.name} · Tap a player to draft them</div>
          <input
            className="modal-search"
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="player-list">
          {filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
              No players found
            </div>
          )}
          {filtered.map(player => {
            const taken = takenPlayers.has(player.player_name)
            return (
              <div
                key={player.player_name}
                className={`player-row ${taken ? 'taken' : ''}`}
                onClick={() => !taken && onSelect(player.player_name)}
              >
                <div className="player-name-col">{player.player_name}</div>
                <div className="player-country-col">{player.country}</div>
                {player.odds && <div className="odds-badge">{player.odds}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
