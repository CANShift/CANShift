import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export const FirmwareSlot = ({ version, compat }) => {
    if (compat.kind === "mismatch") {
        return (_jsxs("div", { style: mismatchStyle, title: `Tuner expects firmware major ${String(compat.expected)}.x — device reports ${compat.version}. Burn disabled until the firmware is updated.`, children: ["fw v", compat.version, " \u00B7 mismatch"] }));
    }
    if (version) {
        return (_jsxs("div", { style: baseStyle, title: `Firmware v${version}`, children: ["fw v", version] }));
    }
    return (_jsx("div", { style: baseStyle, title: "Firmware version \u2014 waiting for handshake", children: "fw \u2014" }));
};
const baseStyle = {
    fontSize: 11,
    color: "hsl(var(--text-muted))",
    fontFamily: "monospace",
    letterSpacing: "0.04em",
};
const mismatchStyle = {
    fontSize: 11,
    color: "hsl(var(--destructive))",
    fontFamily: "monospace",
    letterSpacing: "0.04em",
    padding: "2px 8px",
    border: "1px solid hsl(var(--destructive))",
    borderRadius: 3,
    cursor: "help",
};
//# sourceMappingURL=FirmwareSlot.js.map