import { useEffect, useMemo, useState } from 'react'
import {
  AddRelativeChooser,
  PersonFormModal,
  type PersonFormData,
} from './components/PersonFormModal'
import { SidePanel } from './components/SidePanel'
import { FamilyTreeView } from './components/TreeView'
import {
  addFirstPerson,
  addRelative,
  buildDescendantTree,
  buildForest,
  deletePerson,
  displayName,
  filterByLastName,
  getUniqueLastNames,
  loadTree,
  saveTree,
  updatePerson,
  type TreeNode,
} from './family'
import type { FamilyTree, RelationType } from './types'
import { RELATION_LABELS } from './types'

type ModalState =
  | { type: 'none' }
  | { type: 'first' }
  | { type: 'choose-relation'; personId: string }
  | { type: 'add-relative'; personId: string; relation: RelationType }
  | { type: 'edit'; personId: string }

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 3c0 3.2-2.4 4.8-2.4 8S12 18.2 12 21c0-2.8 2.4-4.8 2.4-8S12 6.2 12 3Z"
          fill="#C4A35A"
        />
        <path
          d="M7 10c2.4.8 3.2 2.4 4.8 4-1.6.8-3.2 1.6-4.8 1.6C6.4 14 6.4 11.6 7 10Z"
          fill="#6B9B7A"
          opacity="0.9"
        />
        <path
          d="M17 10c-2.4.8-3.2 2.4-4.8 4 1.6.8 3.2 1.6 4.8 1.6 0.6-1.6 0.6-4 0-5.6Z"
          fill="#6B9B7A"
          opacity="0.9"
        />
      </svg>
    </div>
  )
}

