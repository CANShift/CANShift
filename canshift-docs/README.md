# canshift-docs

User and technical documentation for CANShift. Stack: [Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/).

## Dev

```bash
cd canshift-docs
npm install
npm run dev
```

The site serves on `http://localhost:4321`.

## Build

```bash
npm run build       # → dist/
npm run preview     # serve dist/ locally
```

## Deploy

Static build — deployable to any host (Vercel, GitHub Pages, Cloudflare Pages, etc.).
`astro.config.mjs` is wired to `site: "https://canshift-docs.example"` — update to the production URL before the first deploy.

## Structure

```
src/content/docs/
├── index.mdx              # landing page (splash)
├── changelog.mdx          # rendered from GitHub Releases at build time
├── user-guide/            # 🚗 audience: driver / installer
│   ├── getting-started/
│   ├── install/
│   ├── configure/
│   └── usage/
└── technical/             # 🔧 audience: dev / contributor
    ├── architecture/      # rehome of #1403 — rationale stripped from firmware comments
    ├── reference/         # pinout, schemas, build flags
    └── contributing/      # PR workflow, dev setup
```

## Release / changelog convention

See `.claude/projects/.../release_notes_quality.md` on the project side: every
GitHub Release must carry a structured description (Driver / Tuner / Firmware /
Breaking) — the changelog rendered here pulls them at build time. An empty
release renders as a blank entry.

## Links

- [GitHub monorepo](https://github.com/tburkhalterr/CANShift)
- [Tuner (Vercel) — includes flasher at `/firmware`](https://canshift-tuner.vercel.app)
