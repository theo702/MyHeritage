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
  barY: number
  parents: { x: number; bottom: number }[]
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
        const parents = fam.parentIds
          .map((id) => {
            const el = canvas.querySelector(
              `[data-person-id="${id}"]`,
            ) as HTMLElement | null
            if (!el) return null
            const r = el.getBoundingClientRect()
            return {
              x: r.left + r.width / 2 - rootBox.left,
              bottom: r.bottom - rootBox.top,
            }
          })
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .sort((a, b) => a.x - b.x)

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
          .sort((a, b) => a.x - b.x)

        if (parents.length === 0 || children.length === 0) continue

        const parentBottom = Math.max(...parents.map((p) => p.bottom))
        const childTop = Math.min(...children.map((c) => c.top))
        const barY = parentBottom + (childTop - parentBottom) * 0.42

        next.push({ key: fam.key, barY, parents, children })
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
          const allX = [
            ...fam.parents.map((p) => p.x),
            ...fam.children.map((c) => c.x),
          ]
          const barLeft = Math.min(...allX)
          const barRight = Math.max(...allX)

          return (
            <g key={fam.key} className="pedigree-links">
              {/* Chaque parent descend jusqu’à la barre (pas de lien entre eux) */}
              {fam.parents.map((p, i) => (
                <line
                  key={`p-${fam.key}-${i}`}
                  x1={p.x}
                  y1={p.bottom}
                  x2={p.x}
                  y2={fam.barY}
                  className="pedigree-path"
                />
              ))}
              {/* Barre commune au-dessus des enfants */}
              <line
                x1={barLeft}
                y1={fam.barY}
                x2={barRight}
                y2={fam.barY}
                className="pedigree-path"
              />
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
