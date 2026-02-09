import { useMemo, useRef, useState } from 'react'
import './App.css'
import { BingoBoard } from './components/BingoBoard'
import { CommunityCarousel, type CommunityCarouselCard } from './components/CommunityCarousel'
import { createPortal } from 'react-dom'

type MagicLinkResponse = { magicLink: string }
type MagicLinkCallbackResponse = { token: string; userId: string; email: string }

type BoardCard = { id: string; text: string; backgroundColor: string }

type FlyGhost = {
  id: string
  text: string
  backgroundColor: string
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
}

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

const DEFAULT_COMMUNITY_CARDS: CommunityCarouselCard[] = Array.from({ length: 15 }, (_, i) => ({
  id: `default-${i + 1}`,
  text: [
    'Tangled yarn? Breathe.',
    'Try a new stitch today',
    'Knit 5 rows mindfully',
    'Fix one tiny mistake',
    'Cast on something bold',
    'Swatch before you commit',
    'Take a progress photo',
    'Block it. Trust the process.',
    'Weave in ends (future you says thanks)',
    'Celebrate small wins',
    'Learn one new technique',
    'Use the fancy yarn',
    'Count your stitches twice',
    'Make it cozy',
    'Toss perfectionism into the universe',
  ][i]!,
  backgroundColor: DEFAULT_COLORS[i % DEFAULT_COLORS.length]!,
}))

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
  const [magicCode, setMagicCode] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [communityCards, setCommunityCards] = useState<CommunityCarouselCard[]>(() => DEFAULT_COMMUNITY_CARDS)
  const [toast, setToast] = useState<string | null>(null)
  const [pulseEmail, setPulseEmail] = useState(false)
  const [flyGhost, setFlyGhost] = useState<FlyGhost | null>(null)
  const flyLayerRef = useRef<HTMLDivElement | null>(null)

  const [draftBoard, setDraftBoard] = useState<BoardCard[]>(() => createEmptyBoard())
  const [savedBoard, setSavedBoard] = useState<BoardCard[]>(() => createEmptyBoard())

  const emailHasPlus = email.includes('+')
  const hasUnsavedChanges = JSON.stringify(draftBoard) !== JSON.stringify(savedBoard)

  const lavender = '#EDE4FF'
  const lavenderHover = '#E7DAFF'
  const violet = '#5A2CA0'
  const violetDeep = '#4A1F87'
  const cream = '#FFF7E8'

  const primaryButtonStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    background: lavender,
    border: `2px solid ${violet}`,
    color: violetDeep,
    fontWeight: 800,
    cursor: 'pointer',
  }

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
    setMagicLink("you can't see this")
    setMagicCode('')
  }

  async function saveBoardToBackend() {
    setError(null)
    if (!apiUrl) {
      setError('Missing VITE_API_URL (set it in frontend/.env)')
      return
    }
    if (!token) {
      showAuthToast()
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

  async function loadCommunityCards() {
    if (!apiUrl) return
    const resp = await fetch(`${apiUrl}community/cards`)
    const data = (await resp.json()) as { cards?: CommunityCarouselCard[] }
    if (resp.ok && Array.isArray(data.cards)) {
      setCommunityCards(data.cards.length ? data.cards : DEFAULT_COMMUNITY_CARDS)
    }
  }

  async function contributeCardToCommunity(index: number, cardEl: HTMLElement) {
    if (!apiUrl) return
    if (!token) {
      showAuthToast()
      return
    }
    const card = draftBoard[index]
    if (!card) return
    const resp = await fetch(`${apiUrl}contribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ card }),
    })

    if (resp.ok) {
      const rect = cardEl.getBoundingClientRect()
      const scroller = document.querySelector('[data-community-scroller]') as HTMLElement | null
      const toRect = scroller?.getBoundingClientRect()
      if (toRect) {
        setFlyGhost({
          id: crypto.randomUUID(),
          text: card.text,
          backgroundColor: card.backgroundColor,
          from: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
          to: { x: toRect.left + 36, y: toRect.top + 48 },
        })
      }
    }
    // Refresh carousel (don’t clear local card)
    await loadCommunityCards()
  }

  function showAuthToast() {
    setToast('Log in to contribute and save your bingo.')
    setPulseEmail(true)
    window.setTimeout(() => setPulseEmail(false), 900)
    // Auto-dismiss toast
    window.setTimeout(() => setToast(null), 2800)
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        onCanPlay={(e) => {
          // slow down playback for a calmer background
          ;(e.currentTarget as HTMLVideoElement).playbackRate = 0.1
        }}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          /* tile video rather than scaling it */
          objectFit: 'none',
          objectPosition: 'center',
          zIndex: -2,
        }}
        src="/chamomile%20float.mp4"
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(2px)',
          zIndex: -1,
        }}
      />

      <div style={{ display: 'flex', maxWidth: 1040, margin: '0 auto', gap: 28 }}>
      <div style={{ flex: 1, padding: 24, textAlign: 'left' }}>
      <h1
        style={{
          marginTop: 0,
          fontFamily: 'ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: -0.2,
          color: lavender,
          WebkitTextStroke: `2px ${violet}`,
          textShadow: '0 10px 24px rgba(90, 44, 160, 0.22)',
          opacity: 0.88,
        }}
      >
        Make Your Own Knitting Bingo
      </h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0' }}>
        <button
          type="button"
          onClick={saveBoardToBackend}
          disabled={!hasUnsavedChanges || !token}
          style={{
            ...primaryButtonStyle,
            opacity: !hasUnsavedChanges || !token ? 0.6 : 1,
          }}
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
          onCardContribute={contributeCardToCommunity}
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
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 6,
          border: `2px solid ${violet}`,
          background: cream,
          color: violetDeep,
          outline: pulseEmail ? '3px solid rgba(164, 214, 255, 0.85)' : undefined,
          boxShadow: pulseEmail ? '0 0 0 6px rgba(164, 214, 255, 0.22)' : undefined,
          transition: 'box-shadow 200ms ease, outline 200ms ease',
        }}
      />
      {emailHasPlus ? (
        <div style={{ color: 'crimson', marginTop: 8 }}>Email must not contain '+' characters.</div>
      ) : null}

      {!magicLink ? (
        <button
          onClick={requestMagicLink}
          style={{
            ...primaryButtonStyle,
            marginTop: 12,
          }}
          disabled={!email || emailHasPlus}
        >
          Send magic code
        </button>
      ) : null}

      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}

      {magicLink ? (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Enter magic code</label>
          <input
            value={magicCode}
            onChange={(e) => setMagicCode(e.target.value)}
            placeholder="Paste code from your email"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
          />

          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              style={{
                ...primaryButtonStyle,
                padding: '8px 12px',
              }}
              onClick={async () => {
                try {
                  setError(null)
                  if (!apiUrl) throw new Error('Missing VITE_API_URL')
                  const code = magicCode.trim()
                  if (!code) throw new Error('Enter your magic code')
                  const resp = await fetch(`${apiUrl}auth/magic-link-callback?code=${encodeURIComponent(code)}`)
                  const data = (await resp.json()) as Partial<MagicLinkCallbackResponse> & { message?: string }
                  if (!resp.ok || !data.token) {
                    throw new Error(data.message ?? `Verification failed (${resp.status})`)
                  }
                  setToken(data.token)
                  await loadCommunityCards()
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              Verify & log in
            </button>

            <button
              type="button"
              style={{
                ...primaryButtonStyle,
                padding: '8px 12px',
                background: lavenderHover,
              }}
              onClick={() => {
                // allow restarting the flow
                setMagicLink(null)
                setMagicCode('')
              }}
            >
              Start over
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            We sent you a code. Paste it here to sign in.
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            background: 'rgba(20,20,20,0.9)',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            zIndex: 2000,
          }}
          role="status"
          onAnimationEnd={() => setToast(null)}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div>{toast}</div>
            <button
              type="button"
              onClick={() => setToast(null)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'white',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      </div>

      <CommunityCarousel cards={communityCards} />

      {createPortal(
        <div
          ref={flyLayerRef}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2500,
          }}
        >
          {flyGhost ? (
            <div
              style={{
                position: 'absolute',
                left: flyGhost.from.x,
                top: flyGhost.from.y,
                width: flyGhost.from.w,
                height: flyGhost.from.h,
                transformOrigin: 'top left',
                background: flyGhost.backgroundColor,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                textAlign: 'center',
                padding: 14,
                boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
                animation: 'contributeFly 520ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards',
              }}
              onAnimationEnd={() => setFlyGhost(null)}
            >
              {flyGhost.text}
            </div>
          ) : null}
          <style>
            {flyGhost
              ? `
            @keyframes contributeFly {
              0% {
                transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
              }
              65% {
                transform:
                  translate3d(${flyGhost.to.x - flyGhost.from.x}px, ${flyGhost.to.y - flyGhost.from.y - 30}px, 0)
                  rotate(6deg)
                  scale(0.85);
              }
              100% {
                transform:
                  translate3d(${flyGhost.to.x - flyGhost.from.x}px, ${flyGhost.to.y - flyGhost.from.y}px, 0)
                  rotate(10deg)
                  scale(0.28);
                filter: blur(0.4px);
                opacity: 0;
              }
            }
          `
              : ''}
          </style>
        </div>,
        document.body
      )}
      </div>
    </div>
  )
}

export default App
