import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildGenerationLayout,
  childLabelFor,
  displayName,
  givenNames,
  lifespan,
  parentLabelFor,
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
  const isDimmed = (id: string) =>
    matchIds !== null && !matchIds.has(id)

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
    <div className="couple">
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

interface LinkGeometry {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  upLabel: string
  downLabel: string
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
  const [links, setLinks] = useState<LinkGeometry[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const measure = () => {
      const rootBox = canvas.getBoundingClientRect()
      setSize({ w: canvas.scrollWidth, h: canvas.scrollHeight })

      const next: LinkGeometry[] = []
      const seen = new Set<string>()

      for (const link of layout.links) {
        const parentEl = canvas.querySelector(
          `[data-person-id="${link.parentId}"]`,
        ) as HTMLElement | null
        const childEl = canvas.querySelector(
          `[data-person-id="${link.childId}"]`,
        ) as HTMLElement | null
        if (!parentEl || !childEl) continue

        const child = tree.people.find((p) => p.id === link.childId)
        if (!child || seen.has(child.id)) continue

        const father = child.fatherId
          ? tree.people.find((p) => p.id === child.fatherId)
          : undefined
        const mother = child.motherId
          ? tree.people.find((p) => p.id === child.motherId)
          : undefined

        let x1: number
        let y1: number
        const childParents = [child.fatherId, child.motherId].filter(
          Boolean,
        ) as string[]

        if (childParents.length === 2) {
          const a = canvas.querySelector(
            `[data-person-id="${childParents[0]}"]`,
          ) as HTMLElement | null
          const b = canvas.querySelector(
            `[data-person-id="${childParents[1]}"]`,
          ) as HTMLElement | null
          if (a && b) {
            const ra = a.getBoundingClientRect()
            const rb = b.getBoundingClientRect()
            x1 =
              (ra.left + ra.right + rb.left + rb.right) / 4 - rootBox.left
            y1 = Math.max(ra.bottom, rb.bottom) - rootBox.top
          } else {
            const rp = parentEl.getBoundingClientRect()
            x1 = rp.left + rp.width / 2 - rootBox.left
            y1 = rp.bottom - rootBox.top
          }
        } else {
          const rp = parentEl.getBoundingClientRect()
          x1 = rp.left + rp.width / 2 - rootBox.left
          y1 = rp.bottom - rootBox.top
        }

        const rc = childEl.getBoundingClientRect()
        const x2 = rc.left + rc.width / 2 - rootBox.left
        const y2 = rc.top - rootBox.top

        let upLabel = 'Parent'
        if (father && mother) upLabel = 'Parents'
        else if (father) upLabel = parentLabelFor(father)
        else if (mother) upLabel = parentLabelFor(mother)

        next.push({
          key: `link-${child.id}`,
          x1,
          y1,
          x2,
          y2,
          upLabel,
          downLabel: childLabelFor(child),
        })
        seen.add(child.id)
      }

      setLinks(next)
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

  // Regroupe les liens issus du même point parent (fratrie)
  const linkGroups = useMemo(() => {
    const groups = new Map<string, LinkGeometry[]>()
    for (const l of links) {
      const key = `${Math.round(l.x1)}:${Math.round(l.y1)}`
      const list = groups.get(key) ?? []
      list.push(l)
      groups.set(key, list)
    }
    return Array.from(groups.values())
  }, [links])

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
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="gen-arrow-head" />
          </marker>
        </defs>

        {linkGroups.map((group) => {
          const trunkX = group[0].x1
          const trunkTop = group[0].y1
          const barY =
            trunkTop +
            Math.min(...group.map((l) => l.y2 - l.y1)) * 0.42
          const xs = group.map((l) => l.x2)
          const barLeft = Math.min(trunkX, ...xs)
          const barRight = Math.max(trunkX, ...xs)
          const groupKey = group.map((l) => l.key).join('|')

          return (
            <g key={groupKey} className="gen-link-group">
              {/* Descente depuis les parents jusqu’à la barre */}
              <line
                x1={trunkX}
                y1={trunkTop + 4}
                x2={trunkX}
                y2={barY}
                className="gen-link-path"
              />
              {/* Barre horizontale de fratrie */}
              {group.length > 1 && (
                <line
                  x1={barLeft}
                  y1={barY}
                  x2={barRight}
                  y2={barY}
                  className="gen-link-path"
                />
              )}

              {group.map((l) => {
                const labelY = (barY + l.y2) / 2
                return (
                  <g key={l.key}>
                    <line
                      x1={l.x2}
                      y1={barY}
                      x2={l.x2}
                      y2={l.y2 - 2}
                      className="gen-link-path"
                      markerEnd="url(#arrow-down)"
                    />
                    <foreignObject
                      x={l.x2 - 54}
                      y={labelY - 24}
                      width={108}
                      height={48}
                    >
                      <div className="gen-link-badge">
                        <span className="up">↑ {l.upLabel}</span>
                        <span className="down">↓ {l.downLabel}</span>
                      </div>
                    </foreignObject>
                  </g>
                )
              })}
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
