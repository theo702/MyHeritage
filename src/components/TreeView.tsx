import type { TreeNode } from '../family'
import { displayName, lifespan } from '../family'
import type { Person } from '../types'

interface PersonCardProps {
  person: Person
  selected: boolean
  dimmed: boolean
  onSelect: (id: string) => void
  style?: React.CSSProperties
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
  style,
}: PersonCardProps) {
  const years = lifespan(person)
  return (
    <button
      type="button"
      className={`person-card${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
      onClick={() => onSelect(person.id)}
      style={style}
      aria-pressed={selected}
    >
      <div className={`person-avatar ${person.gender}`}>{initials(person)}</div>
      <p className="person-name">{displayName(person)}</p>
      {years && <p className="person-meta">{years}</p>}
    </button>
  )
}

interface TreeBranchProps {
  node: TreeNode
  selectedId: string | null
  matchIds: Set<string> | null
  onSelect: (id: string) => void
  depth?: number
}

function TreeBranch({
  node,
  selectedId,
  matchIds,
  onSelect,
  depth = 0,
}: TreeBranchProps) {
  const isDimmed = (id: string) =>
    matchIds !== null && matchIds.size > 0 && !matchIds.has(id)

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
          style={{ animationDelay: `${depth * 50}ms` }}
        />
        {node.spouse && (
          <>
            <span className="spouse-link" aria-hidden />
            <PersonCard
              person={node.spouse}
              selected={selectedId === node.spouse.id}
              dimmed={isDimmed(node.spouse.id)}
              onSelect={onSelect}
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
                <TreeBranch
                  node={child}
                  selectedId={selectedId}
                  matchIds={matchIds}
                  onSelect={onSelect}
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
}: {
  roots: TreeNode[]
  selectedId: string | null
  matchIds: Set<string> | null
  onSelect: (id: string) => void
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
        />
      ))}
    </div>
  )
}
