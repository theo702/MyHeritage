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
    const parsed = JSON.parse(raw) as FamilyTree
    if (!parsed || !Array.isArray(parsed.people)) return createEmptyTree()
    const tree: FamilyTree = {
      people: parsed.people.map(normalizePerson),
      rootId: parsed.rootId ?? parsed.people[0]?.id ?? null,
    }
    return healCoParents(tree)
  } catch {
    return createEmptyTree()
  }
}

export function saveTree(tree: FamilyTree): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
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
  const birth = person.birthYear ?? '?'
  const death = person.deathYear ?? ''
  return death ? `${birth} – ${death}` : `né(e) ${birth}`
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
  lastName: string
  birthYear?: number
  deathYear?: number
  gender: Gender
  notes?: string
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
            notes: patch.notes?.trim() || undefined,
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

/** Trouve le co-parent (lien explicite ou déduit des enfants). */
function findPartner(tree: FamilyTree, person: Person): Person | undefined {
  for (const id of person.spouseIds) {
    const spouse = getPerson(tree, id)
    if (spouse) return spouse
  }

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
  return bestId ? getPerson(tree, bestId) : undefined
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

// —— Layout par générations (affichage fiable) ——

export type GenUnit =
  | { key: string; kind: 'single'; person: Person }
  | { key: string; kind: 'pair'; left: Person; right: Person }

export interface GenerationLayout {
  generations: GenUnit[][]
  /** Liens parent → enfant */
  links: { parentId: string; childId: string }[]
}

function computeGenerationMap(tree: FamilyTree): Map<string, number> {
  const gen = new Map<string, number>()

  for (const p of tree.people) {
    if (!hasParentsInTree(tree, p)) gen.set(p.id, 0)
  }

  let changed = true
  let guard = 0
  while (changed && guard < tree.people.length + 5) {
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

    // Co-parents sur la même génération
    for (const p of tree.people) {
      const partner = findPartner(tree, p)
      if (!partner) continue
      const ga = gen.get(p.id)
      const gb = gen.get(partner.id)
      if (ga === undefined && gb === undefined) continue
      const m = Math.max(ga ?? 0, gb ?? 0)
      if (gen.get(p.id) !== m) {
        gen.set(p.id, m)
        changed = true
      }
      if (gen.get(partner.id) !== m) {
        gen.set(partner.id, m)
        changed = true
      }
    }
  }

  for (const p of tree.people) {
    if (!gen.has(p.id)) gen.set(p.id, 0)
  }
  return gen
}

function orderPair(a: Person, b: Person): [Person, Person] {
  if (a.gender === 'male' && b.gender !== 'male') return [a, b]
  if (b.gender === 'male' && a.gender !== 'male') return [b, a]
  return displayName(a).localeCompare(displayName(b), 'fr') <= 0 ? [a, b] : [b, a]
}

/** Rangées : génération 0 (aïeux) en haut → descendants en bas. */
export function buildGenerationLayout(tree: FamilyTree): GenerationLayout {
  if (tree.people.length === 0) {
    return { generations: [], links: [] }
  }

  const gen = computeGenerationMap(tree)
  const maxGen = Math.max(0, ...gen.values())
  const placed = new Set<string>()
  const generations: GenUnit[][] = []

  for (let g = 0; g <= maxGen; g++) {
    const rowPeople = tree.people
      .filter((p) => gen.get(p.id) === g)
      .sort((a, b) => {
        const ya = a.birthYear ?? 9999
        const yb = b.birthYear ?? 9999
        if (ya !== yb) return ya - yb
        return displayName(a).localeCompare(displayName(b), 'fr')
      })

    const units: GenUnit[] = []
    for (const person of rowPeople) {
      if (placed.has(person.id)) continue
      const partner = findPartner(tree, person)
      if (
        partner &&
        gen.get(partner.id) === g &&
        !placed.has(partner.id)
      ) {
        const [left, right] = orderPair(person, partner)
        units.push({
          key: `pair-${left.id}-${right.id}`,
          kind: 'pair',
          left,
          right,
        })
        placed.add(left.id)
        placed.add(right.id)
      } else {
        units.push({ key: `solo-${person.id}`, kind: 'single', person })
        placed.add(person.id)
      }
    }
    if (units.length > 0) generations.push(units)
  }

  const links: { parentId: string; childId: string }[] = []
  const ids = new Set(tree.people.map((p) => p.id))
  for (const child of tree.people) {
    if (child.fatherId && ids.has(child.fatherId)) {
      links.push({ parentId: child.fatherId, childId: child.id })
    }
    if (child.motherId && ids.has(child.motherId)) {
      links.push({ parentId: child.motherId, childId: child.id })
    }
  }

  return { generations, links }
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
