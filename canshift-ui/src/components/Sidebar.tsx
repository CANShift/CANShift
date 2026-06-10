import type { ComponentType, CSSProperties, ReactNode } from "react";

export type SidebarRoute =
  | "/"
  | "/dashboard"
  | "/can"
  | "/ecu"
  | "/obd2"
  | "/themes"
  | "/live"
  | "/logs"
  | "/cli"
  | "/firmware"
  | "/about";

interface NavItem {
  to: SidebarRoute;
  label: string;
  icon: string;
  alwaysOn?: boolean;
}

interface Divider {
  divider: true;
}

type Entry = NavItem | Divider;

export const SIDEBAR_ENTRIES: readonly Entry[] = [
  { to: "/", label: "Welcome", icon: "⚡", alwaysOn: true },
  { divider: true },
  { to: "/dashboard", label: "Dashboard", icon: "◉" },
  { to: "/can", label: "CAN Bus", icon: "⇄" },
  { to: "/ecu", label: "ECU Profile", icon: "⚛" },
  { to: "/obd2", label: "OBD-II", icon: "⚙" },
  { to: "/themes", label: "Themes", icon: "◐" },
  { divider: true },
  { to: "/live", label: "Live Data", icon: "▤" },
  { to: "/logs", label: "Logs", icon: "☰" },
  { to: "/cli", label: "CLI", icon: "›_" },
  { divider: true },
  { to: "/firmware", label: "Firmware", icon: "⏏" },
  { to: "/about", label: "About", icon: "ⓘ" },
];

const SIDEBAR_WIDTH = 200;

export interface SidebarLinkProps {
  to: string;
  style: CSSProperties;
  children: ReactNode;
  title?: string;
}

export interface SidebarProps {
  activeRoute: string;
  offline: boolean;
  LinkComponent?: ComponentType<SidebarLinkProps>;
}

const DefaultLink: ComponentType<SidebarLinkProps> = ({
  to,
  style,
  children,
  title,
}) => (
  <a href={to} style={style} title={title}>
    {children}
  </a>
);

export const Sidebar = ({
  activeRoute,
  offline,
  LinkComponent = DefaultLink,
}: SidebarProps) => {
  return (
    <nav
      aria-label="Primary"
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: "hsl(var(--surface))",
        borderRight: "1px solid hsl(var(--border))",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        padding: "8px 0",
      }}
    >
      {SIDEBAR_ENTRIES.map((entry, idx) => {
        if ("divider" in entry) {
          return (
            <div
              key={`divider-${String(idx)}`}
              aria-hidden="true"
              style={{
                height: 1,
                margin: "8px 12px",
                background: "hsl(var(--border))",
              }}
            />
          );
        }
        const disabled = offline && entry.alwaysOn !== true;
        const active = activeRoute === entry.to;
        return (
          <SidebarItem
            key={entry.to}
            item={entry}
            active={active}
            disabled={disabled}
            LinkComponent={LinkComponent}
          />
        );
      })}
    </nav>
  );
};

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  disabled: boolean;
  LinkComponent: ComponentType<SidebarLinkProps>;
}

const SidebarItem = ({
  item,
  active,
  disabled,
  LinkComponent,
}: SidebarItemProps) => {
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    fontSize: 13,
    textDecoration: "none",
    borderLeft: "3px solid transparent",
    transition: "background 100ms ease, color 100ms ease",
  };

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        title="Connect a device to access this section"
        style={{
          ...baseStyle,
          color: "hsl(var(--text-muted))",
          opacity: 0.4,
          cursor: "not-allowed",
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 16, textAlign: "center", fontSize: 13 }}
        >
          {item.icon}
        </span>
        <span>{item.label}</span>
      </div>
    );
  }

  const linkStyle: CSSProperties = {
    ...baseStyle,
    color: active ? "hsl(var(--text))" : "hsl(var(--text-dim))",
    background: active ? "hsl(var(--surface-2))" : "transparent",
    borderLeftColor: active ? "hsl(var(--primary))" : "transparent",
    fontWeight: active ? 600 : 400,
  };

  return (
    <LinkComponent to={item.to} style={linkStyle}>
      <span
        aria-hidden="true"
        style={{ width: 16, textAlign: "center", fontSize: 13 }}
      >
        {item.icon}
      </span>
      <span>{item.label}</span>
    </LinkComponent>
  );
};
