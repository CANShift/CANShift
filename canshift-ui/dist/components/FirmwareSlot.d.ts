export type FirmwareCompat = {
    kind: "unknown";
} | {
    kind: "compatible";
    protocol: number;
} | {
    kind: "mismatch";
    expected: number;
    got: number;
    version: string;
};
export interface FirmwareSlotProps {
    version: string | null;
    compat: FirmwareCompat;
}
export declare const FirmwareSlot: ({ version, compat }: FirmwareSlotProps) => import("react").JSX.Element;
//# sourceMappingURL=FirmwareSlot.d.ts.map