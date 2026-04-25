export interface CheckpointData {
    sessionId: string;
    startTime: string;
    lastUpdate: string;
    status: string;
    currentPhase: string;
    goal: string;
    progress: {
        completed: string[];
        inProgress: string;
        remaining: string[];
    };
    git: {
        branch: string;
        lastCommit: string;
        lastCommitTime: string;
        isClean: boolean;
    };
    files: {
        created: string[];
        modified: string[];
        needsReview: string[];
    };
    channel: string;
}
export declare function readCheckpoint(projectDir: string): CheckpointData | null;
export declare function updateCheckpoint(projectDir: string, updates: Partial<{
    sessionId: string;
    status: string;
    currentPhase: string;
    goal: string;
    completed: string[];
    inProgress: string;
    remaining: string[];
    created: string[];
    modified: string[];
    channel: string;
}>): CheckpointData;
export declare function writeCheckpoint(projectDir: string, checkpoint: CheckpointData): void;
export declare function checkpointCommand(flags: Record<string, string | boolean>, positional: string[]): Promise<void>;
//# sourceMappingURL=checkpoint.d.ts.map