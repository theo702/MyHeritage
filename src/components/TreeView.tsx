import { useMemo } from 'react'
import {
  LAYOUT,
  buildPositionedLayout,
  displayName,
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
        title={person.notes || displayName(person)}
      >
        <div className={`person-avatar ${person.gender}${person.photo ? ' has-photo' : ''}`}>
          {person.photo ? (
            <img src={person.photo} alt="" />
          ) : (
            initials(person)
          )}
        </div>
        <p className="person-name">{shortDisplayName(person)}</p>
        {years ? (
          <p className="person-meta">{years}</p>
        ) : (
          <p className="person-meta person-meta-empty"> </p>
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
          + Ajouter
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

  const coupledInFamily = useMemo(() => {
    const keys = new Set<string>()
    for (const fam of layout.families) {
      if (fam.parentIds.length < 2) continue
      keys.add([...fam.parentIds].sort().join('+'))
    }
    return keys
  }, [layout.families])

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
            .sort((a, b) => a.cx - b.cx)
          const children = fam.childIds
            .map((id) => layout.byId.get(id))
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
            .sort((a, b) => a.cx - b.cx)

          if (parents.length === 0 || children.length === 0) return null

          const childTop = Math.min(...children.map((c) => c.top))
          const childXs = children.map((c) => c.cx)

          // Style classique : trait de couple → descente au centre → barre frères/sœurs
          if (parents.length >= 2) {
            const left = parents[0]
            const right = parents[parents.length - 1]
            const coupleY = left.top + LAYOUT.cardH * LAYOUT.coupleLineAt
            const dropX = (left.cx + right.cx) / 2
            const barY = coupleY + (childTop - coupleY) * 0.58
            const barLeft = Math.min(dropX, ...childXs)
            const barRight = Math.max(dropX, ...childXs)

            return (
              <g key={fam.key} className="pedigree-links">
                <line
                  x1={left.cx}
                  y1={coupleY}
                  x2={right.cx}
                  y2={coupleY}
                  className="pedigree-path pedigree-couple"
                />
                <line
                  x1={dropX}
                  y1={coupleY}
                  x2={dropX}
                  y2={barY}
                  className="pedigree-path"
                />
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
          }

          // Parent seul
          const parent = parents[0]
          const dropX = parent.cx
          const fromY = parent.top + LAYOUT.cardH
          const barY = fromY + (childTop - fromY) * 0.45
          const barLeft = Math.min(dropX, ...childXs)
          const barRight = Math.max(dropX, ...childXs)

          return (
            <g key={fam.key} className="pedigree-links">
              <line
                x1={dropX}
                y1={fromY}
                x2={dropX}
                y2={barY}
                className="pedigree-path"
              />
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

        {/* Traits de couple sans enfants (ou non couverts ci-dessus) */}
        {layout.couples.map((couple) => {
          const key = [couple.leftId, couple.rightId].sort().join('+')
          if (coupledInFamily.has(key)) return null
          const a = layout.byId.get(couple.leftId)
          const b = layout.byId.get(couple.rightId)
          if (!a || !b) return null
          const left = a.cx <= b.cx ? a : b
          const right = a.cx <= b.cx ? b : a
          const coupleY = left.top + LAYOUT.cardH * LAYOUT.coupleLineAt
          return (
            <line
              key={`couple-${couple.key}`}
              x1={left.cx}
              y1={coupleY}
              x2={right.cx}
              y2={coupleY}
              className="pedigree-path pedigree-couple"
            />
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
