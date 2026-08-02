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
  midX: number
  midY: number
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

        const pairKey = [link.parentId, link.childId].sort().join(':')
        // Une seule courbe visuelle parent-enfant (père+mère → même enfant
        // : on dessine depuis le milieu du couple si possible)
        if (seen.has(`${link.childId}`)) {
          // déjà une ligne vers cet enfant ; on enrichit les labels plus bas
          continue
        }

        const parent = tree.people.find((p) => p.id === link.parentId)
        const child = tree.people.find((p) => p.id === link.childId)
        if (!parent || !child) continue

        // Point de départ : bas de la carte parent (ou milieu du couple)
        const childParents = [child.fatherId, child.motherId].filter(
          Boolean,
        ) as string[]
        let x1: number
        let y1: number

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

        const father = child.fatherId
          ? tree.people.find((p) => p.id === child.fatherId)
          : undefined
        const mother = child.motherId
          ? tree.people.find((p) => p.id === child.motherId)
          : undefined

        let upLabel = 'Parent'
        if (father && mother) upLabel = 'Parents'
        else if (father) upLabel = parentLabelFor(father)
        else if (mother) upLabel = parentLabelFor(mother)

        next.push({
          key: pairKey,
          x1,
          y1,
          x2,
          y2,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
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

  if (layout.generations.length === 0) return null

  return (
    <div className="gen-tree" ref={canvasRef}>
      <svg
        className="gen-links"
        width={size.w}
        height={size.h}
        aria-hidden
      >
        {links.map((l) => {
          const elbowY = l.y1 + (l.y2 - l.y1) * 0.45
          const path = `M ${l.x1} ${l.y1} V ${elbowY} H ${l.x2} V ${l.y2}`
          return (
            <g key={l.key}>
              <path d={path} className="gen-link-path" fill="none" />
              <text
                x={l.x2}
                y={elbowY - 6}
                textAnchor="middle"
                className="gen-link-label"
              >
                ↑ {l.upLabel}
              </text>
              <text
                x={l.x2}
                y={elbowY + 14}
                textAnchor="middle"
                className="gen-link-label"
              >
                ↓ {l.downLabel}
              </text>
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
