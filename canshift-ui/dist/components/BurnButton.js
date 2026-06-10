import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const BurnButton = ({ disabled = false, busy = false, title, onClick, }) => {
    const isDisabled = disabled && !busy;
    return (_jsxs("button", { type: "button", disabled: isDisabled, onClick: onClick, title: title, style: isDisabled ? burnButtonStyleDisabled : burnButtonStyleEnabled, children: [busy ? _jsx(BurnSpinner, {}) : null, busy ? "Burning…" : "Burn"] }));
};
const BurnSpinner = () => (_jsx("span", { "aria-hidden": "true", style: {
        display: "inline-block",
        width: 10,
        height: 10,
        border: "2px solid hsl(var(--primary-foreground))",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "canshift-tuner-spin 700ms linear infinite",
        marginRight: 6,
        verticalAlign: "-1px",
    } }));
const burnButtonStyleBase = {
    borderRadius: 4,
    padding: "5px 14px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
};
const burnButtonStyleDisabled = {
    ...burnButtonStyleBase,
    background: "hsl(var(--surface-2))",
    color: "hsl(var(--text-dim))",
    border: "1px solid hsl(var(--border))",
    cursor: "not-allowed",
    opacity: 0.5,
};
const burnButtonStyleEnabled = {
    ...burnButtonStyleBase,
    background: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    border: "1px solid hsl(var(--primary))",
    cursor: "pointer",
    boxShadow: "0 1px 4px hsl(var(--primary) / 0.3)",
};
//# sourceMappingURL=BurnButton.js.map