export interface SessionMeta {
    sessionId: string;
    date: string;
    channel: string;
    status: "in-progress" | "completed" | "archived";
    topic: string;
    goal: string;
}
export interface SessionData {
    meta: SessionMeta;
    summary: string;
    progress: {
        current: string;
        completed: string[];
        remaining: string[];
    };
    changes: {
        created: string[];
        modified: string[];
    };
    insights: string[];
    keyDecisions: string[];
    nextSteps: string[];
    detailedLog: string;
}
export declare function ensureContextDirs(projectDir: string): void;
export declare function generateSessionId(topic: string): string;
export declare function getBranch(projectDir: string): string;
export declare function sessionFilePath(projectDir: string, sessionId: string, status: string): string;
export declare function createSession(projectDir: string, topic: string, goal: string): SessionData;
export declare function renderSessionFile(session: SessionData): string;
export declare function parseSessionFile(content: string): SessionData;
export declare function listWorkingSessions(projectDir: string): SessionMeta[];
export declare function listArchivedSessions(projectDir: string): SessionMeta[];
export declare function endSession(projectDir: string, sessionId: string): boolean;
export declare function archiveSession(projectDir: string, sessionId: string): boolean;
export declare function searchSessions(projectDir: string, query: string): SessionMeta[];
//# sourceMappingURL=session-manager.d.ts.map