import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

type FamilyTree = {
  people: unknown[]
  rootId: string | null
}

const EMPTY: FamilyTree = { people: [], rootId: null }

function store() {
  return getStore({ name: 'heritage', consistency: 'strong' })
}

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }

  try {
    const blobs = store()

    if (req.method === 'GET') {
      const data = await blobs.get('family-tree', { type: 'json' })
      const tree =
        data &&
        typeof data === 'object' &&
        Array.isArray((data as FamilyTree).people)
          ? (data as FamilyTree)
          : EMPTY
      return new Response(JSON.stringify(tree), { status: 200, headers })
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = (await req.json()) as FamilyTree
      if (!body || !Array.isArray(body.people)) {
        return new Response(JSON.stringify({ error: 'Arbre invalide' }), {
          status: 400,
          headers,
        })
      }
      const tree: FamilyTree = {
        people: body.people,
        rootId: body.rootId ?? null,
      }
      await blobs.setJSON('family-tree', tree)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers,
    })
  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur de sauvegarde' }),
      { status: 500, headers },
    )
  }
}

export const config: Config = {
  path: '/api/tree',
}
