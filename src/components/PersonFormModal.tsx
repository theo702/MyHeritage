import type { Gender, Person, RelationType } from '../types'
import { GENDER_LABELS, ADDABLE_RELATIONS, RELATION_LABELS } from '../types'
import { defaultGenderForRelation, displayName } from '../family'
import { compressIdentityPhoto } from '../photo'
import { useEffect, useId, useRef, useState } from 'react'

export interface PersonFormData {
  firstName: string
  secondName?: string
  thirdName?: string
  lastName: string
  birthYear?: number
  deathYear?: number
  gender: Gender
  notes?: string
  photo?: string
}

interface PersonFormModalProps {
  title: string
  subtitle?: string
  initial?: Partial<PersonFormData>
  defaultLastName?: string
  relation?: RelationType
  submitLabel?: string
  onSubmit: (data: PersonFormData) => void
  onClose: () => void
}

export function PersonFormModal({
  title,
  subtitle,
  initial,
  defaultLastName = '',
  relation,
  submitLabel = 'Ajouter',
  onSubmit,
  onClose,
}: PersonFormModalProps) {
  const formId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [secondName, setSecondName] = useState(initial?.secondName ?? '')
  const [thirdName, setThirdName] = useState(initial?.thirdName ?? '')
  const [lastName, setLastName] = useState(
    initial?.lastName ?? defaultLastName,
  )
  const [birthYear, setBirthYear] = useState(
    initial?.birthYear?.toString() ?? '',
  )
  const [deathYear, setDeathYear] = useState(
    initial?.deathYear?.toString() ?? '',
  )
  const [gender, setGender] = useState<Gender>(
    initial?.gender ??
      (relation ? defaultGenderForRelation(relation) : 'unknown'),
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return
    setPhotoError(null)
    setPhotoBusy(true)
    try {
      const dataUrl = await compressIdentityPhoto(file)
      setPhoto(dataUrl)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erreur photo')
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!firstName.trim() || !lastName.trim()) return
    onSubmit({
      firstName: firstName.trim(),
      secondName: secondName.trim() || undefined,
      thirdName: thirdName.trim() || undefined,
      lastName: lastName.trim(),
      birthYear: birthYear ? Number(birthYear) : undefined,
      deathYear: deathYear ? Number(deathYear) : undefined,
      gender,
      notes: notes.trim() || undefined,
      photo,
    })
  }

  const initials =
    `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase() ||
    '?'

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${formId}-title`}>{title}</h2>
        {subtitle && <p className="sub">{subtitle}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="photo-field">
              <div
                className={`photo-preview ${gender}${photo ? ' has-photo' : ''}`}
                aria-hidden
              >
                {photo ? <img src={photo} alt="" /> : <span>{initials}</span>}
              </div>
              <div className="photo-actions">
                <label
                  className="btn btn-ghost photo-upload-btn"
                  htmlFor={`${formId}-photo`}
                >
                  {photoBusy
                    ? 'Compression…'
                    : photo
                      ? 'Changer la photo'
                      : 'Ajouter une photo'}
                </label>
                <input
                  ref={fileRef}
                  id={`${formId}-photo`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  disabled={photoBusy}
                  onChange={(e) => void handlePhotoFile(e.target.files?.[0])}
                />
                {photo && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setPhoto(undefined)
                      setPhotoError(null)
                    }}
                  >
                    Retirer
                  </button>
                )}
                <p className="photo-hint">
                  Photo d’identité (recadrée en carré, compressée).
                </p>
                {photoError && <p className="photo-error">{photoError}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${formId}-fn`}>1er prénom</label>
              <input
                id={`${formId}-fn`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus={
                  typeof window !== 'undefined' &&
                  window.matchMedia('(min-width: 901px)').matches
                }
                required
                enterKeyHint="next"
                autoComplete="given-name"
                placeholder="Jean"
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor={`${formId}-sn`}>2e prénom</label>
                <input
                  id={`${formId}-sn`}
                  value={secondName}
                  onChange={(e) => setSecondName(e.target.value)}
                  placeholder="optionnel"
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-tn`}>3e prénom</label>
                <input
                  id={`${formId}-tn`}
                  value={thirdName}
                  onChange={(e) => setThirdName(e.target.value)}
                  placeholder="optionnel"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${formId}-ln`}>Nom de famille</label>
              <input
                id={`${formId}-ln`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                enterKeyHint="done"
                autoComplete="family-name"
                placeholder="Dupont"
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor={`${formId}-by`}>Année de naissance</label>
                <input
                  id={`${formId}-by`}
                  type="number"
                  inputMode="numeric"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="1950"
                  min={1000}
                  max={2100}
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-dy`}>Année de décès</label>
                <input
                  id={`${formId}-dy`}
                  type="number"
                  inputMode="numeric"
                  value={deathYear}
                  onChange={(e) => setDeathYear(e.target.value)}
                  placeholder="optionnel"
                  min={1000}
                  max={2100}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${formId}-g`}>Genre</label>
              <select
                id={`${formId}-g`}
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${formId}-n`}>Notes</label>
              <textarea
                id={`${formId}-n`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Lieu de naissance, métier…"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!firstName.trim() || !lastName.trim() || photoBusy}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface AddRelativeModalProps {
  selected: Person
  onClose: () => void
  onPickRelation: (relation: RelationType) => void
}

export function AddRelativeChooser({
  selected,
  onClose,
  onPickRelation,
}: AddRelativeModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const relations = ADDABLE_RELATIONS

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Ajouter un membre</h2>
        <p className="sub">
          Qui est cette personne pour <strong>{displayName(selected)}</strong> ?
        </p>
        <div className="relation-grid">
          {relations.map((r) => (
            <button
              key={r}
              type="button"
              className="relation-btn"
              onClick={() => onPickRelation(r)}
            >
              {RELATION_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
