import type { FamilyTree, Gender, Person, RelationType } from './types'

const STORAGE_KEY = 'heritage-family-tree-v1'

export function createId(): string {
  return crypto.randomUUID()
}

export function createEmptyTree(): FamilyTree {
  return { people: [], rootId: null }
}

export function loadTree(): FamilyTree {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyTree()
    return parseTree(JSON.parse(raw))
  } catch {
    return createEmptyTree()
  }
}

export function saveTree(tree: FamilyTree): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
}

export function parseTree(raw: unknown): FamilyTree {
  const parsed = raw as FamilyTree
  if (!parsed || !Array.isArray(parsed.people)) return createEmptyTree()
  const tree: FamilyTree = {
    people: parsed.people.map(normalizePerson),
    rootId: parsed.rootId ?? parsed.people[0]?.id ?? null,
  }
  return healCoParents(tree)
}

function cleanOptionalName(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function normalizePerson(person: Person): Person {
  return {
    ...person,
    secondName: cleanOptionalName(person.secondName),
    thirdName: cleanOptionalName(person.thirdName),
    photo:
      typeof person.photo === 'string' && person.photo.startsWith('data:image/')
        ? person.photo
        : undefined,
    spouseIds: person.spouseIds ?? [],
    fatherId: person.fatherId ?? null,
    motherId: person.motherId ?? null,
  }
}

export function createPerson(
  data: Omit<Person, 'id' | 'spouseIds'> & { spouseIds?: string[] },
): Person {
  return {
    id: createId(),
    firstName: data.firstName.trim(),
    secondName: cleanOptionalName(data.secondName),
    thirdName: cleanOptionalName(data.thirdName),
    lastName: data.lastName.trim(),
    birthYear: data.birthYear,
    deathYear: data.deathYear,
    gender: data.gender,
    notes: data.notes?.trim() || undefined,
    photo: data.photo || undefined,
    fatherId: data.fatherId ?? null,
    motherId: data.motherId ?? null,
    spouseIds: data.spouseIds ?? [],
  }
}

export function getPerson(tree: FamilyTree, id: string | null | undefined): Person | undefined {
  if (!id) return undefined
  return tree.people.find((p) => p.id === id)
}

export function getChildren(tree: FamilyTree, personId: string): Person[] {
  return tree.people.filter(
    (p) => p.fatherId === personId || p.motherId === personId,
  )
}

export function getSiblings(tree: FamilyTree, person: Person): Person[] {
  return tree.people.filter((p) => {
    if (p.id === person.id) return false
    const sameFather = person.fatherId && p.fatherId === person.fatherId
    const sameMother = person.motherId && p.motherId === person.motherId
    return Boolean(sameFather || sameMother)
  })
}

export function getUniqueLastNames(tree: FamilyTree): string[] {
  const names = new Set(
    tree.people.map((p) => p.lastName.trim()).filter(Boolean),
  )
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr'))
}

export function filterByLastName(tree: FamilyTree, lastName: string): Person[] {
  const query = lastName.trim().toLowerCase()
  if (!query) return tree.people
  return tree.people.filter((p) => p.lastName.toLowerCase().includes(query))
}

export function givenNames(person: Person): string {
  return [person.firstName, person.secondName, person.thirdName]
    .map((n) => n?.trim())
    .filter(Boolean)
    .join(' ')
}

export function displayName(person: Person): string {
  return `${givenNames(person)} ${person.lastName}`.trim()
}

/** Nom court pour les cartes : 1er prénom + nom */
export function shortDisplayName(person: Person): string {
  return `${person.firstName} ${person.lastName}`.trim()
}

export function lifespan(person: Person): string {
  if (!person.birthYear && !person.deathYear) return ''
  if (person.birthYear && person.deathYear) {
    return `${person.birthYear}–${person.deathYear}`
  }
  if (person.birthYear) return `${person.birthYear}`
  return `†${person.deathYear}`
}

export function defaultGenderForRelation(relation: RelationType): Gender {
  switch (relation) {
    case 'father':
    case 'son':
    case 'brother':
      return 'male'
    case 'mother':
    case 'daughter':
    case 'sister':
      return 'female'
    default:
      return 'unknown'
  }
}

function linkSpouses(a: Person, b: Person): void {
  if (!a.spouseIds.includes(b.id)) a.spouseIds.push(b.id)
  if (!b.spouseIds.includes(a.id)) b.spouseIds.push(a.id)
}

/** Relie automatiquement les co-parents qui partagent des enfants. */
export function healCoParents(tree: FamilyTree): FamilyTree {
  const people = tree.people.map((p) => ({
    ...p,
    spouseIds: [...p.spouseIds],
  }))

  for (const child of people) {
    if (child.fatherId && child.motherId) {
      const father = people.find((p) => p.id === child.fatherId)
      const mother = people.find((p) => p.id === child.motherId)
      if (father && mother) linkSpouses(father, mother)
    }
  }

  return { ...tree, people }
}

export function addRelative(
  tree: FamilyTree,
  selectedId: string,
  relation: RelationType,
  data: {
    firstName: string
    secondName?: string
    thirdName?: string
    lastName: string
    birthYear?: number
    deathYear?: number
    gender: Gender
    notes?: string
    photo?: string
  },
): FamilyTree {
  const people = tree.people.map((p) => ({
    ...p,
    spouseIds: [...p.spouseIds],
  }))
  const selected = people.find((p) => p.id === selectedId)
  if (!selected) return tree

  const next = createPerson({
    ...data,
    fatherId: null,
    motherId: null,
  })

  switch (relation) {
    case 'father': {
      next.gender = data.gender === 'unknown' ? 'male' : data.gender
      selected.fatherId = next.id
      if (selected.motherId) {
        const mother = people.find((p) => p.id === selected.motherId)
        if (mother) linkSpouses(mother, next)
      }
      for (const sibling of people) {
        if (
          sibling.id !== selected.id &&
          selected.motherId &&
          sibling.motherId === selected.motherId &&
          !sibling.fatherId
        ) {
          sibling.fatherId = next.id
        }
      }
      people.push(next)
      break
    }
    case 'mother': {
      next.gender = data.gender === 'unknown' ? 'female' : data.gender
      selected.motherId = next.id
      if (selected.fatherId) {
        const father = people.find((p) => p.id === selected.fatherId)
        if (father) linkSpouses(father, next)
        // Tous les enfants du père reçoivent cette mère
        for (const child of people) {
          if (child.fatherId === selected.fatherId && !child.motherId) {
            child.motherId = next.id
          }
        }
      }
      for (const sibling of people) {
        if (
          sibling.id !== selected.id &&
          selected.fatherId &&
          sibling.fatherId === selected.fatherId &&
          !sibling.motherId
        ) {
          sibling.motherId = next.id
        }
      }
      people.push(next)
      break
    }
    case 'son':
    case 'daughter': {
      next.gender =
        data.gender !== 'unknown'
          ? data.gender
          : relation === 'son'
            ? 'male'
            : 'female'
      if (selected.gender === 'male') {
        next.fatherId = selected.id
        next.motherId = selected.spouseIds[0] ?? null
      } else if (selected.gender === 'female') {
        next.motherId = selected.id
        next.fatherId = selected.spouseIds[0] ?? null
      } else {
        next.fatherId = selected.id
      }
      people.push(next)
      break
    }
    case 'brother':
    case 'sister': {
      next.gender =
        data.gender !== 'unknown'
          ? data.gender
          : relation === 'brother'
            ? 'male'
            : 'female'
      next.fatherId = selected.fatherId ?? null
      next.motherId = selected.motherId ?? null
      people.push(next)
      break
    }
    case 'spouse': {
      linkSpouses(selected, next)
      for (const child of people) {
        if (child.fatherId === selected.id && !child.motherId) {
          child.motherId = next.id
        } else if (child.motherId === selected.id && !child.fatherId) {
          child.fatherId = next.id
        }
      }
      people.push(next)
      break
    }
  }

  return healCoParents({
    people,
    rootId: tree.rootId ?? selectedId,
  })
}

export function addFirstPerson(data: {
  firstName: string
  secondName?: string
  thirdName?: string
  lastName: string
  birthYear?: number
  deathYear?: number
  gender: Gender
  notes?: string
  photo?: string
}): FamilyTree {
  const person = createPerson({
    ...data,
    fatherId: null,
    motherId: null,
  })
  return { people: [person], rootId: person.id }
}

export function updatePerson(
  tree: FamilyTree,
  id: string,
  patch: Partial<Omit<Person, 'id' | 'spouseIds' | 'fatherId' | 'motherId'>>,
): FamilyTree {
  return {
    ...tree,
    people: tree.people.map((p) =>
      p.id === id
        ? {
            ...p,
            ...patch,
            firstName: patch.firstName?.trim() ?? p.firstName,
            secondName:
              patch.secondName !== undefined
                ? cleanOptionalName(patch.secondName)
                : p.secondName,
            thirdName:
              patch.thirdName !== undefined
                ? cleanOptionalName(patch.thirdName)
                : p.thirdName,
            lastName: patch.lastName?.trim() ?? p.lastName,
            notes:
              patch.notes !== undefined
                ? patch.notes.trim() || undefined
                : p.notes,
            photo: Object.hasOwn(patch, 'photo')
              ? patch.photo || undefined
              : p.photo,
          }
        : p,
    ),
  }
}

export function deletePerson(tree: FamilyTree, id: string): FamilyTree {
  const people = tree.people
    .filter((p) => p.id !== id)
    .map((p) => ({
      ...p,
      fatherId: p.fatherId === id ? null : p.fatherId,
      motherId: p.motherId === id ? null : p.motherId,
      spouseIds: p.spouseIds.filter((sid) => sid !== id),
    }))
  return {
    people,
    rootId: tree.rootId === id ? (people[0]?.id ?? null) : tree.rootId,
  }
}

/** Indique si la personne a un père ou une mère présent dans l’arbre. */
export function hasParentsInTree(tree: FamilyTree, person: Person): boolean {
  const ids = new Set(tree.people.map((p) => p.id))
  return Boolean(
    (person.fatherId && ids.has(person.fatherId)) ||
      (person.motherId && ids.has(person.motherId)),
  )
}

export interface TreeNode {
  person: Person
  spouse?: Person
  children: TreeNode[]
}

/** Trouve le co-parent (enfants d’abord, puis lien explicite). */
function findPartner(tree: FamilyTree, person: Person): Person | undefined {
  const children = getChildren(tree, person.id)
  const counts = new Map<string, number>()
  for (const child of children) {
    const otherId =
      child.fatherId === person.id
        ? child.motherId
        : child.motherId === person.id
          ? child.fatherId
          : null
    if (otherId) {
      counts.set(otherId, (counts.get(otherId) ?? 0) + 1)
    }
  }

  let bestId: string | null = null
  let bestCount = 0
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      bestId = id
    }
  }
  if (bestId) {
    const fromKids = getPerson(tree, bestId)
    if (fromKids) return fromKids
  }

  for (const id of person.spouseIds) {
    const spouse = getPerson(tree, id)
    if (spouse) return spouse
  }

  return undefined
}

