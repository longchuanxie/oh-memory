import { CheckpointData } from "./checkpoint";
export interface RecoveryStatus {
    hasPCP: boolean;
    hasCheckpoint: boolean;
    isStale: boolean;
    staleHours: number;
    checkpoint: CheckpointData | null;
    gitStatus: {
        branch: string;
        isClean: boolean;
        modifiedFiles: string[];
        untrackedFiles: string[];
        lastCommit: string;
    };
    recommendation: string;
}
export declare function checkRecovery(projectDir: string): RecoveryStatus;
export declare function recoveryCommand(flags: Record<string, string | boolean>, _positional: string[]): Promise<void>;
//# sourceMappingURL=recovery.d.ts.map