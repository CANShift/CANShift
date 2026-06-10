import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const SIDEBAR_ENTRIES = [
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
const DefaultLink = ({ to, style, children, title, }) => (_jsx("a", { href: to, style: style, title: title, children: children }));
export const Sidebar = ({ activeRoute, offline, LinkComponent = DefaultLink, }) => {
    return (_jsx("nav", { "aria-label": "Primary", style: {
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            background: "hsl(var(--surface))",
            borderRight: "1px solid hsl(var(--border))",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "8px 0",
        }, children: SIDEBAR_ENTRIES.map((entry, idx) => {
            if ("divider" in entry) {
                return (_jsx("div", { "aria-hidden": "true", style: {
                        height: 1,
                        margin: "8px 12px",
                        background: "hsl(var(--border))",
                    } }, `divider-${String(idx)}`));
            }
            const disabled = offline && entry.alwaysOn !== true;
            const active = activeRoute === entry.to;
            return (_jsx(SidebarItem, { item: entry, active: active, disabled: disabled, LinkComponent: LinkComponent }, entry.to));
        }) }));
};
const SidebarItem = ({ item, active, disabled, LinkComponent, }) => {
    const baseStyle = {
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
        return (_jsxs("div", { "aria-disabled": "true", title: "Connect a device to access this section", style: {
                ...baseStyle,
                color: "hsl(var(--text-muted))",
                opacity: 0.4,
                cursor: "not-allowed",
            }, children: [_jsx("span", { "aria-hidden": "true", style: { width: 16, textAlign: "center", fontSize: 13 }, children: item.icon }), _jsx("span", { children: item.label })] }));
    }
    const linkStyle = {
        ...baseStyle,
        color: active ? "hsl(var(--text))" : "hsl(var(--text-dim))",
        background: active ? "hsl(var(--surface-2))" : "transparent",
        borderLeftColor: active ? "hsl(var(--primary))" : "transparent",
        fontWeight: active ? 600 : 400,
    };
    return (_jsxs(LinkComponent, { to: item.to, style: linkStyle, children: [_jsx("span", { "aria-hidden": "true", style: { width: 16, textAlign: "center", fontSize: 13 }, children: item.icon }), _jsx("span", { children: item.label })] }));
};
//# sourceMappingURL=Sidebar.js.map