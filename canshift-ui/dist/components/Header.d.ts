import type { ReactNode } from "react";
export type HeaderStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "simulation";
export interface HeaderProps {
    title?: string;
    tunerVersion: string;
    status: HeaderStatus;
    portLabel?: string | null;
    activityPulse?: boolean;
    firmwareSlot?: ReactNode;
    burnButton?: ReactNode;
}
export declare const Header: ({ title, tunerVersion, status, portLabel, activityPulse, firmwareSlot, burnButton, }: HeaderProps) => import("react").JSX.Element;
//# sourceMappingURL=Header.d.ts.map