function bloodDescendantCount(tree: FamilyTree, personId: string): number {
  const seen = new Set<string>()
  const walk = (id: string) => {
    for (const child of getChildren(tree, id)) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      walk(child.id)
    }
  }
  walk(personId)
  return seen.size
}

/** Composantes connexes (parenté + co-parents). */
function familyComponents(tree: FamilyTree): string[][] {
  const parent = new Map<string, string>()
  const ensure = (id: string) => {
    if (!parent.has(id)) parent.set(id, id)
  }
  const find = (id: string): string => {
    ensure(id)
    const p = parent.get(id)!
    if (p !== id) {
      const root = find(p)
      parent.set(id, root)
      return root
    }
    return id
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const person of tree.people) {
    ensure(person.id)
    if (person.fatherId) union(person.id, person.fatherId)
    if (person.motherId) union(person.id, person.motherId)
    for (const sid of person.spouseIds) union(person.id, sid)
    const partner = findPartner(tree, person)
    if (partner) union(person.id, partner.id)
  }

  const groups = new Map<string, string[]>()
  for (const person of tree.people) {
    const root = find(person.id)
    const list = groups.get(root) ?? []
    list.push(person.id)
    groups.set(root, list)
  }
  return Array.from(groups.values())
}

/**
 * Une seule racine d’affichage par famille : celle qui couvre
 * le plus de descendants (ex. grands-parents plutôt que le père).
 */
