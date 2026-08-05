import type { FamilyTree } from './types'
import { loadTree, parseTree, saveTree } from './family'

const API_URL = '/api/tree'

export type SyncStatus = 'loading' | 'online' | 'saving' | 'offline' | 'error'

/** Charge l’arbre partagé (cloud). Migre le local si le cloud est vide. */
export async function fetchSharedTree(): Promise<{
  tree: FamilyTree
  status: SyncStatus
}> {
  try {
    const res = await fetch(API_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const remote = parseTree(await res.json())
    const local = loadTree()

    // Première fois : pousser l’arbre local vers le cloud
    if (remote.people.length === 0 && local.people.length > 0) {
      await pushSharedTree(local)
      saveTree(local)
      return { tree: local, status: 'online' }
    }

    saveTree(remote)
    return { tree: remote, status: 'online' }
  } catch {
    const local = loadTree()
    return { tree: local, status: 'offline' }
  }
}

/** Enregistre l’arbre partagé pour tout le monde. */
export async function pushSharedTree(tree: FamilyTree): Promise<boolean> {
  saveTree(tree)
  try {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tree),
    })
    return res.ok
  } catch {
    return false
  }
}
