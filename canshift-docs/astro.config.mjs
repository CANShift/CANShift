// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://canshift-docs.example",
  integrations: [
    starlight({
      title: "CANShift Docs",
      description:
        "Documentation utilisateur et technique pour le dashboard CANShift.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/tburkhalterr/CANShift",
        },
      ],
      sidebar: [
        {
          label: "Bienvenue",
          items: [{ label: "Vue d'ensemble", link: "/" }],
        },
        {
          label: "Guide utilisateur",
          badge: { text: "Pilote", variant: "success" },
          collapsed: false,
          items: [
            {
              label: "Démarrage rapide",
              autogenerate: { directory: "user-guide/getting-started" },
            },
            {
              label: "Installation",
              autogenerate: { directory: "user-guide/install" },
            },
            {
              label: "Configuration",
              autogenerate: { directory: "user-guide/configure" },
            },
            {
              label: "Utilisation",
              autogenerate: { directory: "user-guide/usage" },
            },
          ],
        },
        {
          label: "Documentation technique",
          badge: { text: "Dev", variant: "caution" },
          collapsed: false,
          items: [
            {
              label: "Architecture firmware",
              autogenerate: { directory: "technical/architecture" },
            },
            {
              label: "Référence",
              autogenerate: { directory: "technical/reference" },
            },
            {
              label: "Contribuer",
              autogenerate: { directory: "technical/contributing" },
            },
          ],
        },
        {
          label: "Liens externes",
          collapsed: true,
          items: [
            {
              label: "Flasher (web)",
              link: "https://github.com/tburkhalterr/canshift-flasher",
              attrs: { target: "_blank", rel: "noopener" },
              badge: { text: "↗", variant: "note" },
            },
            {
              label: "Tuner (web)",
              link: "https://canshift-tuner.vercel.app",
              attrs: { target: "_blank", rel: "noopener" },
              badge: { text: "↗", variant: "note" },
            },
            {
              label: "GitHub monorepo",
              link: "https://github.com/tburkhalterr/CANShift",
              attrs: { target: "_blank", rel: "noopener" },
              badge: { text: "↗", variant: "note" },
            },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
      lastUpdated: true,
      pagination: true,
    }),
  ],
});