export function findRoots(tree: FamilyTree): Person[] {
  if (tree.people.length === 0) return []

  const roots: Person[] = []

  for (const memberIds of familyComponents(tree)) {
    const members = memberIds
      .map((id) => getPerson(tree, id))
      .filter((p): p is Person => Boolean(p))

    const natural = members.filter((p) => !hasParentsInTree(tree, p))
    const candidates = natural.length > 0 ? natural : members

    candidates.sort((a, b) => {
      const da = bloodDescendantCount(tree, a.id)
      const db = bloodDescendantCount(tree, b.id)
      if (da !== db) return db - da
      const ya = a.birthYear ?? 9999
      const yb = b.birthYear ?? 9999
      if (ya !== yb) return ya - yb
      return displayName(a).localeCompare(displayName(b), 'fr')
    })

    if (candidates[0]) roots.push(candidates[0])
  }

  roots.sort((a, b) => {
    const ya = a.birthYear ?? 9999
    const yb = b.birthYear ?? 9999
    if (ya !== yb) return ya - yb
    return displayName(a).localeCompare(displayName(b), 'fr')
  })

  return roots
}

/**
 * Build a descendants tree from a root.
 * Couples are shown together; children hang under the couple.
 */
export function buildDescendantTree(
  tree: FamilyTree,
  rootId: string,
  visited = new Set<string>(),
): TreeNode | null {
  if (visited.has(rootId)) return null
  const person = getPerson(tree, rootId)
  if (!person) return null
  visited.add(rootId)

  const partner = findPartner(tree, person)
  const partnerBlocked =
    partner &&
    (visited.has(partner.id) || hasParentsInTree(tree, partner))
  const canAttach = Boolean(partner) && !partnerBlocked

  let displayPerson = person
  let spouse: Person | undefined

  if (canAttach && partner) {
    if (
      !hasParentsInTree(tree, person) &&
      person.gender === 'female' &&
      partner.gender === 'male'
    ) {
      displayPerson = partner
      spouse = person
    } else {
      spouse = partner
    }
    visited.add(partner.id)
  }

  let childPeople = getChildren(tree, displayPerson.id)
  if (spouse) {
    for (const c of getChildren(tree, spouse.id)) {
      if (!childPeople.find((x) => x.id === c.id)) childPeople.push(c)
    }
  } else if (partner && hasParentsInTree(tree, partner)) {
    // L’autre parent a sa propre lignée : les enfants communs s’affichent là-bas
    childPeople = childPeople.filter((c) => {
      const otherId =
        c.fatherId === displayPerson.id
          ? c.motherId
          : c.motherId === displayPerson.id
            ? c.fatherId
            : null
      return otherId !== partner.id
    })
  }

  childPeople.sort((a, b) => {
    const ya = a.birthYear ?? 9999
    const yb = b.birthYear ?? 9999
    if (ya !== yb) return ya - yb
    return displayName(a).localeCompare(displayName(b), 'fr')
  })

  return {
    person: displayPerson,
    spouse,
    children: childPeople
      .map((c) => buildDescendantTree(tree, c.id, visited))
      .filter((n): n is TreeNode => n !== null),
  }
}

