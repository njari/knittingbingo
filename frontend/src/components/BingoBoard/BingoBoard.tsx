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
  onCardContribute?: (index: number, cardEl: HTMLElement) => void
  onDropCommunityCard?: (index: number, card: { id: string; text: string; backgroundColor?: string }) => void
}

export function BingoBoard({
  cards,
  editable = false,
  onCardTextChange,
  tossable = false,
  onCardContribute,
  onDropCommunityCard,
}: BingoBoardProps) {
  if (cards.length !== 9) {
    // Keep it strict for v1: 3x3 only
    throw new Error(`BingoBoard expects exactly 9 cards, got ${cards.length}`)
  }

  return (
    <div className={styles.board}>
      {cards.map((c, idx) => (
        <div
          key={c.id}
          onDragOver={(e) => {
            if (!onDropCommunityCard) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            if (!onDropCommunityCard) return
            e.preventDefault()
            try {
              const raw = e.dataTransfer.getData('application/knit-bingo-card')
              if (!raw) return
              const card = JSON.parse(raw) as { id: string; text: string; backgroundColor?: string }
              if (!card?.id) return
              onDropCommunityCard(idx, card)
            } catch {
              // ignore
            }
          }}
        >
          <BingoCard
            text={c.text}
            backgroundColor={c.backgroundColor}
            textColor={c.textColor}
            editable={editable}
            tossable={tossable}
            onContribute={(cardEl) => onCardContribute?.(idx, cardEl)}
            onTextChange={(next) => onCardTextChange?.(idx, next)}
          />
        </div>
      ))}
    </div>
  )
}
