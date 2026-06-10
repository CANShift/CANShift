import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const SUPPORTED_BROWSERS = ["Chrome 89+", "Edge 89+", "Brave", "Opera"];
const STEPS = [
    {
        title: "Plug your dash",
        body: "USB-C cable, directly into your computer. No hub.",
    },
    {
        title: "Pick the port",
        body: "Click Connect device. Your browser asks which USB port to use.",
    },
    {
        title: "Start tuning",
        body: "Edit your dashboard live — your changes preview as you type.",
    },
];
export const WelcomeScreen = ({ supported = true, busy = false, reconnecting = false, lastError = null, onConnect, footerLinks, }) => {
    return (_jsx("div", { style: containerStyle, children: _jsxs("div", { style: contentStyle, children: [_jsxs("header", { style: heroStyle, children: [_jsx("div", { style: badgeStyle, children: "CANShift Tuner" }), _jsx("h1", { style: titleStyle, children: "Configure your dash, live." }), _jsx("p", { style: taglineStyle, children: "Edit pages, bind CAN signals, tune OBD-II polling \u2014 all in your browser, with the dash connected over USB. No install, nothing to deploy." })] }), !supported ? (_jsx(UnsupportedBrowserCard, {})) : (_jsxs(_Fragment, { children: [_jsx("ol", { style: stepsStyle, children: STEPS.map((step, idx) => (_jsxs("li", { style: stepStyle, children: [_jsx("div", { style: stepNumberStyle, children: idx + 1 }), _jsxs("div", { children: [_jsx("div", { style: stepTitleStyle, children: step.title }), _jsx("div", { style: stepBodyStyle, children: step.body })] })] }, step.title))) }), _jsx("div", { style: ctaRowStyle, children: _jsx("button", { type: "button", disabled: busy, onClick: onConnect, style: {
                                    ...connectButtonStyle,
                                    cursor: busy ? "wait" : "pointer",
                                    opacity: busy ? 0.7 : 1,
                                }, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Spinner, {}), " ", reconnecting ? "Reconnecting…" : "Connecting…"] })) : ("Connect device") }) }), lastError ? _jsx("div", { style: errorPillStyle, children: lastError }) : null] })), footerLinks ? _jsx("footer", { style: footerStyle, children: footerLinks }) : null] }) }));
};
const UnsupportedBrowserCard = () => (_jsxs("div", { style: unsupportedCardStyle, role: "alert", children: [_jsx("div", { style: {
                fontWeight: 600,
                color: "hsl(var(--text))",
                marginBottom: 6,
            }, children: "WebSerial isn't available in this browser" }), _jsx("div", { style: { fontSize: 13, marginBottom: 12 }, children: "CANShift Tuner needs the WebSerial API to talk to the dash over USB. Open this page in one of the supported browsers \u2014 or copy the URL and paste it into the new one:" }), _jsx("ul", { style: { listStyle: "none", padding: 0, margin: 0, fontSize: 13 }, children: SUPPORTED_BROWSERS.map((b) => (_jsxs("li", { style: { padding: "2px 0" }, children: ["\u00B7 ", b] }, b))) })] }));
const Spinner = () => (_jsx("span", { "aria-hidden": "true", style: {
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid hsl(var(--primary-foreground))",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "canshift-tuner-spin 700ms linear infinite",
        marginRight: 8,
        verticalAlign: "-2px",
    } }));
const containerStyle = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "hsl(var(--bg))",
    padding: "48px 32px",
    overflowY: "auto",
};
const contentStyle = {
    width: "100%",
    maxWidth: 540,
    display: "flex",
    flexDirection: "column",
    gap: 28,
};
const heroStyle = {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
};
const badgeStyle = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    background: "hsl(var(--surface))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--text-dim))",
    fontFamily: "'Orbitron', system-ui, sans-serif",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
};
const titleStyle = {
    fontSize: 30,
    fontWeight: 700,
    color: "hsl(var(--text))",
    letterSpacing: "-0.02em",
    margin: 0,
    lineHeight: 1.15,
};
const taglineStyle = {
    fontSize: 14,
    color: "hsl(var(--text-dim))",
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 440,
};
const stepsStyle = {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 14,
};
const stepStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "14px 16px",
    background: "hsl(var(--surface))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
};
const stepNumberStyle = {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: "50%",
    background: "hsl(var(--primary) / 0.15)",
    color: "hsl(var(--primary))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    marginTop: 2,
};
const stepTitleStyle = {
    fontWeight: 600,
    color: "hsl(var(--text))",
    fontSize: 14,
    marginBottom: 2,
};
const stepBodyStyle = {
    fontSize: 13,
    color: "hsl(var(--text-dim))",
    lineHeight: 1.5,
};
const ctaRowStyle = {
    display: "flex",
    justifyContent: "center",
    marginTop: 4,
};
const connectButtonStyle = {
    background: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    border: "none",
    borderRadius: 8,
    padding: "14px 28px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px hsl(var(--primary) / 0.3)",
};
const errorPillStyle = {
    background: "hsl(var(--bg-inset))",
    border: "1px solid hsl(var(--destructive))",
    color: "hsl(var(--destructive))",
    borderRadius: 4,
    padding: "10px 14px",
    fontSize: 13,
    textAlign: "center",
};
const unsupportedCardStyle = {
    background: "hsl(var(--bg-inset))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    padding: "18px 20px",
    color: "hsl(var(--text-dim))",
    textAlign: "left",
    fontSize: 13,
};
const footerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 8,
    borderTop: "1px solid hsl(var(--border))",
    marginTop: 8,
};
//# sourceMappingURL=WelcomeScreen.js.map