/** Forêt complète : une branche par famille, sans nœuds flottants. */
export function buildForest(tree: FamilyTree): TreeNode[] {
  const visited = new Set<string>()
  const nodes: TreeNode[] = []

  for (const root of findRoots(tree)) {
    if (visited.has(root.id)) continue
    const node = buildDescendantTree(tree, root.id, visited)
    if (node) nodes.push(node)
  }

  for (const person of tree.people) {
    if (visited.has(person.id)) continue
    const partner = findPartner(tree, person)
    if (partner && visited.has(partner.id)) continue
    // Ne pas recréer une mini-branche avec les enfants déjà placés ailleurs
    if (partner && hasParentsInTree(tree, partner)) continue
    const node = buildDescendantTree(tree, person.id, visited)
    if (node) nodes.push(node)
  }

  return nodes
}

// —— Layout positionné (enfants centrés sous les parents) ——

export type GenUnit =
  | { key: string; kind: 'single'; person: Person }
  | { key: string; kind: 'pair'; left: Person; right: Person }

export interface GenerationLayout {
  generations: GenUnit[][]
  families: {
    key: string
    parentIds: string[]
    childIds: string[]
  }[]
}

/** Dimensions utilisées pour le placement (doivent matcher le CSS). */
export const LAYOUT = {
  cardW: 108,
  cardH: 98,
  pairGap: 36,
  unitGap: 44,
  rowGap: 78,
  padX: 28,
  padY: 24,
  /** Hauteur relative où passe le trait de couple (0–1) */
  coupleLineAt: 0.38,
} as const

