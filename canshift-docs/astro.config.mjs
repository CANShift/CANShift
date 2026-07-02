// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://docs.canshift.tmbk.ch",
  integrations: [
    react(),
    starlight({
      title: "CANShift Docs",
      description:
        "User and technical documentation for the CANShift dashboard.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/tburkhalterr/CANShift",
        },
      ],
      sidebar: [
        {
          label: "Welcome",
          items: [{ label: "Overview", link: "/" }],
        },
        {
          label: "User guide",
          badge: { text: "Driver", variant: "success" },
          collapsed: false,
          items: [
            {
              label: "Get started",
              items: [
                { autogenerate: { directory: "user-guide/getting-started" } },
              ],
            },
            {
              label: "Install",
              items: [{ autogenerate: { directory: "user-guide/install" } }],
            },
            {
              label: "Configure",
              items: [{ autogenerate: { directory: "user-guide/configure" } }],
            },
            {
              label: "Use",
              items: [{ autogenerate: { directory: "user-guide/usage" } }],
            },
          ],
        },
        {
          label: "Technical docs",
          badge: { text: "Dev", variant: "caution" },
          collapsed: false,
          items: [
            {
              label: "Firmware architecture",
              items: [
                { autogenerate: { directory: "technical/architecture" } },
              ],
            },
            {
              label: "Reference",
              items: [{ autogenerate: { directory: "technical/reference" } }],
            },
            {
              label: "Contributing",
              items: [
                { autogenerate: { directory: "technical/contributing" } },
              ],
            },
          ],
        },
        {
          label: "External",
          collapsed: true,
          items: [
            {
              label: "Tuner (web — includes flasher)",
              link: "https://canshift.tmbk.ch",
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
