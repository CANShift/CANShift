import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const HEADER_HEIGHT = 40;
const statusVisual = (status) => {
    switch (status) {
        case "connected":
            return { dot: "hsl(var(--success))", label: "Connected" };
        case "connecting":
            return { dot: "hsl(var(--accent))", label: "Connecting…" };
        case "reconnecting":
            return { dot: "hsl(var(--accent))", label: "Reconnecting…" };
        case "simulation":
            return { dot: "hsl(var(--accent))", label: "Simulation" };
        case "disconnected":
        default:
            return { dot: "hsl(var(--destructive))", label: "Disconnected" };
    }
};
export const Header = ({ title = "CANShift Tuner", tunerVersion, status, portLabel, activityPulse = false, firmwareSlot, burnButton, }) => {
    const visual = statusVisual(status);
    return (_jsxs("header", { style: {
            height: HEADER_HEIGHT,
            flexShrink: 0,
            background: "hsl(var(--surface))",
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 14,
        }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: "hsl(var(--text))" }, children: title }), _jsxs("div", { style: versionStyle, children: ["v", tunerVersion] }), _jsx("div", { style: { flex: 1 } }), _jsxs("div", { role: "status", "aria-live": "polite", style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "hsl(var(--text-dim))",
                }, children: [_jsx("span", { "aria-hidden": "true", style: {
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: visual.dot,
                            boxShadow: activityPulse
                                ? `0 0 12px ${visual.dot}, 0 0 4px ${visual.dot}`
                                : `0 0 6px ${visual.dot}`,
                            transform: activityPulse ? "scale(1.25)" : "scale(1)",
                            transition: "box-shadow 80ms ease-out, transform 80ms ease-out",
                        } }), _jsx("span", { style: { color: "hsl(var(--text))" }, children: visual.label }), portLabel ? (_jsx("span", { style: { fontFamily: "monospace", color: "hsl(var(--text-muted))" }, children: portLabel })) : null] }), firmwareSlot, burnButton] }));
};
const versionStyle = {
    fontSize: 11,
    color: "hsl(var(--text-dim))",
    fontFamily: "monospace",
    letterSpacing: "0.04em",
};
//# sourceMappingURL=Header.js.map