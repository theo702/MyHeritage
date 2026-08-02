import {
  displayName,
  givenNames,
  lifespan,
  shortDisplayName,
  type TreeNode,
} from '../family'
import type { Person } from '../types'

interface PersonCardProps {
  person: Person
  selected: boolean
  dimmed: boolean
  onSelect: (id: string) => void
  onAddRelative?: (id: string) => void
  style?: React.CSSProperties
}

function initials(person: Person): string {
  const a = person.firstName?.[0] ?? ''
  const b = person.lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

function childDownLabel(person: Person): string {
  if (person.gender === 'male') return 'Fils'
  if (person.gender === 'female') return 'Fille'
  return 'Enfant'
}

function parentUpLabel(parent: Person, spouse?: Person): string {
  if (spouse) {
    const genders = new Set([parent.gender, spouse.gender])
    if (genders.has('male') && genders.has('female')) return 'Parents'
    if (parent.gender === 'male' || spouse.gender === 'male') return 'Pères'
    if (parent.gender === 'female' || spouse.gender === 'female') return 'Mères'
    return 'Parents'
  }
  if (parent.gender === 'male') return 'Père'
  if (parent.gender === 'female') return 'Mère'
  return 'Parent'
}

function PersonCard({
  person,
  selected,
  dimmed,
  onSelect,
  onAddRelative,
  style,
}: PersonCardProps) {
  const years = lifespan(person)
  const hasExtraNames = Boolean(person.secondName || person.thirdName)
  return (
    <div
      className={`person-card-wrap${selected ? ' is-selected' : ''}`}
      style={style}
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

function ParentsLink() {
  return (
    <div className="relation-link parents-link" aria-hidden>
      <span className="relation-sep long" />
    </div>
  )
}

function ChildLink({
  upLabel,
  downLabel,
}: {
  upLabel: string
  downLabel: string
}) {
  return (
    <div
      className="relation-link child"
      aria-label={`${upLabel} / ${downLabel}`}
    >
      <span className="relation-side vertical">
        <span className="relation-arrow" aria-hidden>
          ↑
        </span>
        <span className="relation-label">{upLabel}</span>
      </span>
      <span className="relation-sep vertical" aria-hidden />
      <span className="relation-side vertical">
        <span className="relation-label">{downLabel}</span>
        <span className="relation-arrow" aria-hidden>
          ↓
        </span>
      </span>
    </div>
  )
}

interface TreeBranchProps {
  node: TreeNode
  selectedId: string | null
  matchIds: Set<string> | null
  onSelect: (id: string) => void
  onAddRelative?: (id: string) => void
  depth?: number
}

function TreeBranch({
  node,
  selectedId,
  matchIds,
  onSelect,
  onAddRelative,
  depth = 0,
}: TreeBranchProps) {
  const isDimmed = (id: string) => matchIds !== null && !matchIds.has(id)

  const hasChildren = node.children.length > 0
  const childCount = node.children.length

  return (
    <div className="branch">
      <div className="couple">
        <PersonCard
          person={node.person}
          selected={selectedId === node.person.id}
          dimmed={isDimmed(node.person.id)}
          onSelect={onSelect}
          onAddRelative={onAddRelative}
          style={{ animationDelay: `${depth * 50}ms` }}
        />
        {node.spouse && (
          <>
            <ParentsLink />
            <PersonCard
              person={node.spouse}
              selected={selectedId === node.spouse.id}
              dimmed={isDimmed(node.spouse.id)}
              onSelect={onSelect}
              onAddRelative={onAddRelative}
              style={{ animationDelay: `${depth * 50 + 40}ms` }}
            />
          </>
        )}
      </div>

      {hasChildren && (
        <div className="children-wrap">
          <div className="vline" />
          {childCount > 1 && (
            <div className="hline-wrap" aria-hidden>
              <div
                className="hline"
                style={{
                  width: `${((childCount - 1) / childCount) * 100}%`,
                }}
              />
            </div>
          )}
          <div className="kids-row">
            {node.children.map((child) => (
              <div className="kid-stem" key={child.person.id}>
                <ChildLink
                  upLabel={parentUpLabel(node.person, node.spouse)}
                  downLabel={childDownLabel(child.person)}
                />
                <TreeBranch
                  node={child}
                  selectedId={selectedId}
                  matchIds={matchIds}
                  onSelect={onSelect}
                  onAddRelative={onAddRelative}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function FamilyTreeView({
  roots,
  selectedId,
  matchIds,
  onSelect,
  onAddRelative,
}: {
  roots: TreeNode[]
  selectedId: string | null
  matchIds: Set<string> | null
  onSelect: (id: string) => void
  onAddRelative?: (id: string) => void
}) {
  return (
    <div className="forest-roots">
      {roots.map((root) => (
        <TreeBranch
          key={root.person.id}
          node={root}
          selectedId={selectedId}
          matchIds={matchIds}
          onSelect={onSelect}
          onAddRelative={onAddRelative}
        />
      ))}
    </div>
  )
}
