import { useState } from 'react'
import styles from './BingoCard.module.css'

export type BingoCardProps = {
  text: string
  /** Background color for the card (any valid CSS color) */
  backgroundColor?: string
  /** Text color (any valid CSS color) */
  textColor?: string
  onClick?: () => void
  /** When provided, the card becomes an editable textarea */
  editable?: boolean
  onTextChange?: (nextText: string) => void

  /** Show a toss button and play the toss animation when clicked */
  tossable?: boolean

  /** Called when user clicks Toss (after animation starts) */
  onContribute?: (cardEl: HTMLElement) => void
}

export function BingoCard({
  text,
  backgroundColor = '#FFF4E6',
  textColor = '#2b2b2b',
  onClick,
  editable = false,
  onTextChange,
  tossable = false,
  onContribute,
}: BingoCardProps) {
  const [isTossing, setIsTossing] = useState(false)

  if (editable) {
    return (
      <div
        ref={(el) => {
          // keep react happy; no-op. (we pass element to contribute callback via event)
          void el
        }}
        className={[styles.card, isTossing ? styles.toss : ''].filter(Boolean).join(' ')}
        style={{ backgroundColor, color: textColor }}
        onAnimationEnd={() => setIsTossing(false)}
      >
        <textarea
          className={styles.textarea}
          value={text}
          placeholder="Type…"
          onChange={(e) => onTextChange?.(e.target.value)}
        />
        {tossable ? (
          <button
            type="button"
            className={styles.tossButton}
            onClick={(e) => {
              const cardEl = e.currentTarget.closest(`.${styles.card}`) as HTMLElement | null
              // Animate only after API success; for now, we just request contribution.
              if (cardEl) onContribute?.(cardEl)
            }}
            aria-label="Contribute"
          >
            Contribute
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={styles.card}
      onClick={onClick}
      style={{ backgroundColor, color: textColor }}
    >
      <span className={styles.text}>{text}</span>
    </button>
  )
}
