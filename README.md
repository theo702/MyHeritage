# Héritage

Application personnelle pour construire et explorer ton arbre généalogique.

**En ligne :** [myheritagefamily.netlify.app](https://myheritagefamily.netlify.app)

L’arbre est **partagé** : tout le monde voit et peut modifier le même arbre, sans compte ni code. Les données sont stockées sur Netlify Blobs.

## Fonctionnalités

- Vue arbre par générations
- Filtrer par nom de famille
- Ajouter père, mère, frère, sœur, fils ou fille
- Modifier / supprimer une personne
- Synchronisation cloud (accessible partout)

## Démarrer en local

```bash
npm install
npm run dev
```

En local sans Netlify, la sync cloud est indisponible et le mode hors-ligne (localStorage) est utilisé. Pour tester l’API :

```bash
npx netlify dev
```

## Déploiement Netlify

- **Build command :** `npm run build`
- **Publish directory :** `dist`
- **Functions :** `netlify/functions`
