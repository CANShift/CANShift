import type { ReactNode } from "react";
export type FlashSectionStatus = "idle" | "active" | "done" | "disabled";
export interface FlashSectionProps {
    step: number;
    title: string;
    status: FlashSectionStatus;
    children: ReactNode;
}
export declare const FlashSection: ({ step, title, status, children, }: FlashSectionProps) => import("react").JSX.Element;
//# sourceMappingURL=FlashSection.d.ts.map