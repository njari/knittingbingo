import { BingoCard } from '../BingoCard'
import styles from './BingoBoard.module.css'

export type BingoBoardCard = {
  id: string
  text: string
  backgroundColor?: string
  textColor?: string
}

export type BingoBoardProps = {
  cards: BingoBoardCard[]
  editable?: boolean
  onCardTextChange?: (index: number, nextText: string) => void
  tossable?: boolean
  onCardToss?: (index: number) => void
}

export function BingoBoard({
  cards,
  editable = false,
  onCardTextChange,
  tossable = false,
  onCardToss,
}: BingoBoardProps) {
  if (cards.length !== 9) {
    // Keep it strict for v1: 3x3 only
    throw new Error(`BingoBoard expects exactly 9 cards, got ${cards.length}`)
  }

  return (
    <div className={styles.board}>
      {cards.map((c, idx) => (
        <BingoCard
          key={c.id}
          text={c.text}
          backgroundColor={c.backgroundColor}
          textColor={c.textColor}
          editable={editable}
          tossable={tossable}
          onToss={() => onCardToss?.(idx)}
          onTextChange={(next) => onCardTextChange?.(idx, next)}
        />
      ))}
    </div>
  )
}
