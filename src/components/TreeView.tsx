import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildGenerationLayout,
  displayName,
  givenNames,
  lifespan,
  shortDisplayName,
  type GenUnit,
} from '../family'
import type { FamilyTree, Person } from '../types'

interface PersonCardProps {
  person: Person
  selected: boolean
  dimmed: boolean
  onSelect: (id: string) => void
  onAddRelative?: (id: string) => void
}

function initials(person: Person): string {
  const a = person.firstName?.[0] ?? ''
  const b = person.lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

function PersonCard({
  person,
  selected,
  dimmed,
  onSelect,
  onAddRelative,
}: PersonCardProps) {
  const years = lifespan(person)
  const hasExtraNames = Boolean(person.secondName || person.thirdName)
  return (
    <div className={`person-card-wrap${selected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className={`person-card${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
        onClick={() => onSelect(person.id)}
        aria-pressed={selected}
        aria-label={displayName(person)}
        data-person-id={person.id}
      >
        <div className={`person-avatar ${person.gender}`}>{initials(person)}</div>
        <p className="person-name">{shortDisplayName(person)}</p>
        {hasExtraNames && (
          <p className="person-given">{givenNames(person)}</p>
        )}
        {years && <p className="person-meta">{years}</p>}
      </button>
      {selected && onAddRelative && (
        <button
          type="button"
          className="card-add-btn"
          onClick={(e) => {
            e.stopPropagation()
            onAddRelative(person.id)
          }}
        >
          + Ajouter un membre
        </button>
      )}
    </div>
  )
}

function UnitView({
  unit,
  selectedId,
  matchIds,
  onSelect,
  onAddRelative,
}: {
  unit: GenUnit
  selectedId: string | null
  matchIds: Set<string> | null
  onSelect: (id: string) => void
  onAddRelative?: (id: string) => void
}) {
  const isDimmed = (id: string) => matchIds !== null && !matchIds.has(id)

  if (unit.kind === 'single') {
    return (
      <div className="pedigree-unit" data-unit-id={unit.person.id}>
        <PersonCard
          person={unit.person}
          selected={selectedId === unit.person.id}
          dimmed={isDimmed(unit.person.id)}
          onSelect={onSelect}
          onAddRelative={onAddRelative}
        />
      </div>
    )
  }

  return (
    <div
      className="pedigree-unit couple-unit"
      data-unit-id={`${unit.left.id},${unit.right.id}`}
      data-couple={`${unit.left.id},${unit.right.id}`}
    >
      <PersonCard
        person={unit.left}
        selected={selectedId === unit.left.id}
        dimmed={isDimmed(unit.left.id)}
        onSelect={onSelect}
        onAddRelative={onAddRelative}
      />
      <PersonCard
        person={unit.right}
        selected={selectedId === unit.right.id}
        dimmed={isDimmed(unit.right.id)}
        onSelect={onSelect}
        onAddRelative={onAddRelative}
      />
    </div>
  )
}

interface DrawnFamily {
  key: string
  /** Centre du couple (milieu du trait conjugal) */
  joinX: number
  joinY: number
  /** Extrêmités du trait entre les deux parents */
  pairLeft: number
  pairRight: number
  barY: number
  children: { id: string; x: number; top: number }[]
}

export function FamilyTreeView({
  tree,
  selectedId,
  matchIds,
  onSelect,
  onAddRelative,
}: {
  tree: FamilyTree
  selectedId: string | null
  matchIds: Set<string> | null
  onSelect: (id: string) => void
  onAddRelative?: (id: string) => void
}) {
  const layout = useMemo(() => buildGenerationLayout(tree), [tree])
  const canvasRef = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState<DrawnFamily[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const measure = () => {
      const rootBox = canvas.getBoundingClientRect()
      setSize({ w: canvas.scrollWidth, h: canvas.scrollHeight })
      const next: DrawnFamily[] = []

      for (const fam of layout.families) {
        const parentEls = fam.parentIds
          .map(
            (id) =>
              canvas.querySelector(
                `[data-person-id="${id}"]`,
              ) as HTMLElement | null,
          )
          .filter((el): el is HTMLElement => Boolean(el))

        const children = fam.childIds
          .map((id) => {
            const el = canvas.querySelector(
              `[data-person-id="${id}"]`,
            ) as HTMLElement | null
            if (!el) return null
            const r = el.getBoundingClientRect()
            return {
              id,
              x: r.left + r.width / 2 - rootBox.left,
              top: r.top - rootBox.top,
            }
          })
          .filter((c): c is NonNullable<typeof c> => Boolean(c))

        if (parentEls.length === 0 || children.length === 0) continue

        const parentBoxes = parentEls.map((el) => {
          const r = el.getBoundingClientRect()
          return {
            left: r.left - rootBox.left,
            right: r.right - rootBox.left,
            cx: r.left + r.width / 2 - rootBox.left,
            bottom: r.bottom - rootBox.top,
            midY: r.top + r.height * 0.55 - rootBox.top,
          }
        })

        parentBoxes.sort((a, b) => a.cx - b.cx)

        let pairLeft: number
        let pairRight: number
        let joinX: number
        let joinY: number

        if (parentBoxes.length >= 2) {
          // Trait conjugal entre les deux cartes, descente depuis le milieu
          pairLeft = parentBoxes[0].right
          pairRight = parentBoxes[parentBoxes.length - 1].left
          joinX = (pairLeft + pairRight) / 2
          joinY =
            parentBoxes.reduce((s, p) => s + p.midY, 0) / parentBoxes.length
        } else {
          pairLeft = parentBoxes[0].cx
          pairRight = parentBoxes[0].cx
          joinX = parentBoxes[0].cx
          joinY = parentBoxes[0].bottom
        }

        const minChildTop = Math.min(...children.map((c) => c.top))
        const barY = joinY + (minChildTop - joinY) * 0.55

        next.push({
          key: fam.key,
          joinX,
          joinY,
          pairLeft,
          pairRight,
          barY,
          children,
        })
      }

      setDrawn(next)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(canvas)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [layout, tree, selectedId])

  if (layout.generations.length === 0) return null

  return (
    <div className="gen-tree pedigree" ref={canvasRef}>
      <svg
        className="gen-links"
        width={size.w}
        height={size.h}
        aria-hidden
      >
        {drawn.map((fam) => {
          const childXs = fam.children.map((c) => c.x)
          const barLeft = Math.min(...childXs)
          const barRight = Math.max(...childXs)

          return (
            <g key={fam.key} className="pedigree-links">
              {/* Trait entre les parents */}
              {fam.pairRight - fam.pairLeft > 4 && (
                <line
                  x1={fam.pairLeft}
                  y1={fam.joinY}
                  x2={fam.pairRight}
                  y2={fam.joinY}
                  className="pedigree-path couple-path"
                />
              )}
              {/* Descente du couple vers la barre des enfants */}
              <line
                x1={fam.joinX}
                y1={fam.joinY}
                x2={fam.joinX}
                y2={fam.barY}
                className="pedigree-path"
              />
              {/* Barre horizontale (fratrie) */}
              {fam.children.length > 1 && (
                <line
                  x1={barLeft}
                  y1={fam.barY}
                  x2={barRight}
                  y2={fam.barY}
                  className="pedigree-path"
                />
              )}
              {/* Descente vers chaque enfant */}
              {fam.children.map((child) => (
                <line
                  key={child.id}
                  x1={child.x}
                  y1={fam.barY}
                  x2={child.x}
                  y2={child.top}
                  className="pedigree-path"
                />
              ))}
            </g>
          )
        })}
      </svg>

      <div className="gen-rows">
        {layout.generations.map((row, index) => (
          <div className="gen-row" key={`gen-${index}`}>
            {row.map((unit) => (
              <UnitView
                key={unit.key}
                unit={unit}
                selectedId={selectedId}
                matchIds={matchIds}
                onSelect={onSelect}
                onAddRelative={onAddRelative}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
