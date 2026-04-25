'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const ADMIN_ID = 'user_3CjHsnbqk9NGASNK5ruWCrpioNR'

export default function AdminPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [players, setPlayers] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'players' | 'games'>('players')
  const [editingPlayer, setEditingPlayer] = useState<any>(null)
  const [editWins, setEditWins] = useState('')
  const [editLosses, setEditLosses] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (isLoaded && user?.id !== ADMIN_ID) {
      router.push('/')
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (isLoaded && user?.id === ADMIN_ID) {
      fetchAll()
    }
  }, [isLoaded, user])

  const fetchAll = async () => {
    const { data: p } = await supabase.from('players').select('*').order('created_at', { ascending: false })
    const { data: g } = await supabase.from('games').select('*').order('created_at', { ascending: false }).limit(100)
    if (p) setPlayers(p)
    if (g) setGames(g)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const startEdit = (player: any) => {
    setEditingPlayer(player)
    setEditWins(player.wins.toString())
    setEditLosses(player.losses.toString())
  }

  const saveEdit = async () => {
    if (!editingPlayer) return
    setSaving(true)
    await supabase.from('players').update({
      wins: parseInt(editWins) || 0,
      losses: parseInt(editLosses) || 0,
    }).eq('id', editingPlayer.id)
    setEditingPlayer(null)
    await fetchAll()
    setSaving(false)
    showToast('Record updated.')
  }

  const deletePlayer = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This removes both their basketball and pickleball records.`)) return
    await supabase.from('players').delete().eq('id', id)
    await fetchAll()
    showToast(`${name} deleted.`)
  }

  const deleteGame = async (id: string) => {
    if (!confirm('Delete this game? This will NOT auto-adjust player records.')) return
    await supabase.from('games').delete().eq('id', id)
    await fetchAll()
    showToast('Game deleted.')
  }

  const resetPlayer = async (player: any) => {
    if (!confirm(`Reset ${player.name}'s ${player.sport} record to 0-0?`)) return
    await supabase.from('players').update({ wins: 0, losses: 0 }).eq('id', player.id)
    await fetchAll()
    showToast(`${player.name} reset to 0-0.`)
  }

  if (!isLoaded) return (
    <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'monospace', color: '#666' }}>Loading...</span>
    </div>
  )

  if (user?.id !== ADMIN_ID) return null

  const basketball = players.filter(p => p.sport === 'basketball')
  const pickleball = players.filter(p => p.sport === 'pickleball')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root { --black: #080808; --card: #161616; --border: #1e1e1e; --white: #f0f0f0; --gray: #666; }
        body { background: var(--black); color: var(--white); font-family: 'Barlow', sans-serif; -webkit-font-smoothing: antialiased; }
        .action-btn { transition: all 0.15s ease; cursor: pointer; }
        .action-btn:hover { opacity: 0.85; }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .row:hover { background: #1a1a1a !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .toast { animation: fadeUp 0.3s ease; }
      `}</style>

      <div style={{ background: 'var(--black)', minHeight: '100vh' }}>

        {/* HEADER */}
        <header style={{
          borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(12px)', zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '4px', textDecoration: 'none', color: 'var(--white)' }}>
              RUN<span style={{ color: '#FF6B1A' }}>IQ</span>
            </a>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem',
              fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
              background: '#e74c3c', color: '#fff', padding: '0.2rem 0.5rem',
            }}>ADMIN</span>
          </div>
          <a href="/" style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.75rem',
            fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase',
            color: 'var(--gray)', textDecoration: 'none',
          }}>← Back to Site</a>
        </header>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 2rem' }}>

          {/* TABS */}
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '2rem' }}>
            {[['players', 'Players'], ['games', 'Games']].map(([t, l]) => (
              <button key={t} className="action-btn" onClick={() => setActiveTab(t as 'players' | 'games')} style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase',
                padding: '0.6rem 1.5rem', border: 'none',
                background: activeTab === t ? '#FF6B1A' : 'transparent',
                color: activeTab === t ? '#000' : 'var(--gray)',
                borderRight: t === 'players' ? '1px solid var(--border)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {/* PLAYERS TAB */}
          {activeTab === 'players' && (
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '3px', marginBottom: '1.5rem' }}>
                Manage Players
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', fontWeight: 600, letterSpacing: '2px', color: 'var(--gray)', marginLeft: '1rem' }}>
                  {basketball.length} basketball · {pickleball.length} pickleball
                </span>
              </div>

              {/* BASKETBALL */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem',
                  fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#FF6B1A', marginBottom: '0.75rem',
                }}>🏀 Basketball</div>

                <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 160px', padding: '0.5rem 1rem', background: '#0f0f0f', borderBottom: '1px solid var(--border)' }}>
                    {['Player', 'W', 'L', 'Win%', 'Actions'].map((h, i) => (
                      <div key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', textAlign: i > 0 ? 'center' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {basketball.map(p => {
                    const gp = p.wins + p.losses
                    const pct = gp ? Math.round((p.wins / gp) * 100) : 0
                    const isEditing = editingPlayer?.id === p.id
                    return (
                      <div key={p.id} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 160px', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', alignItems: 'center', background: 'var(--card)' }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</div>

                        {isEditing ? (
                          <>
                            <input type="number" value={editWins} onChange={e => setEditWins(e.target.value)} style={{ background: '#222', border: '1px solid #444', color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', padding: '0.3rem 0.5rem', textAlign: 'center', width: '60px' }} />
                            <input type="number" value={editLosses} onChange={e => setEditLosses(e.target.value)} style={{ background: '#222', border: '1px solid #444', color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', padding: '0.3rem 0.5rem', textAlign: 'center', width: '60px' }} />
                            <div style={{ textAlign: 'center', color: 'var(--gray)', fontFamily: "'Barlow Condensed', sans-serif" }}>—</div>
                          </>
                        ) : (
                          <>
                            <div style={{ textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{p.wins}</div>
                            <div style={{ textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gray)' }}>{p.losses}</div>
                            <div style={{ textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: pct >= 70 ? '#39FF6A' : pct >= 50 ? '#FF6B1A' : 'var(--gray)' }}>{pct}%</div>
                          </>
                        )}

                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          {isEditing ? (
                            <>
                              <button className="action-btn" onClick={saveEdit} disabled={saving} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#39FF6A', color: '#000', cursor: 'pointer' }}>
                                {saving ? '...' : 'Save'}
                              </button>
                              <button className="action-btn" onClick={() => setEditingPlayer(null)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray)', cursor: 'pointer' }}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="action-btn" onClick={() => startEdit(p)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#FF6B1A', color: '#000', cursor: 'pointer' }}>
                                Edit
                              </button>
                              <button className="action-btn" onClick={() => resetPlayer(p)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray)', cursor: 'pointer' }}>
                                Reset
                              </button>
                              <button className="action-btn" onClick={() => deletePlayer(p.id, p.name)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#e74c3c', color: '#fff', cursor: 'pointer' }}>
                                Del
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* PICKLEBALL */}
              <div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem',
                  fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase',
                  color: '#39FF6A', marginBottom: '0.75rem',
                }}>🏓 Pickleball</div>

                <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 160px', padding: '0.5rem 1rem', background: '#0f0f0f', borderBottom: '1px solid var(--border)' }}>
                    {['Player', 'W', 'L', 'Win%', 'Actions'].map((h, i) => (
                      <div key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', textAlign: i > 0 ? 'center' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {pickleball.map(p => {
                    const gp = p.wins + p.losses
                    const pct = gp ? Math.round((p.wins / gp) * 100) : 0
                    const isEditing = editingPlayer?.id === p.id
                    return (
                      <div key={p.id} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 160px', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', alignItems: 'center', background: 'var(--card)' }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</div>

                        {isEditing ? (
                          <>
                            <input type="number" value={editWins} onChange={e => setEditWins(e.target.value)} style={{ background: '#222', border: '1px solid #444', color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', padding: '0.3rem 0.5rem', textAlign: 'center', width: '60px' }} />
                            <input type="number" value={editLosses} onChange={e => setEditLosses(e.target.value)} style={{ background: '#222', border: '1px solid #444', color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', padding: '0.3rem 0.5rem', textAlign: 'center', width: '60px' }} />
                            <div style={{ textAlign: 'center', color: 'var(--gray)', fontFamily: "'Barlow Condensed', sans-serif" }}>—</div>
                          </>
                        ) : (
                          <>
                            <div style={{ textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{p.wins}</div>
                            <div style={{ textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gray)' }}>{p.losses}</div>
                            <div style={{ textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: pct >= 70 ? '#39FF6A' : pct >= 50 ? '#FF6B1A' : 'var(--gray)' }}>{pct}%</div>
                          </>
                        )}

                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          {isEditing ? (
                            <>
                              <button className="action-btn" onClick={saveEdit} disabled={saving} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#39FF6A', color: '#000', cursor: 'pointer' }}>
                                {saving ? '...' : 'Save'}
                              </button>
                              <button className="action-btn" onClick={() => setEditingPlayer(null)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray)', cursor: 'pointer' }}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="action-btn" onClick={() => startEdit(p)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#FF6B1A', color: '#000', cursor: 'pointer' }}>
                                Edit
                              </button>
                              <button className="action-btn" onClick={() => resetPlayer(p)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray)', cursor: 'pointer' }}>
                                Reset
                              </button>
                              <button className="action-btn" onClick={() => deletePlayer(p.id, p.name)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#e74c3c', color: '#fff', cursor: 'pointer' }}>
                                Del
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* GAMES TAB */}
          {activeTab === 'games' && (
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '3px', marginBottom: '1.5rem' }}>
                Game History
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', fontWeight: 600, letterSpacing: '2px', color: 'var(--gray)', marginLeft: '1rem' }}>
                  {games.length} recent games
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 80px 120px 80px', padding: '0.5rem 1rem', background: '#0f0f0f', borderBottom: '1px solid var(--border)' }}>
                  {['Player', 'Opponent', 'Sport', 'Result', 'Date', 'Action'].map((h, i) => (
                    <div key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gray)', textAlign: i > 1 ? 'center' : 'left' }}>{h}</div>
                  ))}
                </div>

                {games.map(g => (
                  <div key={g.id} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 80px 120px 80px', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', alignItems: 'center', background: 'var(--card)' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.9rem' }}>{g.player_name}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', color: 'var(--gray)' }}>{g.opponent_name ?? '—'}</div>
                    <div style={{ textAlign: 'center', fontSize: '1rem' }}>{g.sport === 'basketball' ? '🏀' : '🏓'}</div>
                    <div style={{ textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '1px', color: g.result === 'win' ? '#39FF6A' : '#e74c3c' }}>
                      {g.result === 'win' ? 'WIN' : 'LOSS'}
                    </div>
                    <div style={{ textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', color: 'var(--gray)' }}>
                      {new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className="action-btn" onClick={() => deleteGame(g.id)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: 'none', background: '#e74c3c', color: '#fff', cursor: 'pointer' }}>
                        Del
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--white)', color: '#000',
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase',
          padding: '0.75rem 2rem', zIndex: 9999,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      )}
    </>
  )
}