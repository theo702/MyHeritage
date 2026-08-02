export type Gender = 'male' | 'female' | 'other' | 'unknown'

export type RelationType =
  | 'father'
  | 'mother'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'spouse'

export interface Person {
  id: string
  firstName: string
  /** Deuxième prénom (optionnel) */
  secondName?: string
  /** Troisième prénom (optionnel) */
  thirdName?: string
  lastName: string
  birthYear?: number
  deathYear?: number
  gender: Gender
  notes?: string
  fatherId?: string | null
  motherId?: string | null
  spouseIds: string[]
}

export interface FamilyTree {
  people: Person[]
  rootId: string | null
}

export const RELATION_LABELS: Record<RelationType, string> = {
  father: 'Père',
  mother: 'Mère',
  son: 'Fils',
  daughter: 'Fille',
  brother: 'Frère',
  sister: 'Sœur',
  spouse: 'Partenaire',
}

/** Relations proposées à l’ajout (sans « conjoint ») */
export const ADDABLE_RELATIONS: RelationType[] = [
  'father',
  'mother',
  'son',
  'daughter',
  'brother',
  'sister',
]

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  unknown: 'Non précisé',
}
