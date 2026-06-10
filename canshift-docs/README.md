# canshift-docs

Documentation utilisateur et technique pour CANShift. Stack : [Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/).

## Dev

```bash
cd canshift-docs
npm install
npm run dev
```

Le site écoute sur `http://localhost:4321`.

## Build

```bash
npm run build       # → dist/
npm run preview     # serve dist/ en local
```

## Deploy

Build static — déployable sur n'importe quel host (Vercel, GitHub Pages, Cloudflare Pages, etc.).
Le `astro.config.mjs` pointe sur `site: "https://canshift-docs.example"` — à mettre à jour avec l'URL de prod avant le premier deploy.

## Structure

```
src/content/docs/
├── index.mdx              # landing page (splash)
├── changelog.mdx          # rendered from GitHub Releases at build time
├── user-guide/            # 🚗 audience pilote / installateur
│   ├── getting-started/
│   ├── install/
│   ├── configure/
│   └── usage/
└── technical/             # 🔧 audience dev / contributeur
    ├── architecture/      # rehome de #1403 — rationale stripped from firmware comments
    ├── reference/         # pinout, schemas, build flags
    └── contributing/      # workflow PR, setup dev
```

## Convention release / changelog

Voir `.claude/projects/.../release_notes_quality.md` côté projet : chaque
GitHub Release doit avoir une description structurée (Pilote / Tuner /
Firmware / Breaking), car le changelog rendu ici les pull au build.

## Liens

- [GitHub monorepo](https://github.com/tburkhalterr/CANShift)
- [Flasher](https://github.com/tburkhalterr/canshift-flasher)
- [Tuner (Vercel)](https://canshift-tuner.vercel.app)
