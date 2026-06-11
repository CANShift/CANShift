import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FlashSection } from "./FlashSection.js";
export const FirmwareScreen = ({ deviceSection, firmwareSection, flashSection, deviceStatus, firmwareStatus = "idle", flashStatus = "disabled", portPath, connected = false, simulationMode = false, }) => {
    const resolvedDeviceStatus = deviceStatus ?? (connected && !simulationMode ? "done" : "active");
    return (_jsxs("div", { style: containerStyle, children: [_jsxs("header", { style: headerStyle, children: [_jsx("h1", { style: titleStyle, children: "Firmware" }), _jsx("p", { style: subtitleStyle, children: "Write a new firmware image to the dash over WebSerial. Reuses the active tuner connection so there is no second port selection step." })] }), _jsxs("div", { style: bodyStyle, children: [deviceSection ?? (_jsx(FlashSection, { step: 1, title: "Device", status: resolvedDeviceStatus, children: connected && !simulationMode ? (_jsxs("p", { style: pStyle, children: ["Tuner is talking to the dash on", " ", _jsx("strong", { style: strongStyle, children: portPath ?? "the active port" }), ". The flasher reuses this connection \u2014 no second port selection needed."] })) : (_jsx("p", { style: pStyle, children: "No device connected. The flasher needs an active WebSerial link to the dash. Connect via the Welcome screen, then come back here." })) })), firmwareSection ?? (_jsxs(FlashSection, { step: 2, title: "Firmware", status: firmwareStatus, children: [_jsx("p", { style: pStyle, children: "Pick which firmware build to write to the dash." }), _jsxs("ul", { style: listStyle, children: [_jsxs("li", { children: [_jsx("strong", { style: strongStyle, children: "Latest stable release" }), " \u2014 fetched from the GitHub releases feed, signed, size-checked."] }), _jsxs("li", { children: [_jsx("strong", { style: strongStyle, children: "Pre-release / beta channel" }), " ", "\u2014 opt-in track for in-flight features."] }), _jsxs("li", { children: [_jsx("strong", { style: strongStyle, children: "Local .bin file" }), " \u2014 for developers building from source."] })] })] })), flashSection ?? (_jsx(FlashSection, { step: 3, title: "Flash", status: flashStatus, children: _jsx("p", { style: pStyle, children: "Erase the flash, write the new firmware, verify the checksum, then reboot into the freshly written image. The dash is unreachable for ~30 seconds during the flow." }) }))] })] }));
};
const containerStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "hsl(var(--bg))",
    overflow: "hidden",
};
const headerStyle = {
    padding: "12px 20px",
    borderBottom: "1px solid hsl(var(--border))",
    background: "hsl(var(--surface))",
};
const titleStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: "hsl(var(--text))",
    letterSpacing: "0.02em",
    margin: 0,
};
const subtitleStyle = {
    fontSize: 11,
    color: "hsl(var(--text-muted))",
    marginTop: 4,
    marginBottom: 0,
};
const bodyStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 20,
    overflowY: "auto",
};
const pStyle = { margin: 0 };
const strongStyle = { color: "hsl(var(--text))" };
const listStyle = {
    margin: 0,
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 6,
};
//# sourceMappingURL=FirmwareScreen.js.map