import type { CSSProperties, ReactNode } from "react";
import {
  Header,
  Sidebar,
  BurnButton,
  FirmwareSlot,
  WelcomeScreen,
  FirmwareScreen,
} from "@tmbk/canshift-ui";
import type {
  FirmwareCompat,
  HeaderStatus,
  SidebarLinkProps,
} from "@tmbk/canshift-ui";

type RouteKey = "welcome" | "firmware";

export interface TunerPreviewProps {
  route: RouteKey;
  status?: HeaderStatus;
  portLabel?: string | null;
  firmwareVersion?: string | null;
  tunerVersion?: string;
}

const routeToPath: Record<RouteKey, string> = {
  welcome: "/",
  firmware: "/firmware",
};

const StaticLink = ({ to, style, children }: SidebarLinkProps) => (
  <span style={style} data-tuner-mock-to={to}>
    {children}
  </span>
);

const SCREEN_CONTENT: Record<RouteKey, ReactNode> = {
  welcome: <WelcomeScreen supported />,
  firmware: <FirmwareScreen connected portPath="/dev/cu.usbserial-303a" />,
};

export const TunerPreview = ({
  route,
  status = "connected",
  portLabel = "303a:1001",
  firmwareVersion = "0.42.0",
  tunerVersion = "0.42.0",
}: TunerPreviewProps) => {
  const offline = status !== "connected";
  const compat: FirmwareCompat =
    firmwareVersion === null
      ? { kind: "unknown" }
      : { kind: "compatible", protocol: 1 };

  return (
    <figure style={frameStyle} className="not-content">
      <div style={innerStyle}>
        <Header
          tunerVersion={tunerVersion}
          status={status}
          portLabel={status === "connected" ? portLabel : null}
          firmwareSlot={<FirmwareSlot version={firmwareVersion} compat={compat} />}
          burnButton={<BurnButton disabled />}
        />
        <div style={bodyStyle}>
          <Sidebar
            activeRoute={routeToPath[route]}
            offline={offline}
            LinkComponent={StaticLink}
          />
          <div style={mainStyle}>{SCREEN_CONTENT[route]}</div>
        </div>
      </div>
    </figure>
  );
};

const frameStyle: CSSProperties = {
  margin: "1.5rem 0",
};

const innerStyle: CSSProperties = {
  background: "hsl(var(--bg))",
  color: "hsl(var(--text))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  overflow: "hidden",
  fontFamily:
    "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontSize: 14,
  lineHeight: 1.5,
  boxShadow:
    "0 8px 24px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.02) inset",
};

const bodyStyle: CSSProperties = {
  display: "flex",
  minHeight: 360,
};

const mainStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: 0,
};
