import type { ReactNode } from "react";
import { type FlashSectionStatus } from "./FlashSection.js";
export interface FirmwareScreenProps {
    deviceSection?: ReactNode;
    firmwareSection?: ReactNode;
    flashSection?: ReactNode;
    deviceStatus?: FlashSectionStatus;
    firmwareStatus?: FlashSectionStatus;
    flashStatus?: FlashSectionStatus;
    portPath?: string | null;
    connected?: boolean;
    simulationMode?: boolean;
}
export declare const FirmwareScreen: ({ deviceSection, firmwareSection, flashSection, deviceStatus, firmwareStatus, flashStatus, portPath, connected, simulationMode, }: FirmwareScreenProps) => import("react").JSX.Element;
//# sourceMappingURL=FirmwareScreen.d.ts.map