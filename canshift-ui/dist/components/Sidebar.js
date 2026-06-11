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
const COLLAPSED_WIDTH = 52;
const DefaultLink = ({ to, style, children, title, }) => (_jsx("a", { href: to, style: style, title: title, children: children }));
export const Sidebar = ({ activeRoute, offline, collapsed = false, onToggleCollapse, LinkComponent = DefaultLink, }) => {
    return (_jsxs("nav", { "aria-label": "Primary", style: {
            width: collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
            flexShrink: 0,
            background: "hsl(var(--surface))",
            borderRight: "1px solid hsl(var(--border))",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "8px 0",
            transition: "width 180ms ease",
        }, children: [SIDEBAR_ENTRIES.map((entry, idx) => {
                if ("divider" in entry) {
                    return (_jsx("div", { "aria-hidden": "true", style: {
                            height: 1,
                            margin: collapsed ? "8px 14px" : "8px 12px",
                            background: "hsl(var(--border))",
                        } }, `divider-${String(idx)}`));
                }
                const disabled = offline && entry.alwaysOn !== true;
                const active = activeRoute === entry.to;
                return (_jsx(SidebarItem, { item: entry, active: active, disabled: disabled, collapsed: collapsed, LinkComponent: LinkComponent }, entry.to));
            }), _jsx("div", { style: { flex: 1 } }), onToggleCollapse && (_jsx(CollapseToggle, { collapsed: collapsed, onToggle: onToggleCollapse }))] }));
};
const SidebarItem = ({ item, active, disabled, collapsed, LinkComponent, }) => {
    const baseStyle = {
        display: "flex",
        alignItems: "center",
        gap: collapsed ? 0 : 10,
        padding: collapsed ? "8px 0" : "8px 16px",
        justifyContent: collapsed ? "center" : "flex-start",
        fontSize: 13,
        textDecoration: "none",
        borderLeft: "3px solid transparent",
        transition: "background 100ms ease, color 100ms ease",
    };
    const iconNode = (_jsx("span", { "aria-hidden": "true", style: { width: 16, textAlign: "center", fontSize: 13, flexShrink: 0 }, children: item.icon }));
    if (disabled) {
        return (_jsxs("div", { "aria-disabled": "true", title: collapsed
                ? `${item.label} — connect a device first`
                : "Connect a device to access this section", style: {
                ...baseStyle,
                color: "hsl(var(--text-muted))",
                opacity: 0.4,
                cursor: "not-allowed",
            }, children: [iconNode, !collapsed && _jsx("span", { children: item.label })] }));
    }
    const linkStyle = {
        ...baseStyle,
        color: active ? "hsl(var(--text))" : "hsl(var(--text-dim))",
        background: active ? "hsl(var(--surface-2))" : "transparent",
        borderLeftColor: active ? "hsl(var(--primary))" : "transparent",
        fontWeight: active ? 600 : 400,
    };
    if (collapsed) {
        return (_jsx(LinkComponent, { to: item.to, style: linkStyle, title: item.label, children: iconNode }));
    }
    return (_jsxs(LinkComponent, { to: item.to, style: linkStyle, children: [iconNode, _jsx("span", { children: item.label })] }));
};
const CollapseToggle = ({ collapsed, onToggle }) => {
    const buttonStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        padding: "10px 0",
        margin: 0,
        background: "transparent",
        border: "none",
        borderTop: "1px solid hsl(var(--border))",
        color: "hsl(var(--text-muted))",
        fontSize: 14,
        fontFamily: "inherit",
        cursor: "pointer",
    };
    return (_jsxs("button", { type: "button", "aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar", "aria-pressed": collapsed, title: collapsed ? "Expand sidebar" : "Collapse sidebar", onClick: onToggle, style: buttonStyle, children: [_jsx("span", { "aria-hidden": "true", style: { fontSize: 16, lineHeight: 1 }, children: collapsed ? "›" : "‹" }), !collapsed && (_jsx("span", { style: { fontSize: 11, letterSpacing: "0.06em" }, children: "COLLAPSE" }))] }));
};
//# sourceMappingURL=Sidebar.js.map