export interface PositionedNode {
  person: Person
  /** Centre horizontal de la carte */
  cx: number
  /** Haut de la carte */
  top: number
  /** Génération d’affichage (0 = aïeux) */
  gen: number
}

export interface PositionedFamily {
  key: string
  parentIds: string[]
  childIds: string[]
}

export interface PositionedCouple {
  key: string
  leftId: string
  rightId: string
}

export interface PositionedLayout {
  nodes: PositionedNode[]
  byId: Map<string, PositionedNode>
  families: PositionedFamily[]
  couples: PositionedCouple[]
  width: number
  height: number
  generations: number
}

function bloodGenerationMap(tree: FamilyTree): Map<string, number> {
  const gen = new Map<string, number>()
  for (const p of tree.people) {
    if (!hasParentsInTree(tree, p)) gen.set(p.id, 0)
  }

  let changed = true
  let guard = 0
  while (changed && guard < tree.people.length + 8) {
    changed = false
    guard += 1
    for (const p of tree.people) {
      let parentMax = -1
      if (p.fatherId && gen.has(p.fatherId)) {
        parentMax = Math.max(parentMax, gen.get(p.fatherId)!)
      }
      if (p.motherId && gen.has(p.motherId)) {
        parentMax = Math.max(parentMax, gen.get(p.motherId)!)
      }
      if (parentMax >= 0) {
        const next = parentMax + 1
        if (gen.get(p.id) !== next) {
          gen.set(p.id, next)
          changed = true
        }
      }
    }
  }

  for (const p of tree.people) {
    if (!gen.has(p.id)) gen.set(p.id, 0)
  }
  return gen
}

function collectFamilies(tree: FamilyTree): PositionedFamily[] {
  const ids = new Set(tree.people.map((p) => p.id))
  const familyMap = new Map<string, PositionedFamily>()

  for (const child of tree.people) {
    const parentIds = [child.fatherId, child.motherId].filter(
      (id): id is string => Boolean(id && ids.has(id)),
    )
    if (parentIds.length === 0) continue
    const key = [...parentIds].sort().join('+')
    const existing = familyMap.get(key)
    if (existing) {
      if (!existing.childIds.includes(child.id)) existing.childIds.push(child.id)
    } else {
      familyMap.set(key, {
        key,
        parentIds: [...new Set(parentIds)],
        childIds: [child.id],
      })
    }
  }

  for (const fam of familyMap.values()) {
    fam.childIds.sort((a, b) => {
      const pa = getPerson(tree, a)!
      const pb = getPerson(tree, b)!
      const ya = pa.birthYear ?? 9999
      const yb = pb.birthYear ?? 9999
      if (ya !== yb) return ya - yb
      return displayName(pa).localeCompare(displayName(pb), 'fr')
    })
  }

  return Array.from(familyMap.values())
}

/**
 * Génération d’affichage :
 * - base = profondeur de sang
 * - les co-parents (enfants en commun) sont alignés sur la même rangée
 * - les enfants restent strictement en dessous
 * - les conjoints sans parents dans l’arbre rejoignent leur partenaire
 */
