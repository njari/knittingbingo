import { useMemo, useState } from 'react'
import './App.css'
import { BingoBoard } from './components/BingoBoard'

type MagicLinkResponse = { magicLink: string }
type MagicLinkCallbackResponse = { token: string; userId: string; email: string }

type BoardCard = { id: string; text: string; backgroundColor: string }

const DEFAULT_COLORS = [
  '#FFF4E6',
  '#F3F8FF',
  '#F7F0FF',
  '#F0FFF6',
  '#FFF0F5',
  '#FFF8E1',
  '#EAF7F7',
  '#F5F5FF',
  '#FFF1E6',
]

function createEmptyBoard(): BoardCard[] {
  return Array.from({ length: 9 }, (_, i) => ({
    id: String(i + 1),
    text: '',
    backgroundColor: DEFAULT_COLORS[i]!,
  }))
}

function App() {
  const apiUrl = useMemo(() => import.meta.env.VITE_API_URL as string | undefined, [])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const [draftBoard, setDraftBoard] = useState<BoardCard[]>(() => createEmptyBoard())
  const [savedBoard, setSavedBoard] = useState<BoardCard[]>(() => createEmptyBoard())

  const emailHasPlus = email.includes('+')
  const hasUnsavedChanges = JSON.stringify(draftBoard) !== JSON.stringify(savedBoard)

  async function requestMagicLink() {
    setError(null)
    setMagicLink(null)
    if (!apiUrl) {
      setError('Missing VITE_API_URL (set it in frontend/.env)')
      return
    }
    if (emailHasPlus) {
      setError("Email must not contain '+'")
      return
    }

    const resp = await fetch(`${apiUrl}auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = (await resp.json()) as Partial<MagicLinkResponse> & { message?: string }
    if (!resp.ok) {
      setError(data.message ?? `Request failed (${resp.status})`)
      return
    }
    if (!data.magicLink) {
      setError('No magic link returned by API')
      return
    }
    setMagicLink(data.magicLink)
  }

  async function saveBoardToBackend() {
    setError(null)
    if (!apiUrl) {
      setError('Missing VITE_API_URL (set it in frontend/.env)')
      return
    }
    if (!token) {
      setError('You must log in first (missing magic-link token).')
      return
    }
    const resp = await fetch(`${apiUrl}bingo3x3`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cards: draftBoard }),
    })
    const data = (await resp.json()) as { ok?: boolean; message?: string }
    if (!resp.ok) {
      setError(data.message ?? `Save failed (${resp.status})`)
      return
    }
    setSavedBoard(draftBoard)
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 24, textAlign: 'left' }}>
      <h1>Knit Bingo</h1>
      <p>Sign in with a magic link (simulated for now).</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0' }}>
        <button
          type="button"
          onClick={saveBoardToBackend}
          disabled={!hasUnsavedChanges || !token}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Save
        </button>
        {!token ? <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to save</div> : null}
        {token && hasUnsavedChanges ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Unsaved changes</div>
        ) : null}
      </div>

      <div style={{ margin: '12px 0 20px' }}>
        <BingoBoard
          cards={draftBoard}
          editable
          tossable
          onCardTextChange={(index, nextText) => {
            setDraftBoard((prev) => {
              const next = [...prev]
              next[index] = { ...next[index]!, text: nextText }
              return next
            })
          }}
        />
      </div>

      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        type="email"
        style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
      />
      {emailHasPlus ? (
        <div style={{ color: 'crimson', marginTop: 8 }}>Email must not contain '+' characters.</div>
      ) : null}

      <button
        onClick={requestMagicLink}
        style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6 }}
        disabled={!email || emailHasPlus}
      >
        Send magic link
      </button>

      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}

      {magicLink ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600 }}>Magic link (simulated):</div>
          <a href={magicLink} style={{ wordBreak: 'break-all' }}>
            {magicLink}
          </a>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              style={{ padding: '8px 12px', borderRadius: 6 }}
              onClick={async () => {
                try {
                  setError(null)
                  if (!apiUrl) throw new Error('Missing VITE_API_URL')
                  const url = new URL(magicLink, window.location.origin)
                  const code = url.searchParams.get('code')
                  if (!code) throw new Error('Missing code in magic link')
                  const resp = await fetch(`${apiUrl}auth/magic-link-callback?code=${encodeURIComponent(code)}`)
                  const data = (await resp.json()) as Partial<MagicLinkCallbackResponse> & { message?: string }
                  if (!resp.ok || !data.token) {
                    throw new Error(data.message ?? `Callback failed (${resp.status})`)
                  }
                  setToken(data.token)
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              Simulate clicking link (log in)
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            Note: this link is relative; once deployed you’ll want to create a full URL and email it.
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
