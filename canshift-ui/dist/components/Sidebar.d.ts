import type { ComponentType, CSSProperties, ReactNode } from "react";
export type SidebarRoute = "/" | "/dashboard" | "/can" | "/ecu" | "/obd2" | "/themes" | "/live" | "/logs" | "/cli" | "/firmware" | "/about";
interface NavItem {
    to: SidebarRoute;
    label: string;
    icon: string;
    alwaysOn?: boolean;
}
interface Divider {
    divider: true;
}
type Entry = NavItem | Divider;
export declare const SIDEBAR_ENTRIES: readonly Entry[];
export interface SidebarLinkProps {
    to: string;
    style: CSSProperties;
    children: ReactNode;
    title?: string;
}
export interface SidebarProps {
    activeRoute: string;
    offline: boolean;
    LinkComponent?: ComponentType<SidebarLinkProps>;
}
export declare const Sidebar: ({ activeRoute, offline, LinkComponent, }: SidebarProps) => import("react").JSX.Element;
export {};
//# sourceMappingURL=Sidebar.d.ts.map