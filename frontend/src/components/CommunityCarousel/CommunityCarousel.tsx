import { useEffect, useMemo, useRef, useState } from 'react'
import { BingoCard } from '../BingoCard'
import styles from './CommunityCarousel.module.css'

export type CommunityCarouselCard = {
  id: string
  text: string
  backgroundColor?: string
  textColor?: string
}

export function CommunityCarousel({ cards }: { cards: CommunityCarouselCard[] }) {
  const [activeId, setActiveId] = useState<string | null>(cards[0]?.id ?? null)
  const [isPaused, setIsPaused] = useState(false)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Duplicate to create an infinite loop effect
  const loopCards = useMemo(() => [...cards, ...cards], [cards])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    let raf = 0
    const speedPxPerFrame = 0.35

    const tick = () => {
      if (!isPaused) {
        el.scrollTop += speedPxPerFrame
        // When we pass the first half, jump back by half height (seamless enough)
        const half = el.scrollHeight / 2
        if (el.scrollTop >= half) {
          el.scrollTop -= half
        }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPaused])

  return (
    <aside className={styles.wrap}>
      <div className={styles.title}>Community</div>
      <div
        className={styles.scroller}
        ref={scrollerRef}
        data-community-scroller
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {loopCards.map((c, idx) => (
          <div key={`${c.id}-${idx}`} className={styles.cardWrap}>
            <button
              type="button"
              className={[styles.peek, activeId === c.id ? styles.peekActive : ''].filter(Boolean).join(' ')}
              onClick={() => setActiveId(c.id)}
            >
              <BingoCard
                text={activeId === c.id ? c.text : ''}
                backgroundColor={c.backgroundColor}
                textColor={c.textColor}
              />
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
