'use client'

import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/nextjs'

export default function Home() {
  const [players, setPlayers] = useState<any[]>([])
  const [recentGames, setRecentGames] = useState<any[]>([])
  const [activeSport, setActiveSport] = useState('basketball')
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitMode, setSubmitMode] = useState<'solo' | 'team'>('solo')
  const [opponent, setOpponent] = useState('')
  const [result, setResult] = useState<'win' | 'loss' | ''>('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [search, setSearch] = useState('')
  const [myTeammates, setMyTeammates] = useState<string[]>([])
  const [oppTeam, setOppTeam] = useState<string[]>([])
  const [mvpId, setMvpId] = useState<string | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const { isSignedIn } = useAuth()
  const { user } = useUser()

  useEffect(() => {
    fetchPlayers()
    fetchRecentGames()
    fetchMVP()
  }, [])

  useEffect(() => {
    if (isSignedIn && user) ensurePlayer()
  }, [isSignedIn, user])

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*')
    if (data) setPlayers(data)
  }

  const fetchRecentGames = async () => {
    const { data } = await supabase
      .from('games').select('*')
      .order('created_at', { ascending: false }).limit(10)
    if (data) setRecentGames(data)
  }

  const fetchMVP = async () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    const { data: weekGames } = await supabase
      .from('games').select('player_id, result')
      .eq('result', 'win').gte('created_at', monday.toISOString())
    if (!weekGames || weekGames.length === 0) return
    const winCounts: Record<string, number> = {}
    for (const g of weekGames) {
      if (g.player_id) winCounts[g.player_id] = (winCounts[g.player_id] || 0) + 1
    }
    const topId = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (topId) setMvpId(topId)
  }

  const ensurePlayer = async () => {
    if (!user) return
    const name = user.fullName || user.username || user.emailAddresses[0]?.emailAddress || 'Unknown'
    for (const sport of ['basketball', 'pickleball']) {
      const { data: existing } = await supabase
        .from('players').select('id')
        .eq('clerk_id', user.id).eq('sport', sport).maybeSingle()
      if (!existing) {
        await supabase.from('players').insert({ name, clerk_id: user.id, wins: 0, losses: 0, sport })
      }
    }
    fetchPlayers()
  }

  const submitSolo = async () => {
    if (!result || !user) return
    setSubmitting(true)
    const name = user.fullName || user.username || user.emailAddresses[0]?.emailAddress || 'Unknown'
    const { data: me } = await supabase.from('players').select('*').eq('clerk_id', user.id).eq('sport', activeSport).single()
    if (!me) { setSubmitting(false); return }
    await supabase.from('players').update({
      wins: result === 'win' ? me.wins + 1 : me.wins,
      losses: result === 'loss' ? me.losses + 1 : me.losses,
    }).eq('id', me.id)
    const oppResult = opponent ? await supabase.from('players').select('*').eq('name', opponent).eq('sport', activeSport).single() : null
    await supabase.from('games').insert({
      player_id: user.id, player_name: name,
      opponent_name: opponent || null,
      opponent_id: oppResult?.data?.clerk_id || null,
      sport: activeSport, result,
      location: location.trim() || null,
    })
    if (oppResult?.data) {
      await supabase.from('players').update({
        wins: result === 'loss' ? oppResult.data.wins + 1 : oppResult.data.wins,
        losses: result === 'win' ? oppResult.data.losses + 1 : oppResult.data.losses,
      }).eq('id', oppResult.data.id)
      await supabase.from('games').insert({
        player_id: oppResult.data.clerk_id, player_name: oppResult.data.name,
        opponent_name: name, opponent_id: user.id,
        sport: activeSport, result: result === 'win' ? 'loss' : 'win',
        location: location.trim() || null,
      })
    }
    await fetchPlayers(); await fetchRecentGames(); await fetchMVP()
    setSubmitting(false); setSubmitDone(true)
    setResult(''); setOpponent(''); setLocation('')
    setTimeout(() => { setSubmitDone(false); setShowSubmit(false) }, 2000)
  }

  const submitTeam = async () => {
    if (!result || !user) return
    setSubmitting(true)
    const name = user.fullName || user.username || user.emailAddresses[0]?.emailAddress || 'Unknown'
    const myTeamPlayers = players.filter(p => p.sport === activeSport && myTeammates.includes(p.name) && p.clerk_id !== user.id)
    const oppTeamPlayers = players.filter(p => p.sport === activeSport && oppTeam.includes(p.name))
    const team1Ids = [user.id, ...myTeamPlayers.map((p: any) => p.clerk_id)]
    const team1Names = [name, ...myTeamPlayers.map((p: any) => p.name)]
    const team2Ids = oppTeamPlayers.map((p: any) => p.clerk_id)
    const team2Names = oppTeamPlayers.map((p: any) => p.name)
    const winnerTeam = result === 'win' ? 1 : 2
    await supabase.from('team_games').insert({
      sport: activeSport, result, winner_team: winnerTeam,
      team1_ids: team1Ids, team1_names: team1Names,
      team2_ids: team2Ids, team2_names: team2Names,
      location: location.trim() || null, submitted_by: user.id,
    })
    const winners = winnerTeam === 1 ? team1Ids : team2Ids
    const losers = winnerTeam === 1 ? team2Ids : team1Ids
    for (const pid of winners) {
      const { data: p } = await supabase.from('players').select('*').eq('clerk_id', pid).eq('sport', activeSport).single()
      if (p) await supabase.from('players').update({ wins: p.wins + 1 }).eq('id', p.id)
    }
    for (const pid of losers) {
      const { data: p } = await supabase.from('players').select('*').eq('clerk_id', pid).eq('sport', activeSport).single()
      if (p) await supabase.from('players').update({ losses: p.losses + 1 }).eq('id', p.id)
    }
    await fetchPlayers(); await fetchRecentGames(); await fetchMVP()
    setSubmitting(false); setSubmitDone(true)
    setResult(''); setMyTeammates([]); setOppTeam([]); setLocation('')
    setTimeout(() => { setSubmitDone(false); setShowSubmit(false) }, 2000)
  }

  const filtered = players
    .filter(p => p.sport === activeSport)
    .filter(p => search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aPct = a.wins + a.losses ? a.wins / (a.wins + a.losses) : 0
      const bPct = b.wins + b.losses ? b.wins / (b.wins + b.losses) : 0
      return bPct - aPct
    })

  const allFiltered = players
    .filter(p => p.sport === activeSport)
    .sort((a, b) => {
      const aPct = a.wins + a.losses ? a.wins / (a.wins + a.losses) : 0
      const bPct = b.wins + b.losses ? b.wins / (b.wins + b.losses) : 0
      return bPct - aPct
    })

  const leader = allFiltered[0]
  const topPct = leader
    ? leader.wins + leader.losses > 0
      ? Math.round((leader.wins / (leader.wins + leader.losses)) * 100) : 0
    : null

  const isBasketball = activeSport === 'basketball'
  const accent = isBasketball ? '#FF6B1A' : '#39FF6A'
  const otherPlayers = allFiltered.filter(p => p.clerk_id !== user?.id)

  const toggleTeammate = (name: string, team: 'my' | 'opp') => {
    if (team === 'my') setMyTeammates(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
    else setOppTeam(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root { --black: #080808; --card: #161616; --border: #1e1e1e; --white: #f0f0f0; --gray: #666; }
        html { scroll-behavior: smooth; }
        body { background: var(--black); color: var(--white); font-family: 'Barlow', sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mvpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .fade-in   { animation: fadeUp 0.5s ease forwards; }
        .fade-in-2 { animation: fadeUp 0.5s ease 0.1s forwards; opacity: 0; }
        .fade-in-3 { animation: fadeUp 0.5s ease 0.2s forwards; opacity: 0; }
        .fade-in-4 { animation: fadeUp 0.5s ease 0.3s forwards; opacity: 0; }
        .lb-row { cursor: pointer; transition: background 0.15s; }
        .lb-row:hover { background: #1c1c1c !important; }
        .sport-btn { transition: all 0.18s ease; }
        .sport-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .action-btn { transition: all 0.18s ease; }
        .action-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .action-btn:active { transform: translateY(0); }
        .search-input::placeholder { color: #444; }
        .search-input:focus { outline: none; border-color: #444; }
        .loc-input::placeholder { color: #444; }
        .loc-input:focus { outline: none; border-color: #444; }
        select { -webkit-appearance: none; appearance: none; }
        select option { background: #161616; }
        .game-feed-row:hover { background: #1a1a1a !important; }
        .player-chip { transition: all 0.15s ease; cursor: pointer; }
        .player-chip:hover { opacity: 0.85; }
        .mvp-badge { animation: mvpPulse 2s ease infinite; }
        .feature-card:hover { border-color: #333 !important; transform: translateY(-2px); }
        .feature-card { transition: all 0.2s ease; }

        /* MOBILE */
        @media (max-width: 768px) {
          .stat-pills { flex-wrap: wrap; }
          .main-grid { grid-template-columns: 1fr !important; }
          .hero-title { font-size: clamp(4rem, 20vw, 7rem) !important; }
          .submit-grid { grid-template-columns: 1fr !important; }
          .team-grid { grid-template-columns: 1fr !important; }
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          .lb-grid { grid-template-columns: 36px 1fr 50px 76px !important; }
          .lb-grid-header { grid-template-columns: 36px 1fr 50px 76px !important; }
          .hide-mobile-col { display: none !important; }
          .stat-card { padding: 0.9rem 1rem !important; }
          .section-pad { padding-left: 1rem !important; padding-right: 1rem !important; }
        }

        @media (max-width: 480px) {
          .hero-title { font-size: clamp(3.5rem, 22vw, 5rem) !important; }
        }
      `}</style>

      <div style={{ background: 'var(--black)', minHeight: '100vh' }}>

        {/* HEADER */}
        <header style={{
          borderBottom: '1px solid var(--border)', padding: '0 1.5rem', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(16px)', zIndex: 50,
        }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '4px' }}>
            RUN<span style={{ color: accent }}>IQ</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="action-btn" style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase',
                    padding: '0.4rem 0.9rem', border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--gray)', cursor: 'pointer',
                  }}>Log In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="action-btn" style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase',
                    padding: '0.4rem 0.9rem', border: 'none',
                    background: accent, color: '#000', cursor: 'pointer',
                  }}>Join Free</button>
                </SignUpButton>
              </>
            ) : (
              <>
                <button className="action-btn" onClick={() => { setShowSubmit(!showSubmit); setShowMobileMenu(false) }} style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase',
                  padding: '0.4rem 0.9rem', border: 'none',
                  background: showSubmit ? '#333' : accent,
                  color: showSubmit ? 'var(--white)' : '#000', cursor: 'pointer',
                }}>{showSubmit ? 'Cancel' : '+ Submit'}</button>
                <a href="/account" className="hide-mobile" style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem',
                  fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
                  color: 'var(--gray)', textDecoration: 'none',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray)')}
                >Account</a>
                <UserButton />
              </>
            )}
          </div>
        </header>

        {/* SUBMIT PANEL */}
        {isSignedIn && showSubmit && (
          <div style={{ borderBottom: '1px solid var(--border)', background: '#0a0a0a', padding: '1.25rem 1.5rem' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: accent, marginRight: '0.5rem' }}>
                  Submit {isBasketball ? 'Basketball' : 'Pickleball'}
                </div>
                {[['solo', '1v1'], ['team', 'Team']].map(([m, l]) => (
                  <button key={m} className="action-btn" onClick={() => setSubmitMode(m as 'solo' | 'team')} style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase',
                    padding: '0.3rem 0.9rem', border: 'none', cursor: 'pointer',
                    background: submitMode === m ? accent : 'var(--card)',
                    color: submitMode === m ? '#000' : 'var(--gray)',
                  }}>{l}</button>
                ))}
              </div>

              {submitMode === 'solo' && (
                <div className="submit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.35rem' }}>Opponent</div>
                    <select value={opponent} onChange={e => setOpponent(e.target.value)} style={{
                      background: 'var(--card)', border: '1px solid var(--border)',
                      color: opponent ? 'var(--white)' : 'var(--gray)',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                      fontSize: '0.88rem', padding: '0.6rem 0.85rem', cursor: 'pointer', width: '100%',
                    }}>
                      <option value="">Select opponent...</option>
                      {otherPlayers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.35rem' }}>Location</div>
                    <input className="loc-input" value={location} onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Alumni Arena..." style={{
                        background: 'var(--card)', border: '1px solid var(--border)',
                        color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 600, fontSize: '0.88rem', padding: '0.6rem 0.85rem', width: '100%',
                      }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.35rem' }}>Result</div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button className="action-btn" onClick={() => setResult('win')} style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                        letterSpacing: '2px', textTransform: 'uppercase', padding: '0.6rem 1rem',
                        border: 'none', cursor: 'pointer', flex: 1,
                        background: result === 'win' ? '#39FF6A' : 'var(--card)',
                        color: result === 'win' ? '#000' : 'var(--gray)',
                        borderRight: '1px solid var(--border)',
                      }}>✓ Win</button>
                      <button className="action-btn" onClick={() => setResult('loss')} style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                        letterSpacing: '2px', textTransform: 'uppercase', padding: '0.6rem 1rem',
                        border: 'none', cursor: 'pointer', flex: 1,
                        background: result === 'loss' ? '#e74c3c' : 'var(--card)',
                        color: result === 'loss' ? '#fff' : 'var(--gray)',
                      }}>✗ Loss</button>
                    </div>
                  </div>
                  <button className="action-btn" onClick={submitSolo} disabled={!result || submitting} style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                    letterSpacing: '2.5px', textTransform: 'uppercase', padding: '0.6rem 1rem',
                    border: 'none', cursor: !result || submitting ? 'not-allowed' : 'pointer',
                    background: submitDone ? '#39FF6A' : accent,
                    color: '#000', opacity: !result || submitting ? 0.4 : 1, width: '100%',
                  }}>{submitDone ? '✓ Saved!' : submitting ? 'Saving...' : 'Submit →'}</button>
                </div>
              )}

              {submitMode === 'team' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="team-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: accent, marginBottom: '0.5rem' }}>Your Team</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {otherPlayers.map(p => (
                          <button key={p.id} className="player-chip" onClick={() => toggleTeammate(p.name, 'my')} style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.78rem',
                            padding: '0.25rem 0.65rem', border: 'none',
                            background: myTeammates.includes(p.name) ? accent : 'var(--card)',
                            color: myTeammates.includes(p.name) ? '#000' : 'var(--gray)',
                          }}>{p.name}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#e74c3c', marginBottom: '0.5rem' }}>Opponents</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {otherPlayers.filter(p => !myTeammates.includes(p.name)).map(p => (
                          <button key={p.id} className="player-chip" onClick={() => toggleTeammate(p.name, 'opp')} style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.78rem',
                            padding: '0.25rem 0.65rem', border: 'none',
                            background: oppTeam.includes(p.name) ? '#e74c3c' : 'var(--card)',
                            color: oppTeam.includes(p.name) ? '#fff' : 'var(--gray)',
                          }}>{p.name}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="submit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.35rem' }}>Location</div>
                      <input className="loc-input" value={location} onChange={e => setLocation(e.target.value)}
                        placeholder="e.g. Alumni Arena..." style={{
                          background: 'var(--card)', border: '1px solid var(--border)',
                          color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 600, fontSize: '0.88rem', padding: '0.6rem 0.85rem', width: '100%',
                        }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.35rem' }}>Result</div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button className="action-btn" onClick={() => setResult('win')} style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                          letterSpacing: '2px', textTransform: 'uppercase', padding: '0.6rem 1rem',
                          border: 'none', cursor: 'pointer', flex: 1,
                          background: result === 'win' ? '#39FF6A' : 'var(--card)',
                          color: result === 'win' ? '#000' : 'var(--gray)',
                          borderRight: '1px solid var(--border)',
                        }}>✓ Won</button>
                        <button className="action-btn" onClick={() => setResult('loss')} style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                          letterSpacing: '2px', textTransform: 'uppercase', padding: '0.6rem 1rem',
                          border: 'none', cursor: 'pointer', flex: 1,
                          background: result === 'loss' ? '#e74c3c' : 'var(--card)',
                          color: result === 'loss' ? '#fff' : 'var(--gray)',
                        }}>✗ Lost</button>
                      </div>
                    </div>
                    <button className="action-btn" onClick={submitTeam} disabled={!result || submitting || oppTeam.length === 0} style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                      letterSpacing: '2.5px', textTransform: 'uppercase', padding: '0.6rem 1rem',
                      border: 'none', cursor: !result || submitting || oppTeam.length === 0 ? 'not-allowed' : 'pointer',
                      background: submitDone ? '#39FF6A' : accent,
                      color: '#000', opacity: !result || submitting || oppTeam.length === 0 ? 0.4 : 1, width: '100%',
                    }}>{submitDone ? '✓ Saved!' : submitting ? 'Saving...' : 'Submit →'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HERO — premium glow-up for signed out users */}
        {!isSignedIn ? (
          <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Animated background */}
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 60% 30%, ${accent}10 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 20% 80%, ${accent}06 0%, transparent 60%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${accent}08 1px, transparent 1px), linear-gradient(90deg, ${accent}08 1px, transparent 1px)`, backgroundSize: '40px 40px', WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 80%)', pointerEvents: 'none' } as React.CSSProperties} />

            <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
              <div className="fade-in" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', color: accent, marginBottom: '0.75rem' }}>
                University at Buffalo · Est. 2025
              </div>

              <h1 className="hero-title fade-in-2" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(4.5rem, 15vw, 10rem)', lineHeight: 0.88, letterSpacing: '4px', marginBottom: '1.5rem' }}>
                WHO<br />
                <span style={{ color: accent }}>RUNS</span><br />
                THE COURT
              </h1>

              <p className="fade-in-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: 'var(--gray)', letterSpacing: '1px', maxWidth: 500, lineHeight: 1.6, marginBottom: '2.5rem' }}>
                The competitive ranking system for UB pickup basketball and pickleball. Sign up, log your games, and prove you run the court.
              </p>

              <div className="fade-in-4" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '4rem' }}>
                <SignUpButton mode="modal">
                  <button className="action-btn" style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '0.95rem', letterSpacing: '2.5px', textTransform: 'uppercase',
                    padding: '0.9rem 2rem', border: 'none', background: accent, color: '#000', cursor: 'pointer',
                  }}>Join RUNIQ — It's Free</button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button className="action-btn" style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '0.95rem', letterSpacing: '2.5px', textTransform: 'uppercase',
                    padding: '0.9rem 2rem', border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--gray)', cursor: 'pointer',
                  }}>Log In</button>
                </SignInButton>
              </div>

              {/* Feature cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', border: '1px solid var(--border)' }}>
                {[
                  { icon: '🏆', title: 'Real Rankings', desc: 'Win % based leaderboard updated after every game' },
                  { icon: '🏀', title: 'Two Sports', desc: 'Basketball and pickleball tracked separately' },
                  { icon: '👥', title: 'Team Games', desc: 'Log 2v2, 3v3, or any team game format' },
                  { icon: '📍', title: 'Location Tags', desc: 'Tag the court where every game was played' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="feature-card" style={{ background: 'var(--card)', padding: '1.5rem', borderTop: `2px solid ${accent}22` }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '1px', fontSize: '1rem', marginBottom: '0.3rem' }}>{title}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--gray)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section style={{ padding: '3rem 1.5rem 2rem', maxWidth: 1100, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-30%)', width: 500, height: 300, background: `radial-gradient(ellipse at center, ${accent}10 0%, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div className="fade-in" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', color: accent, marginBottom: '0.6rem' }}>
                University at Buffalo · Multi-Sport Rankings
              </div>
              <h1 className="hero-title fade-in-2" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(4rem, 13vw, 8rem)', lineHeight: 0.9, letterSpacing: '4px', marginBottom: '1rem' }}>
                WHO<br /><span style={{ color: accent }}>RUNS</span><br />THE COURT
              </h1>
              <div className="fade-in-3" style={{ marginTop: '1.5rem' }}>
                <button className="action-btn" onClick={() => setShowSubmit(!showSubmit)} style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: '0.88rem', letterSpacing: '2.5px', textTransform: 'uppercase',
                  padding: '0.75rem 1.75rem', border: 'none', background: accent, color: '#000', cursor: 'pointer',
                }}>+ Submit a Result</button>
              </div>
            </div>
          </section>
        )}

        {/* MVP BANNER */}
        {mvpId && (
          <section style={{ padding: '0 1.5rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
            {(() => {
              const mvpPlayer = players.find(p => p.clerk_id === mvpId && p.sport === activeSport)
              if (!mvpPlayer) return null
              return (
                <div onClick={() => window.location.href = `/player/${mvpId}`} style={{
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,165,0,0.03) 100%)',
                  border: '1px solid rgba(255,215,0,0.2)', padding: '0.9rem 1.25rem',
                  display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                }}>
                  <span className="mvp-badge" style={{ fontSize: '1.3rem' }}>👑</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,215,0,0.6)', marginBottom: '0.1rem' }}>MVP of the Week</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '2px', color: '#FFD700' }}>{mvpPlayer.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: '#FFD700', lineHeight: 1 }}>{mvpPlayer.wins}-{mvpPlayer.losses}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,215,0,0.4)' }}>This Week</div>
                  </div>
                </div>
              )
            })()}
          </section>
        )}

        {/* SPORT TOGGLE */}
        <section style={{ padding: '0 1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[
              { id: 'basketball', label: '🏀 Basketball', color: '#FF6B1A' },
              { id: 'pickleball', label: '🏓 Pickleball', color: '#39FF6A' },
            ].map(({ id, label, color }) => (
              <button key={id} className="sport-btn" onClick={() => setActiveSport(id)} style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                letterSpacing: '2px', textTransform: 'uppercase', padding: '0.6rem 1.5rem',
                border: 'none', cursor: 'pointer',
                background: activeSport === id ? color : 'transparent',
                color: activeSport === id ? '#000' : 'var(--gray)',
                borderRight: id === 'basketball' ? '1px solid var(--border)' : 'none',
              }}>{label}</button>
            ))}
          </div>
        </section>

        {/* STAT PILLS */}
        <section style={{ padding: '0 1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
          <div className="stat-pills" style={{ display: 'flex', gap: '1px' }}>
            {[
              { label: 'Players',    value: allFiltered.length },
              { label: 'Leader',     value: leader?.name ?? '—' },
              { label: 'Top Record', value: leader ? `${leader.wins}-${leader.losses}` : '—' },
              { label: 'Top Win %',  value: topPct !== null ? `${topPct}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1rem 1.25rem', flex: '1 1 120px' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '2px', color: label === 'Leader' || label === 'Top Win %' ? accent : 'var(--white)', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="main-grid section-pad" style={{ padding: '0 1.5rem 6rem', maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>

          {/* LEADERBOARD */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '3px' }}>Leaderboard</h2>
                <span className="hide-mobile" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)' }}>win %</span>
              </div>
              <input className="search-input" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search..." style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '0.85rem', padding: '0.45rem 0.85rem', width: 140,
                }} />
            </div>

            <div className="lb-grid-header" style={{ display: 'grid', gridTemplateColumns: '44px 1fr 60px 60px 76px', padding: '0.4rem 0.85rem', borderBottom: '1px solid var(--border)', marginBottom: '2px' }}>
              {[['RK', false], ['PLAYER', false], ['W', true], ['L', true], ['WIN%', true]].map(([h, hide]) => (
                <div key={h as string} className={hide ? 'hide-mobile-col' : ''} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', textAlign: h === 'PLAYER' ? 'left' : 'center' }}>{h}</div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--card)' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', color: 'var(--gray)', letterSpacing: '1px' }}>
                    {search ? 'No players found.' : 'No players yet.'}
                  </div>
                </div>
              ) : filtered.map((player) => {
                const games = player.wins + player.losses
                const pct = games ? Math.round((player.wins / games) * 100) : 0
                const pctColor = pct >= 70 ? '#39FF6A' : pct >= 50 ? '#FF6B1A' : 'var(--gray)'
                const globalRank = allFiltered.findIndex(p => p.id === player.id)
                const medal = globalRank === 0 ? '🥇' : globalRank === 1 ? '🥈' : globalRank === 2 ? '🥉' : null
                const isMe = player.clerk_id === user?.id
                const isMVP = player.clerk_id === mvpId

                return (
                  <div key={player.id} className="lb-row lb-grid"
                    onClick={() => window.location.href = `/player/${player.clerk_id}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '44px 1fr 60px 60px 76px',
                      alignItems: 'center', padding: '0.8rem 0.85rem',
                      background: isMVP ? 'rgba(255,215,0,0.04)' : isMe ? 'rgba(255,107,26,0.06)' : 'var(--card)',
                      borderLeft: globalRank === 0 ? `2px solid ${accent}` : isMVP ? '2px solid rgba(255,215,0,0.4)' : isMe ? '2px solid #FF6B1A' : '2px solid transparent',
                    }}
                  >
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', textAlign: 'center', color: globalRank < 3 ? accent : 'var(--gray)' }}>
                      {medal ?? `#${globalRank + 1}`}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>{player.name}</span>
                        {isMe && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', background: accent, color: '#000', padding: '0.1rem 0.3rem' }}>YOU</span>}
                        {isMVP && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', background: '#FFD700', color: '#000', padding: '0.1rem 0.3rem' }}>👑</span>}
                      </div>
                      {globalRank === 0 && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: accent, fontWeight: 700, marginTop: '0.1rem' }}>🔥 Top Ranked</div>}
                    </div>
                    <div className="hide-mobile-col" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textAlign: 'center', fontSize: '0.9rem' }}>{player.wins}</div>
                    <div className="hide-mobile-col" style={{ fontFamily: "'Barlow Condensed', sans-serif", textAlign: 'center', color: 'var(--gray)', fontSize: '0.9rem' }}>{player.losses}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', textAlign: 'center', letterSpacing: '1px', color: pctColor }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RECENT GAMES */}
          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '3px', marginBottom: '1rem' }}>Recent Games</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {recentGames.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--card)' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', color: 'var(--gray)', letterSpacing: '1px' }}>No games yet.</div>
                </div>
              ) : recentGames.map(game => (
                <div key={game.id} className="game-feed-row" style={{
                  padding: '0.8rem 1rem', background: 'var(--card)',
                  borderLeft: `2px solid ${game.result === 'win' ? '#39FF6A' : '#e74c3c'}`,
                  transition: 'background 0.15s', cursor: 'pointer',
                }} onClick={() => game.player_id && (window.location.href = `/player/${game.player_id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem' }}>{game.sport === 'basketball' ? '🏀' : '🏓'}</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.9rem' }}>{game.player_name}</span>
                    </div>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '2px', color: game.result === 'win' ? '#39FF6A' : '#e74c3c' }}>
                      {game.result === 'win' ? 'WIN' : 'LOSS'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.78rem', color: 'var(--gray)' }}>
                      {game.opponent_name ? `vs ${game.opponent_name}` : 'Open run'}
                    </span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', color: 'var(--gray)' }}>
                      {new Date(game.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {game.location && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', color: accent }}>📍 {game.location}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </section>
      </div>
    </>
  )
}