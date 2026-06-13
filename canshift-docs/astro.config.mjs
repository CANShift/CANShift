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
      social: {
        github: "https://github.com/tburkhalterr/CANShift",
      },
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
              autogenerate: { directory: "user-guide/getting-started" },
            },
            {
              label: "Install",
              autogenerate: { directory: "user-guide/install" },
            },
            {
              label: "Configure",
              autogenerate: { directory: "user-guide/configure" },
            },
            {
              label: "Use",
              autogenerate: { directory: "user-guide/usage" },
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
              autogenerate: { directory: "technical/architecture" },
            },
            {
              label: "Reference",
              autogenerate: { directory: "technical/reference" },
            },
            {
              label: "Contributing",
              autogenerate: { directory: "technical/contributing" },
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