function displayGenerationMap(tree: FamilyTree): Map<string, number> {
  const blood = bloodGenerationMap(tree)
  const display = new Map(blood)
  const families = collectFamilies(tree)

  let changed = true
  let guard = 0
  while (changed && guard < tree.people.length * 4 + 10) {
    changed = false
    guard += 1

    // Conjoints entrés dans la famille → rangée du partenaire
    for (const p of tree.people) {
      if (hasParentsInTree(tree, p)) continue
      const partner = findPartner(tree, p)
      if (!partner) continue
      const target = display.get(partner.id)
      if (target === undefined) continue
      if (display.get(p.id) !== target) {
        display.set(p.id, target)
        changed = true
      }
    }

    // Co-parents alignés
    for (const fam of families) {
      if (fam.parentIds.length < 2) continue
      const gens = fam.parentIds.map((id) => display.get(id) ?? 0)
      const m = Math.max(...gens)
      for (const id of fam.parentIds) {
        if ((display.get(id) ?? 0) !== m) {
          display.set(id, m)
          changed = true
        }
      }
    }

    // Enfants strictement sous le parent le plus bas
    for (const child of tree.people) {
      let parentMax = -1
      if (child.fatherId && display.has(child.fatherId)) {
        parentMax = Math.max(parentMax, display.get(child.fatherId)!)
      }
      if (child.motherId && display.has(child.motherId)) {
        parentMax = Math.max(parentMax, display.get(child.motherId)!)
      }
      if (parentMax < 0) continue
      const need = parentMax + 1
      if ((display.get(child.id) ?? 0) < need) {
        display.set(child.id, need)
        changed = true
      }
    }
  }

  return display
}

function orderPair(a: Person, b: Person): [Person, Person] {
  if (a.gender === 'male' && b.gender !== 'male') return [a, b]
  if (b.gender === 'male' && a.gender !== 'male') return [b, a]
  return displayName(a).localeCompare(displayName(b), 'fr') <= 0 ? [a, b] : [b, a]
}

function unitWidth(unit: GenUnit): number {
  return unit.kind === 'pair'
    ? LAYOUT.cardW * 2 + LAYOUT.pairGap
    : LAYOUT.cardW
}

