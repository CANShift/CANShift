import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const FlashSection = ({ step, title, status, children, }) => (_jsxs("section", { style: sectionStyle(status), children: [_jsxs("header", { style: headerStyle, children: [_jsx("span", { style: badgeStyle(status), children: step }), _jsx("h2", { style: titleStyle, children: title })] }), _jsx("div", { style: bodyStyle, children: children })] }));
const sectionStyle = (status) => ({
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    borderRadius: 8,
    border: `1px solid hsl(var(--border))`,
    background: "hsl(var(--surface))",
    opacity: status === "disabled" ? 0.55 : 1,
});
const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
};
const badgeStyle = (status) => {
    const palette = status === "done"
        ? { bg: "hsl(var(--success) / 0.18)", fg: "hsl(var(--success))" }
        : status === "active"
            ? { bg: "hsl(var(--primary) / 0.18)", fg: "hsl(var(--primary))" }
            : { bg: "hsl(var(--bg-inset))", fg: "hsl(var(--text-muted))" };
    return {
        width: 22,
        height: 22,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        background: palette.bg,
        color: palette.fg,
        flexShrink: 0,
    };
};
const titleStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: "hsl(var(--text))",
    letterSpacing: "0.02em",
    margin: 0,
};
const bodyStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 12,
    color: "hsl(var(--text-dim))",
    lineHeight: 1.5,
};
//# sourceMappingURL=FlashSection.js.map