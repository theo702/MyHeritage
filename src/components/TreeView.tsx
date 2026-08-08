import { useMemo } from 'react'
import {
  LAYOUT,
  buildPositionedLayout,
  displayName,
  givenNames,
  lifespan,
  shortDisplayName,
} from '../family'
import type { FamilyTree, Person } from '../types'

interface PersonCardProps {
  person: Person
  selected: boolean
  dimmed: boolean
  cx: number
  top: number
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
  cx,
  top,
  onSelect,
  onAddRelative,
}: PersonCardProps) {
  const years = lifespan(person)
  const hasExtraNames = Boolean(person.secondName || person.thirdName)
  const left = cx - LAYOUT.cardW / 2

  return (
    <div
      className={`person-card-wrap${selected ? ' is-selected' : ''}`}
      style={{
        position: 'absolute',
        left,
        top,
        width: LAYOUT.cardW,
      }}
    >
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
        {person.notes && (
          <p className="person-note" title={person.notes}>
            {person.notes}
          </p>
        )}
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
  const layout = useMemo(() => buildPositionedLayout(tree), [tree])

  if (layout.nodes.length === 0) return null

  const isDimmed = (id: string) => matchIds !== null && !matchIds.has(id)

  return (
    <div
      className="gen-tree pedigree"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        className="gen-links"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {layout.families.map((fam) => {
          const parents = fam.parentIds
            .map((id) => layout.byId.get(id))
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
          const children = fam.childIds
            .map((id) => layout.byId.get(id))
            .filter((n): n is NonNullable<typeof n> => Boolean(n))

          if (parents.length === 0 || children.length === 0) return null

          const parentBottom = Math.max(
            ...parents.map((p) => p.top + LAYOUT.cardH),
          )
          const childTop = Math.min(...children.map((c) => c.top))
          const barY = parentBottom + (childTop - parentBottom) * 0.45
          const xs = [
            ...parents.map((p) => p.cx),
            ...children.map((c) => c.cx),
          ]
          const barLeft = Math.min(...xs)
          const barRight = Math.max(...xs)

          return (
            <g key={fam.key} className="pedigree-links">
              {parents.map((p) => (
                <line
                  key={`p-${fam.key}-${p.person.id}`}
                  x1={p.cx}
                  y1={p.top + LAYOUT.cardH}
                  x2={p.cx}
                  y2={barY}
                  className="pedigree-path"
                />
              ))}
              <line
                x1={barLeft}
                y1={barY}
                x2={barRight}
                y2={barY}
                className="pedigree-path"
              />
              {children.map((child) => (
                <line
                  key={`c-${fam.key}-${child.person.id}`}
                  x1={child.cx}
                  y1={barY}
                  x2={child.cx}
                  y2={child.top}
                  className="pedigree-path"
                />
              ))}
            </g>
          )
        })}
      </svg>

      {layout.nodes.map((node) => (
        <PersonCard
          key={node.person.id}
          person={node.person}
          cx={node.cx}
          top={node.top}
          selected={selectedId === node.person.id}
          dimmed={isDimmed(node.person.id)}
          onSelect={onSelect}
          onAddRelative={onAddRelative}
        />
      ))}
    </div>
  )
}
