import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  createEmptyTree,
  deletePerson,
  displayName,
  filterByLastName,
  getChildren,
  getUniqueLastNames,
  updatePerson,
} from './family'
import { fetchSharedTree, pushSharedTree, type SyncStatus } from './sync'
import type { FamilyTree, RelationType } from './types'
import { RELATION_LABELS } from './types'
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
  formatZoom,
  loadZoom,
  saveZoom,
} from './zoom'

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
  const [tree, setTree] = useState<FamilyTree>(() => createEmptyTree())
  const [ready, setReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [viewRootId, setViewRootId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [zoom, setZoom] = useState(() => loadZoom())
  const skipNextSave = useRef(true)
  const saveTimer = useRef<number | null>(null)
  const treePaneRef = useRef<HTMLElement | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  function changeZoom(next: number) {
    const value = clampZoom(next)
    setZoom(value)
    saveZoom(value)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { tree: shared, status } = await fetchSharedTree()
      if (cancelled) return
      skipNextSave.current = true
      setTree(shared)
      setSyncStatus(status)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSyncStatus((s) => (s === 'offline' ? 'offline' : 'saving'))
    saveTimer.current = window.setTimeout(async () => {
      const ok = await pushSharedTree(tree)
      setSyncStatus(ok ? 'online' : 'offline')
    }, 450)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [tree, ready])

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

  /* Ctrl/⌘ + molette et pincement pour zoomer l’arbre */
  useEffect(() => {
    const pane = treePaneRef.current
    if (!pane) return

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP / 2 : ZOOM_STEP / 2
      changeZoom(zoomRef.current + delta)
    }

    let startDist = 0
    let startZoom = ZOOM_DEFAULT

    const touchDist = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      )

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = touchDist(e.touches)
        startZoom = zoomRef.current
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist <= 0) return
      e.preventDefault()
      changeZoom(startZoom * (touchDist(e.touches) / startDist))
    }

    const onTouchEnd = () => {
      startDist = 0
    }

    pane.addEventListener('wheel', onWheel, { passive: false })
    pane.addEventListener('touchstart', onTouchStart, { passive: true })
    pane.addEventListener('touchmove', onTouchMove, { passive: false })
    pane.addEventListener('touchend', onTouchEnd)
    pane.addEventListener('touchcancel', onTouchEnd)

    return () => {
      pane.removeEventListener('wheel', onWheel)
      pane.removeEventListener('touchstart', onTouchStart)
      pane.removeEventListener('touchmove', onTouchMove)
      pane.removeEventListener('touchend', onTouchEnd)
      pane.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [ready, tree.people.length])

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

  const visibleTree: FamilyTree = useMemo(() => {
    if (!viewRootId) return tree
    const keep = new Set<string>()
    const walkDown = (id: string) => {
      if (keep.has(id)) return
      keep.add(id)
      const person = tree.people.find((p) => p.id === id)
      if (!person) return
      for (const sid of person.spouseIds) keep.add(sid)
      for (const child of getChildren(tree, id)) walkDown(child.id)
    }
    walkDown(viewRootId)
    // Inclure co-parents des enfants gardés
    for (const p of tree.people) {
      if (!keep.has(p.id)) continue
      if (p.fatherId) keep.add(p.fatherId)
      if (p.motherId) keep.add(p.motherId)
    }
    return {
      ...tree,
      people: tree.people.filter((p) => keep.has(p.id)),
    }
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
            <p className="brand-tag">
              Ton arbre généalogique personnel
              <span className={`sync-dot sync-${syncStatus}`}>
                {syncStatus === 'loading' && ' · Chargement…'}
                {syncStatus === 'online' && ' · Partagé en ligne'}
                {syncStatus === 'saving' && ' · Enregistrement…'}
                {syncStatus === 'offline' && ' · Hors ligne (local)'}
                {syncStatus === 'error' && ' · Erreur sync'}
              </span>
            </p>
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
        <section className="tree-pane" ref={treePaneRef}>
          {!ready ? (
            <div className="empty-state">
              <BrandMark />
              <h2>Héritage</h2>
              <p>Chargement de l’arbre partagé…</p>
            </div>
          ) : tree.people.length === 0 ? (
            <div className="empty-state">
              <BrandMark />
              <h2>Héritage</h2>
              <p>
                Commence ton arbre en ajoutant la première personne — toi, un
                grand-parent, ou quiconque ouvre ta lignée. L’arbre sera visible
                pour tout le monde sur ce site.
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
                  mère, frère, sœur, fils ou fille. Pince ou utilise − / + pour
                  dézoomer.
                </p>
                <div className="hint-bar-end">
                  <span className="stats">
                    {tree.people.length} personne
                    {tree.people.length > 1 ? 's' : ''}
                    {filter.trim()
                      ? ` · ${matched.length} pour « ${filter.trim()} »`
                      : ''}
                  </span>
                  <div className="zoom-controls desktop-only" role="group" aria-label="Zoom">
                    <button
                      type="button"
                      className="zoom-btn"
                      aria-label="Dézoomer"
                      disabled={zoom <= ZOOM_MIN}
                      onClick={() => changeZoom(zoom - ZOOM_STEP)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="zoom-value"
                      aria-label="Réinitialiser le zoom"
                      title="Réinitialiser"
                      onClick={() => changeZoom(ZOOM_DEFAULT)}
                    >
                      {formatZoom(zoom)}
                    </button>
                    <button
                      type="button"
                      className="zoom-btn"
                      aria-label="Zoomer"
                      disabled={zoom >= ZOOM_MAX}
                      onClick={() => changeZoom(zoom + ZOOM_STEP)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="tree-canvas"
                style={{ zoom } as CSSProperties}
              >
                <FamilyTreeView
                  tree={visibleTree}
                  selectedId={selectedId}
                  matchIds={matchIds}
                  onSelect={setSelectedId}
                  onAddRelative={(id) =>
                    setModal({ type: 'choose-relation', personId: id })
                  }
                />
              </div>
              <div
                className={`zoom-dock${selected ? ' with-sheet' : ''}`}
                role="group"
                aria-label="Zoom de l’arbre"
              >
                <button
                  type="button"
                  className="zoom-btn"
                  aria-label="Dézoomer"
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() => changeZoom(zoom - ZOOM_STEP)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="zoom-value"
                  aria-label="Réinitialiser le zoom"
                  title="Réinitialiser"
                  onClick={() => changeZoom(ZOOM_DEFAULT)}
                >
                  {formatZoom(zoom)}
                </button>
                <button
                  type="button"
                  className="zoom-btn"
                  aria-label="Zoomer"
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() => changeZoom(zoom + ZOOM_STEP)}
                >
                  +
                </button>
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
            photo: modalPerson.photo,
          }}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={handleEdit}
        />
      )}
    </div>
  )
}
