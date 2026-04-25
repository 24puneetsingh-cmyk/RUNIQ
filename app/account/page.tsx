import { UserProfile } from '@clerk/nextjs'

export default function AccountPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '4rem',
      paddingBottom: '4rem',
    }}>
      <div style={{ marginBottom: '2rem', alignSelf: 'flex-start', paddingLeft: '2rem' }}>
        <a href="/" style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '3px', textTransform: 'uppercase',
          color: '#666', textDecoration: 'none',
        }}>← Back to Rankings</a>
      </div>
      <UserProfile routing="hash" />
    </div>
  )
}