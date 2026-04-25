'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useUser } from '@clerk/nextjs'

export default function PlayerProfile() {
  const { id } = useParams()
  const { user } = useUser()
  const [bball, setBball] = useState<any>(null)
  const [pickle, setPickle] = useState<any>(null)
  const [games, setGames] = useState<any[]>([])
  const [activeSport, setActiveSport] = useState('basketball')
  const [loading, setLoading] = useState(true)
  const [h2hPlayer, setH2hPlayer] = useState('')
  const [allPlayers, setAllPlayers] = useState<any[]>([])

  useEffect(() => {
    if (id) fetchProfile()
  }, [id])

  const fetchProfile = async () => {
    const { data: bballData } = await supabase
      .from('players').select('*').eq('clerk_id', id).eq('sport', 'basketball').single()
    const { data: pickleData } = await supabase
      .from('players').select('*').eq('clerk_id', id).eq('sport', 'pickleball').single()
    const { data: gamesData } = await supabase
      .from('games').select('*').eq('player_id', id)
      .order('created_at', { ascending: false }).limit(20)
    const { data: playersData } = await supabase.from('players').select('*')

    setBball(bballData)
    setPickle(pickleData)
    setGames(gamesData ?? [])
    setAllPlayers(playersData ?? [])
    setLoading(false)
  }

  const getStreak = (games: any[], sport: string) => {
    const sportGames = games.filter(g => g.sport === sport)
    if (sportGames.length === 0) return null
    const first = sportGames[0].result
    let count = 0
    for (const g of sportGames) {
      if (g.result === first) count++
      else break
    }
    return { type: first, count }
  }

  const getH2H = (opponentName: string, sport: string) => {
    const h2hGames = games.filter(g => g.sport === sport && g.opponent_name === opponentName)
    const wins = h2hGames.filter(g => g.result === 'win').length
    const losses = h2hGames.filter(g => g.result === 'loss').length
    return { wins, losses, total: h2hGames.length }
  }

  const player = bball || pickle
  const isMe = user?.id === id
  const accent = activeSport === 'basketball' ? '#FF6B1A' : '#39FF6A'
  const activeRecord = activeSport === 'basketball' ? bball : pickle
  const filteredGames = games.filter(g => g.sport === activeSport)
  const streak = getStreak(games, activeSport)

  const uniqueOpponents = [...new Set(
    games.filter(g => g.sport === activeSport && g.opponent_name).map(g => g.opponent_name)
  )]

  const h2h = h2hPlayer ? getH2H(h2hPlayer, activeSport) : null

  const pct = activeRecord
    ? activeRecord.wins + activeRecord.losses > 0
      ? Math.round((activeRecord.wins / (activeRecord.wins + activeRecord.losses)) * 100)
      : 0
    : 0

  if (loading) return (
    <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '4px', color: '#666' }}>LOADING...</span>
    </div>
  )

  if (!player) return (
    <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '4px', color: '#666' }}>PLAYER NOT FOUND</span>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root { --black: #080808; --card: #161616; --border: #1e1e1e; --white: #f0f0f0; --gray: #666; }
        body { background: var(--black); color: var(--white); font-family: 'Barlow', sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeUp 0.5s ease forwards; }
        .sport-btn { transition: all 0.18s ease; }
        .sport-btn:hover { opacity: 0.85; }
        .game-row:hover { background: #1c1c1c !important; }
        select { -webkit-appearance: none; appearance: none; }
        select option { background: #161616; }
      `}</style>

      <div style={{ background: 'var(--black)', minHeight: '100vh' }}>

        <header style={{
          borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(8,8,8,0.95)',
          backdropFilter: 'blur(12px)', zIndex: 50,
        }}>
          <a href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '4px', textDecoration: 'none', color: 'var(--white)' }}>
            RUN<span style={{ color: accent }}>IQ</span>
          </a>
          <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gray)', textDecoration: 'none' }}>
            ← Back to Rankings
          </a>
        </header>

        <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem' }}>

          {/* PLAYER HEADER */}
          <div className="fade-in" style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 64, height: 64, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: '#000' }}>
                  {player.name?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', letterSpacing: '3px', lineHeight: 1 }}>
                    {player.name}
                  </h1>
                  {isMe && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', background: accent, color: '#000', padding: '0.15rem 0.4rem' }}>YOU</span>
                  )}
                  {streak && streak.count >= 2 && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', background: streak.type === 'win' ? '#39FF6A' : '#e74c3c', color: streak.type === 'win' ? '#000' : '#fff', padding: '0.2rem 0.5rem' }}>
                      {streak.type === 'win' ? '🔥' : '❄️'} {streak.count} {streak.type.toUpperCase()} STREAK
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', color: 'var(--gray)', letterSpacing: '1px' }}>RUNIQ Player</div>
              </div>
            </div>
          </div>

          {/* SPORT TOGGLE */}
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '2rem' }}>
            {[
              { id: 'basketball', label: '🏀 Basketball', color: '#FF6B1A' },
              { id: 'pickleball', label: '🏓 Pickleball', color: '#39FF6A' },
            ].map(({ id, label, color }) => (
              <button key={id} className="sport-btn" onClick={() => setActiveSport(id)} style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.88rem',
                letterSpacing: '2px', textTransform: 'uppercase', padding: '0.6rem 1.5rem',
                border: 'none', cursor: 'pointer',
                background: activeSport === id ? color : 'transparent',
                color: activeSport === id ? '#000' : 'var(--gray)',
                borderRight: id === 'basketball' ? '1px solid var(--border)' : 'none',
              }}>{label}</button>
            ))}
          </div>

          {/* STAT CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
            {[
              { label: 'Wins',   value: activeRecord?.wins ?? 0 },
              { label: 'Losses', value: activeRecord?.losses ?? 0 },
              { label: 'Record', value: `${activeRecord?.wins ?? 0}-${activeRecord?.losses ?? 0}` },
              { label: 'Win %',  value: `${pct}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--card)', padding: '1.25rem 1rem' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.3rem' }}>{label}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', lineHeight: 1, color: label === 'Win %' ? pct >= 70 ? '#39FF6A' : pct >= 50 ? '#FF6B1A' : 'var(--gray)' : 'var(--white)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* STREAK */}
          {streak && (
            <div style={{
              background: streak.type === 'win' ? 'rgba(57,255,106,0.06)' : 'rgba(231,76,60,0.06)',
              border: `1px solid ${streak.type === 'win' ? 'rgba(57,255,106,0.2)' : 'rgba(231,76,60,0.2)'}`,
              padding: '1rem 1.25rem', marginBottom: '2rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
              <span style={{ fontSize: '1.5rem' }}>{streak.type === 'win' ? '🔥' : '❄️'}</span>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '2px', color: streak.type === 'win' ? '#39FF6A' : '#e74c3c' }}>
                  {streak.count} GAME {streak.type.toUpperCase()} STREAK
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', color: 'var(--gray)', letterSpacing: '1px' }}>
                  Current {activeSport} streak
                </div>
              </div>
            </div>
          )}

          {/* HEAD TO HEAD */}
          {uniqueOpponents.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '3px', marginBottom: '1rem' }}>
                Head-to-Head
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <select value={h2hPlayer} onChange={e => setH2hPlayer(e.target.value)} style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  color: h2hPlayer ? 'var(--white)' : 'var(--gray)',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                  fontSize: '0.9rem', letterSpacing: '1px',
                  padding: '0.6rem 2rem 0.6rem 0.85rem', cursor: 'pointer', minWidth: 200,
                }}>
                  <option value="">Select opponent...</option>
                  {uniqueOpponents.map(name => (
                    <option key={name as string} value={name as string}>{name as string}</option>
                  ))}
                </select>
              </div>

              {h2h && h2hPlayer && (
                <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: '0.5rem' }}>
                      {player.name} vs {h2hPlayer}
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: '#39FF6A', lineHeight: 1 }}>{h2h.wins}</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)' }}>Wins</div>
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--border)' }}>—</div>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: '#e74c3c', lineHeight: 1 }}>{h2h.losses}</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)' }}>Losses</div>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: accent, lineHeight: 1 }}>
                          {h2h.total > 0 ? Math.round((h2h.wins / h2h.total) * 100) : 0}%
                        </div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)' }}>Win Rate</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME HISTORY */}
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '3px', marginBottom: '1rem' }}>Game History</div>
            {filteredGames.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gray)', letterSpacing: '1px' }}>No games recorded yet</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 140px', padding: '0.45rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  {['RESULT', 'OPPONENT', 'SPORT', 'DATE'].map((h, i) => (
                    <div key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', textAlign: i > 1 ? 'center' : 'left' }}>{h}</div>
                  ))}
                </div>
                {filteredGames.map(game => (
                  <div key={game.id} className="game-row" style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 80px 140px',
                    alignItems: 'center', padding: '0.85rem 1rem',
                    background: 'var(--card)', transition: 'background 0.15s',
                    borderLeft: `2px solid ${game.result === 'win' ? '#39FF6A' : '#e74c3c'}`,
                  }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '2px', color: game.result === 'win' ? '#39FF6A' : '#e74c3c' }}>
                      {game.result === 'win' ? 'WIN' : 'LOSS'}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: '0.95rem', color: game.opponent_name ? 'var(--white)' : 'var(--gray)' }}>
                      {game.opponent_name ?? 'Unknown'}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', color: 'var(--gray)', textAlign: 'center' }}>
                      {game.sport === 'basketball' ? '🏀' : '🏓'}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', color: 'var(--gray)', textAlign: 'center' }}>
                      {new Date(game.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}<button onClick={() => { navigator.clipboard.writeText(window.location.href); }} style={{
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: '0.78rem', letterSpacing: '2px', textTransform: 'uppercase',
  padding: '0.45rem 1.1rem', border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--gray)', cursor: 'pointer',
}}>🔗 Share Profile</button>