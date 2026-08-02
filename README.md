# Héritage

Application personnelle pour construire et explorer ton arbre généalogique.

**En ligne :** [myheritagefamily.netlify.app](https://myheritagefamily.netlify.app)

## Fonctionnalités

- Vue arbre des descendants (couples + enfants)
- Filtrer par nom de famille
- Cliquer sur une personne → ajouter père, mère, frère, sœur, fils, fille ou conjoint
- Modifier / supprimer une personne
- Données sauvegardées dans le navigateur (`localStorage`)

## Démarrer en local

```bash
npm install
npm run dev
```

Build de production :

```bash
npm run build
npm run preview
```

## Déploiement Netlify

- **Build command :** `npm run build`
- **Publish directory :** `dist`
- Branche à déployer : celle qui contient l’app (fusionne la PR dans `main`, ou pointe Netlify vers cette branche)
