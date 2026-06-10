import type { ReactNode } from "react";
export interface WelcomeScreenProps {
    supported?: boolean;
    busy?: boolean;
    reconnecting?: boolean;
    lastError?: string | null;
    onConnect?: () => void;
    footerLinks?: ReactNode;
}
export declare const WelcomeScreen: ({ supported, busy, reconnecting, lastError, onConnect, footerLinks, }: WelcomeScreenProps) => import("react").JSX.Element;
//# sourceMappingURL=WelcomeScreen.d.ts.map