function unitPeople(unit: GenUnit): Person[] {
  return unit.kind === 'pair' ? [unit.left, unit.right] : [unit.person]
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function buildUnitsByGeneration(
  tree: FamilyTree,
  gen: Map<string, number>,
): GenUnit[][] {
  const maxGen = Math.max(0, ...gen.values())
  const placed = new Set<string>()
  const generations: GenUnit[][] = []
  const indexOf = new Map<string, number>()
  let globalIndex = 0

  const parentSortKey = (person: Person): number => {
    const indexes: number[] = []
    if (person.fatherId && indexOf.has(person.fatherId)) {
      indexes.push(indexOf.get(person.fatherId)!)
    }
    if (person.motherId && indexOf.has(person.motherId)) {
      indexes.push(indexOf.get(person.motherId)!)
    }
    if (indexes.length === 0) return 9999
    return mean(indexes)
  }

  for (let g = 0; g <= maxGen; g++) {
    const rowPeople = tree.people
      .filter((p) => gen.get(p.id) === g)
      .sort((a, b) => {
        const ka = parentSortKey(a)
        const kb = parentSortKey(b)
        if (ka !== kb) return ka - kb
        const ya = a.birthYear ?? 9999
        const yb = b.birthYear ?? 9999
        if (ya !== yb) return ya - yb
        return displayName(a).localeCompare(displayName(b), 'fr')
      })

    const units: GenUnit[] = []
    const remaining = [...rowPeople]

    while (remaining.length > 0) {
      const person = remaining.shift()!
      if (placed.has(person.id)) continue

      const partner = findPartner(tree, person)
      const sameGen =
        partner &&
        !placed.has(partner.id) &&
        gen.get(partner.id) === g &&
        rowPeople.some((p) => p.id === partner.id)

      if (partner && sameGen) {
        const partnerIdx = remaining.findIndex((p) => p.id === partner.id)
        if (partnerIdx >= 0) remaining.splice(partnerIdx, 1)
        const [left, right] = orderPair(person, partner)
        units.push({
          key: `pair-${left.id}-${right.id}`,
          kind: 'pair',
          left,
          right,
        })
        placed.add(left.id)
        placed.add(right.id)
        indexOf.set(left.id, globalIndex++)
        indexOf.set(right.id, globalIndex++)
      } else {
        units.push({ key: `solo-${person.id}`, kind: 'single', person })
        placed.add(person.id)
        indexOf.set(person.id, globalIndex++)
      }
    }

    if (units.length > 0) generations.push(units)
  }

  return generations
}

/** Écarte les unités qui se chevauchent dans une rangée. */
function resolveOverlaps(
  lefts: Map<string, number>,
  units: GenUnit[],
): void {
  if (units.length === 0) return
  const ordered = [...units].sort(
    (a, b) => (lefts.get(a.key) ?? 0) - (lefts.get(b.key) ?? 0),
  )
  let cursor = lefts.get(ordered[0].key) ?? LAYOUT.padX
  for (const unit of ordered) {
    const w = unitWidth(unit)
    const current = lefts.get(unit.key) ?? cursor
    const next = Math.max(current, cursor)
    lefts.set(unit.key, next)
    cursor = next + w + LAYOUT.unitGap
  }
}

/**
 * Place chaque personne en (x, y) : générations en rangées,
 * enfants recentrés sous leurs parents (méthode barycentre).
 */
export function buildPositionedLayout(tree: FamilyTree): PositionedLayout {
  if (tree.people.length === 0) {
    return {
      nodes: [],
      byId: new Map(),
      families: [],
      couples: [],
      width: 0,
      height: 0,
      generations: 0,
    }
  }

  const gen = displayGenerationMap(tree)
  const generations = buildUnitsByGeneration(tree, gen)
  const families = collectFamilies(tree)
  const unitOfPerson = new Map<string, GenUnit>()
  for (const row of generations) {
    for (const unit of row) {
      for (const p of unitPeople(unit)) unitOfPerson.set(p.id, unit)
    }
  }

  // Position initiale : rangée 0 à gauche, puis enfants sous les parents
  const lefts = new Map<string, number>()
  if (generations[0]) {
    let x = LAYOUT.padX
    for (const unit of generations[0]) {
      lefts.set(unit.key, x)
      x += unitWidth(unit) + LAYOUT.unitGap
    }
  }

  for (let g = 1; g < generations.length; g++) {
    const row = generations[g]
    const parentRow = generations[g - 1]
    const placedKeys = new Set<string>()
    const slots: { key: string; left: number; width: number }[] = []

    // Familles dont les parents sont au-dessus → centrer les enfants dessous
    for (const fam of families) {
      const parentUnits = [
        ...new Set(
          fam.parentIds
            .map((id) => unitOfPerson.get(id))
            .filter((u): u is GenUnit => Boolean(u && parentRow.includes(u))),
        ),
      ]
      const childUnits = [
        ...new Set(
          fam.childIds
            .map((id) => unitOfPerson.get(id))
            .filter((u): u is GenUnit => Boolean(u && row.includes(u))),
        ),
      ].filter((u) => !placedKeys.has(u.key))

      if (parentUnits.length === 0 || childUnits.length === 0) continue

      const parentMid = mean(
        parentUnits.map((u) => (lefts.get(u.key) ?? 0) + unitWidth(u) / 2),
      )
      const blockW =
        childUnits.reduce((sum, u) => sum + unitWidth(u), 0) +
        LAYOUT.unitGap * Math.max(0, childUnits.length - 1)
      let cursor = parentMid - blockW / 2
      for (const u of childUnits) {
        const w = unitWidth(u)
        slots.push({ key: u.key, left: cursor, width: w })
        placedKeys.add(u.key)
        cursor += w + LAYOUT.unitGap
      }
    }

    // Unités sans parents placés au-dessus
    for (const unit of row) {
      if (placedKeys.has(unit.key)) continue
      slots.push({
        key: unit.key,
        left: LAYOUT.padX + slots.length * 20,
        width: unitWidth(unit),
      })
      placedKeys.add(unit.key)
    }

    slots.sort((a, b) => a.left - b.left)
    let cursor = LAYOUT.padX
    for (const slot of slots) {
      const left = Math.max(slot.left, cursor)
      lefts.set(slot.key, left)
      cursor = left + slot.width + LAYOUT.unitGap
    }
  }

  // Recentralisation parents ↔ enfants
  for (let pass = 0; pass < 32; pass++) {
    for (const fam of families) {
      const parentUnits = [
        ...new Set(
          fam.parentIds
            .map((id) => unitOfPerson.get(id))
            .filter((u): u is GenUnit => Boolean(u)),
        ),
      ]
      const childUnits = [
        ...new Set(
          fam.childIds
            .map((id) => unitOfPerson.get(id))
            .filter((u): u is GenUnit => Boolean(u)),
        ),
      ]
      if (parentUnits.length === 0 || childUnits.length === 0) continue

      const parentCenters = parentUnits.map((u) => {
        const left = lefts.get(u.key) ?? 0
        return left + unitWidth(u) / 2
      })
      const childCenters = childUnits.map((u) => {
        const left = lefts.get(u.key) ?? 0
        return left + unitWidth(u) / 2
      })
      const delta = mean(parentCenters) - mean(childCenters)
      if (Math.abs(delta) < 0.5) continue

      // Favorise le déplacement des enfants sous les parents
      if (pass % 3 === 2) {
        for (const u of parentUnits) {
          lefts.set(u.key, (lefts.get(u.key) ?? 0) - delta * 0.35)
        }
      } else {
        for (const u of childUnits) {
          lefts.set(u.key, (lefts.get(u.key) ?? 0) + delta * 0.65)
        }
      }
    }

    for (const row of generations) resolveOverlaps(lefts, row)
  }

  // Normalise : tout décale pour minX = padX
  let minLeft = Infinity
  for (const row of generations) {
    for (const unit of row) {
      minLeft = Math.min(minLeft, lefts.get(unit.key) ?? 0)
    }
  }
  const shift = LAYOUT.padX - minLeft
  if (Math.abs(shift) > 0.01) {
    for (const [key, value] of lefts) lefts.set(key, value + shift)
  }

  const nodes: PositionedNode[] = []
  const couples: PositionedCouple[] = []
  let maxRight = 0
  const rowCount = generations.length

  generations.forEach((row, rowIndex) => {
    const top = LAYOUT.padY + rowIndex * (LAYOUT.cardH + LAYOUT.rowGap)
    for (const unit of row) {
      const left = lefts.get(unit.key) ?? LAYOUT.padX
      const people = unitPeople(unit)
      people.forEach((person, i) => {
        const cx = left + LAYOUT.cardW / 2 + i * (LAYOUT.cardW + LAYOUT.pairGap)
        nodes.push({
          person,
          cx,
          top,
          gen: rowIndex,
        })
        maxRight = Math.max(maxRight, cx + LAYOUT.cardW / 2)
      })
      if (unit.kind === 'pair') {
        couples.push({
          key: unit.key,
          leftId: unit.left.id,
          rightId: unit.right.id,
        })
      }
    }
  })

  const byId = new Map(nodes.map((n) => [n.person.id, n]))
  const height =
    rowCount === 0
      ? 0
      : LAYOUT.padY * 2 +
        rowCount * LAYOUT.cardH +
        Math.max(0, rowCount - 1) * LAYOUT.rowGap

  return {
    nodes,
    byId,
    families,
    couples,
    width: maxRight + LAYOUT.padX,
    height,
    generations: rowCount,
  }
}

/** @deprecated Conservé pour compat — préfère buildPositionedLayout */
export function buildGenerationLayout(tree: FamilyTree): GenerationLayout {
  const positioned = buildPositionedLayout(tree)
  const gen = displayGenerationMap(tree)
  return {
    generations: buildUnitsByGeneration(tree, gen),
    families: positioned.families,
  }
}

export function parentLabelFor(person: Person): string {
  if (person.gender === 'male') return 'Père'
  if (person.gender === 'female') return 'Mère'
  return 'Parent'
}

export function childLabelFor(person: Person): string {
  if (person.gender === 'male') return 'Fils'
  if (person.gender === 'female') return 'Fille'
  return 'Enfant'
}
