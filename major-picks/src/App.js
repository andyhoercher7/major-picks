import React, { useState, useEffect, useCallback } from 'react'
import './index.css'
import { supabase, getProfile, getActiveTournament, getTournaments } from './lib/supabase'
import LoginScreen from './components/LoginScreen'
import DraftScreen from './components/DraftScreen'
import StandingsScreen from './components/StandingsScreen'
import ProfileScreen from './components/ProfileScreen'
import Toast from './components/Toast'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [activeTournament, setActiveTournament] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [activeScreen, setActiveScreen] = useState('draft')
  const [toast, setToast] = useState({ msg: '', visible: false })
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2800)
  }, [])

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load profile + tournaments after login
  useEffect(() => {
    if (!session) return
    async function load() {
      setLoading(true)
      const [{ data: prof }, { data: active }, { data: all }] = await Promise.all([
        getProfile(session.user.id),
        getActiveTournament(),
        getTournaments()
      ])
      setProfile(prof)
      setActiveTournament(active)
      setTournaments(all || [])
      setLoading(false)
    }
    load()
  }, [session])

  const refreshTournaments = useCallback(async () => {
    const [{ data: active }, { data: all }] = await Promise.all([
      getActiveTournament(),
      getTournaments()
    ])
    setActiveTournament(active)
    setTournaments(all || [])
  }, [])

  if (!session) {
    return <LoginScreen onLogin={(s) => setSession(s)} showToast={showToast} />
  }

  if (loading) {
    return (
      <div className="app-shell theme-pga" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-wrap">
          <div className="spinner" />
          <span>Loading your picks...</span>
        </div>
      </div>
    )
  }

  const theme = activeTournament?.theme || 'theme-pga'

  return (
    <div className={`app-shell ${theme}`}>
      {/* Screens */}
      <div className={`screen ${activeScreen === 'draft' ? 'active' : ''}`}>
        <DraftScreen
          profile={profile}
          tournament={activeTournament}
          showToast={showToast}
          onTournamentUpdate={refreshTournaments}
        />
      </div>
      <div className={`screen ${activeScreen === 'standings' ? 'active' : ''}`}>
        <StandingsScreen tournaments={tournaments} profile={profile} />
      </div>
      <div className={`screen ${activeScreen === 'settings' ? 'active' : ''}`}>
        <ProfileScreen
          profile={profile}
          tournament={activeTournament}
          tournaments={tournaments}
          showToast={showToast}
          onTournamentUpdate={refreshTournaments}
          onLogout={() => supabase.auth.signOut()}
        />
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <button className={`nav-btn ${activeScreen === 'draft' ? 'active' : ''}`} onClick={() => setActiveScreen('draft')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M17 17h4m-2-2v4"/>
          </svg>
          Draft
        </button>
        <button className={`nav-btn ${activeScreen === 'standings' ? 'active' : ''}`} onClick={() => setActiveScreen('standings')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Standings
        </button>
        <button className={`nav-btn ${activeScreen === 'settings' ? 'active' : ''}`} onClick={() => setActiveScreen('settings')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
          </svg>
          Profile
        </button>
      </nav>

      <Toast msg={toast.msg} visible={toast.visible} />
    </div>
  )
}
