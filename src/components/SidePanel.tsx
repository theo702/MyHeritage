import {
  displayName,
  getChildren,
  getPerson,
  getSiblings,
  givenNames,
  lifespan,
} from '../family'
import type { FamilyTree, Person } from '../types'

interface SidePanelProps {
  tree: FamilyTree
  person: Person
  onClose: () => void
  onAddRelative: () => void
  onEdit: () => void
  onDelete: () => void
  onSelect: (id: string) => void
  onSetRoot: () => void
}

export function SidePanel({
  tree,
  person,
  onClose,
  onAddRelative,
  onEdit,
  onDelete,
  onSelect,
  onSetRoot,
}: SidePanelProps) {
  const father = getPerson(tree, person.fatherId)
  const mother = getPerson(tree, person.motherId)
  const spouses = person.spouseIds
    .map((id) => getPerson(tree, id))
    .filter((p): p is Person => Boolean(p))
  const children = getChildren(tree, person.id)
  const siblings = getSiblings(tree, person)
  const years = lifespan(person)

  return (
    <aside className="side-panel">
      <div className="panel-header">
        <div>
          <h2>{displayName(person)}</h2>
          <p className="sub">
            {[
              person.secondName || person.thirdName
                ? `Prénoms : ${givenNames(person)}`
                : null,
              years || 'Dates non renseignées',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {person.notes && (
        <div className="detail-block">
          <h3>Notes</h3>
          <p className="sub" style={{ margin: 0 }}>
            {person.notes}
          </p>
        </div>
      )}

      <div className="detail-block">
        <h3>Famille</h3>
        <ul className="detail-list">
          <li>
            <strong>Père :</strong>{' '}
            {father ? (
              <button type="button" className="linkish" onClick={() => onSelect(father.id)}>
                {displayName(father)}
              </button>
            ) : (
              '—'
            )}
          </li>
          <li>
            <strong>Mère :</strong>{' '}
            {mother ? (
              <button type="button" className="linkish" onClick={() => onSelect(mother.id)}>
                {displayName(mother)}
              </button>
            ) : (
              '—'
            )}
          </li>
          {spouses.length > 0 && (
            <li>
              <strong>Conjoint(e) :</strong>{' '}
              {spouses.map((s, i) => (
                <span key={s.id}>
                  {i > 0 ? ', ' : ''}
                  <button type="button" className="linkish" onClick={() => onSelect(s.id)}>
                    {displayName(s)}
                  </button>
                </span>
              ))}
            </li>
          )}
          {siblings.length > 0 && (
            <li>
              <strong>Fratrie :</strong>{' '}
              {siblings.map((s, i) => (
                <span key={s.id}>
                  {i > 0 ? ', ' : ''}
                  <button type="button" className="linkish" onClick={() => onSelect(s.id)}>
                    {displayName(s)}
                  </button>
                </span>
              ))}
            </li>
          )}
          {children.length > 0 && (
            <li>
              <strong>Enfants :</strong>{' '}
              {children.map((c, i) => (
                <span key={c.id}>
                  {i > 0 ? ', ' : ''}
                  <button type="button" className="linkish" onClick={() => onSelect(c.id)}>
                    {displayName(c)}
                  </button>
                </span>
              ))}
            </li>
          )}
        </ul>
      </div>

      <div className="detail-block">
        <h3>Ajouter un membre de la famille</h3>
        <p className="sub" style={{ marginBottom: '0.75rem' }}>
          Père, mère, frère, sœur, fils, fille ou conjoint…
        </p>
        <button type="button" className="btn btn-primary" onClick={onAddRelative} style={{ width: '100%' }}>
          + Ajouter un membre
        </button>
      </div>

      <div className="panel-actions">
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          Modifier
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSetRoot}>
          Voir l’arbre depuis cette personne
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Supprimer
        </button>
      </div>
    </aside>
  )
}
