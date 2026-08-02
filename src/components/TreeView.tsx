import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildGenerationLayout,
  childLabelFor,
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
      <PersonCard
        person={unit.person}
        selected={selectedId === unit.person.id}
        dimmed={isDimmed(unit.person.id)}
        onSelect={onSelect}
        onAddRelative={onAddRelative}
      />
    )
  }

  return (
    <div className="couple" data-couple={`${unit.left.id},${unit.right.id}`}>
      <PersonCard
        person={unit.left}
        selected={selectedId === unit.left.id}
        dimmed={isDimmed(unit.left.id)}
        onSelect={onSelect}
        onAddRelative={onAddRelative}
      />
      <div className="relation-link parents-link" aria-hidden>
        <span className="relation-sep long" />
      </div>
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
  trunkX: number
  trunkTop: number
  barY: number
  children: { id: string; x: number; y: number; label: string }[]
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

        const childEls = fam.childIds
          .map((id) => {
            const el = canvas.querySelector(
              `[data-person-id="${id}"]`,
            ) as HTMLElement | null
            const person = tree.people.find((p) => p.id === id)
            if (!el || !person) return null
            const r = el.getBoundingClientRect()
            return {
              id,
              x: r.left + r.width / 2 - rootBox.left,
              y: r.top - rootBox.top,
              label: childLabelFor(person),
            }
          })
          .filter((c): c is NonNullable<typeof c> => Boolean(c))

        if (parentEls.length === 0 || childEls.length === 0) continue

        const bottoms = parentEls.map((el) => {
          const r = el.getBoundingClientRect()
          return {
            cx: r.left + r.width / 2 - rootBox.left,
            bottom: r.bottom - rootBox.top,
          }
        })

        const trunkX =
          bottoms.reduce((s, p) => s + p.cx, 0) / bottoms.length
        const trunkTop = Math.max(...bottoms.map((p) => p.bottom))
        const minChildY = Math.min(...childEls.map((c) => c.y))
        const gap = minChildY - trunkTop
        const barY = trunkTop + Math.max(28, gap * 0.4)

        next.push({
          key: fam.key,
          trunkX,
          trunkTop,
          barY,
          children: childEls,
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
    <div className="gen-tree" ref={canvasRef}>
      <svg
        className="gen-links"
        width={size.w}
        height={size.h}
        aria-hidden
      >
        <defs>
          <marker
            id="arrow-down"
            viewBox="0 0 12 12"
            refX="6"
            refY="10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M2 2 L6 10 L10 2 Z" className="gen-arrow-head" />
          </marker>
        </defs>

        {drawn.map((fam) => {
          const xs = fam.children.map((c) => c.x)
          const barLeft = Math.min(fam.trunkX, ...xs)
          const barRight = Math.max(fam.trunkX, ...xs)

          return (
            <g key={fam.key} className="gen-link-group">
              <line
                x1={fam.trunkX}
                y1={fam.trunkTop + 2}
                x2={fam.trunkX}
                y2={fam.barY}
                className="gen-link-path"
              />
              {fam.children.length > 1 && (
                <line
                  x1={barLeft}
                  y1={fam.barY}
                  x2={barRight}
                  y2={fam.barY}
                  className="gen-link-path"
                />
              )}
              {fam.children.map((child) => (
                <g key={child.id}>
                  <line
                    x1={child.x}
                    y1={fam.barY}
                    x2={child.x}
                    y2={child.y - 4}
                    className="gen-link-path"
                    markerEnd="url(#arrow-down)"
                  />
                  <foreignObject
                    x={child.x - 36}
                    y={(fam.barY + child.y) / 2 - 12}
                    width={72}
                    height={24}
                  >
                    <div className="gen-link-badge">
                      <span>{child.label}</span>
                    </div>
                  </foreignObject>
                </g>
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