export default function App() {
  const [tree, setTree] = useState<FamilyTree>(() => loadTree())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [viewRootId, setViewRootId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  useEffect(() => {
    saveTree(tree)
  }, [tree])

  useEffect(() => {
    if (!selectedId) return
    const card = document.querySelector(
      `[data-person-id="${selectedId}"]`,
    ) as HTMLElement | null
    card?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [selectedId])

  const lastNames = useMemo(() => getUniqueLastNames(tree), [tree])
  const matched = useMemo(
    () => filterByLastName(tree, filter),
    [tree, filter],
  )
  const matchIds = useMemo(() => {
    if (!filter.trim()) return null
    return new Set(matched.map((p) => p.id))
  }, [filter, matched])

  const selected = tree.people.find((p) => p.id === selectedId) ?? null

  const treeRoots: TreeNode[] = useMemo(() => {
    if (tree.people.length === 0) return []

    if (viewRootId) {
      const node = buildDescendantTree(tree, viewRootId)
      return node ? [node] : []
    }

    return buildForest(tree)
  }, [tree, viewRootId])

  function commit(next: FamilyTree) {
    setTree(next)
  }

  function handleFirstPerson(data: PersonFormData) {
    const next = addFirstPerson(data)
    commit(next)
    setSelectedId(next.rootId)
    setModal({ type: 'none' })
  }

  function handleAddRelative(data: PersonFormData) {
    if (modal.type !== 'add-relative') return
    const next = addRelative(tree, modal.personId, modal.relation, data)
    commit(next)
    setModal({ type: 'none' })
  }

  function handleEdit(data: PersonFormData) {
    if (modal.type !== 'edit') return
    commit(updatePerson(tree, modal.personId, data))
    setModal({ type: 'none' })
  }

  function handleDelete() {
    if (!selectedId) return
    if (
      !window.confirm(
        'Supprimer cette personne de l’arbre ? Les liens familiaux seront mis à jour.',
      )
    ) {
      return
    }
    commit(deletePerson(tree, selectedId))
    setSelectedId(null)
  }

  const modalPerson =
    modal.type === 'add-relative' ||
    modal.type === 'choose-relation' ||
    modal.type === 'edit'
      ? tree.people.find((p) => p.id === modal.personId)
      : undefined

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div className="brand-text">
            <h1 className="brand-name">Héritage</h1>
            <p className="brand-tag">Ton arbre généalogique personnel</p>
          </div>
        </div>

        <div className="topbar-actions">
          {tree.people.length > 0 && (
            <>
              <div className="filter-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" strokeLinecap="round" />
                </svg>
                <input
                  className="filter-input"
                  type="search"
                  placeholder="Filtrer par nom…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  list="lastname-suggestions"
                  aria-label="Filtrer par nom de famille"
                />
                <datalist id="lastname-suggestions">
                  {lastNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              {viewRootId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setViewRootId(null)}
                >
                  Arbre complet
                </button>
              )}
            </>
          )}

          {tree.people.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedId) {
                  setModal({ type: 'choose-relation', personId: selectedId })
                } else {
                  window.alert(
                    'Sélectionne d’abord une personne dans l’arbre, puis ajoute un membre de sa famille.',
                  )
                }
              }}
            >
              + Membre
            </button>
          )}
        </div>
      </header>

      <div className={`main${selected ? '' : ' solo'}`}>
        <section className="tree-pane">
          {tree.people.length === 0 ? (
            <div className="empty-state">
              <BrandMark />
              <h2>Héritage</h2>
              <p>
                Commence ton arbre en ajoutant la première personne — toi, un
                grand-parent, ou quiconque ouvre ta lignée.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal({ type: 'first' })}
              >
                Ajouter la première personne
              </button>
            </div>
          ) : (
            <>
              <div className="hint-bar">
                <p>
                  Clique sur une personne pour voir sa fiche et ajouter père,
                  mère, frère, sœur, fils ou fille.
                </p>
                <span className="stats">
                  {tree.people.length} personne
                  {tree.people.length > 1 ? 's' : ''}
                  {filter.trim()
                    ? ` · ${matched.length} pour « ${filter.trim()} »`
                    : ''}
                </span>
              </div>
              <div className="tree-canvas">
                <FamilyTreeView
                  roots={treeRoots}
                  selectedId={selectedId}
                  matchIds={matchIds}
                  onSelect={setSelectedId}
                  onAddRelative={(id) =>
                    setModal({ type: 'choose-relation', personId: id })
                  }
                />
              </div>
            </>
          )}
        </section>

        {selected && (
          <SidePanel
            tree={tree}
            person={selected}
            onClose={() => setSelectedId(null)}
            onAddRelative={() =>
              setModal({ type: 'choose-relation', personId: selected.id })
            }
            onEdit={() => setModal({ type: 'edit', personId: selected.id })}
            onDelete={handleDelete}
            onSelect={setSelectedId}
            onSetRoot={() => setViewRootId(selected.id)}
          />
        )}
      </div>

      {modal.type === 'first' && (
        <PersonFormModal
          title="Première personne"
          subtitle="Le point de départ de ton arbre."
          submitLabel="Créer"
          onClose={() => setModal({ type: 'none' })}
          onSubmit={handleFirstPerson}
        />
      )}

      {modal.type === 'choose-relation' && modalPerson && (
        <AddRelativeChooser
          selected={modalPerson}
          onClose={() => setModal({ type: 'none' })}
          onPickRelation={(relation) =>
            setModal({
              type: 'add-relative',
              personId: modal.personId,
              relation,
            })
          }
        />
      )}

      {modal.type === 'add-relative' && modalPerson && (
        <PersonFormModal
          key={`${modal.personId}-${modal.relation}`}
          title={`Ajouter : ${RELATION_LABELS[modal.relation]}`}
          subtitle={`Lien avec ${displayName(modalPerson)}`}
          relation={modal.relation}
          defaultLastName={modalPerson.lastName}
          submitLabel="Ajouter à l’arbre"
          onClose={() => setModal({ type: 'none' })}
          onSubmit={handleAddRelative}
        />
      )}

      {modal.type === 'edit' && modalPerson && (
        <PersonFormModal
          key={`edit-${modal.personId}`}
          title="Modifier la personne"
          submitLabel="Enregistrer"
          initial={{
            firstName: modalPerson.firstName,
            secondName: modalPerson.secondName,
            thirdName: modalPerson.thirdName,
            lastName: modalPerson.lastName,
            birthYear: modalPerson.birthYear,
            deathYear: modalPerson.deathYear,
            gender: modalPerson.gender,
            notes: modalPerson.notes,
          }}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={handleEdit}
        />
      )}
    </div>
  )
}
