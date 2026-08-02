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
    return {
      people: parsed.people.map(normalizePerson),
      rootId: parsed.rootId ?? parsed.people[0]?.id ?? null,
    }
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

export function addRelative(
  tree: FamilyTree,
  selectedId: string,
  relation: RelationType,
  data: {
    firstName: string
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
      if (selected.fatherId) {
        const oldFather = people.find((p) => p.id === selected.fatherId)
        if (oldFather) {
          // Keep existing father; do not overwrite silently — replace link
        }
      }
      selected.fatherId = next.id
      // Children already pointing to old father stay; selected now has new father
      // Also attach siblings of selected to same father if they share mother
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
      // Share children: children of selected without the other parent get next as parent
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

  return {
    people,
    rootId: tree.rootId ?? selectedId,
  }
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

/** People with no parents in the tree — natural roots for layout */
export function findRoots(tree: FamilyTree): Person[] {
  const ids = new Set(tree.people.map((p) => p.id))
  const roots = tree.people.filter((p) => {
    const fatherInTree = p.fatherId && ids.has(p.fatherId)
    const motherInTree = p.motherId && ids.has(p.motherId)
    return !fatherInTree && !motherInTree
  })
  if (roots.length > 0) return roots
  return tree.people.slice(0, 1)
}

export interface TreeNode {
  person: Person
  spouse?: Person
  children: TreeNode[]
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

  const spouse = person.spouseIds
    .map((id) => getPerson(tree, id))
    .find(Boolean)

  if (spouse) visited.add(spouse.id)

  const childPeople = getChildren(tree, person.id)
  if (spouse) {
    const spouseChildren = getChildren(tree, spouse.id)
    for (const c of spouseChildren) {
      if (!childPeople.find((x) => x.id === c.id)) childPeople.push(c)
    }
  }

  // Stable sort by birth year then name
  childPeople.sort((a, b) => {
    const ya = a.birthYear ?? 9999
    const yb = b.birthYear ?? 9999
    if (ya !== yb) return ya - yb
    return displayName(a).localeCompare(displayName(b), 'fr')
  })

  return {
    person,
    spouse,
    children: childPeople
      .map((c) => buildDescendantTree(tree, c.id, visited))
      .filter((n): n is TreeNode => n !== null),
  }
}
