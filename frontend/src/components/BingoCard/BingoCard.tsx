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
  onToss?: () => void
}

export function BingoCard({
  text,
  backgroundColor = '#FFF4E6',
  textColor = '#2b2b2b',
  onClick,
  editable = false,
  onTextChange,
  tossable = false,
  onToss,
}: BingoCardProps) {
  const [isTossing, setIsTossing] = useState(false)

  function toss() {
    if (isTossing) return
    setIsTossing(true)
    onToss?.()
  }

  if (editable) {
    return (
      <div
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
          <button type="button" className={styles.tossButton} onClick={toss} aria-label="Toss">
            Toss
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
