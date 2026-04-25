import { SessionMeta } from "./session-manager";
export interface IndexEntry {
    date: string;
    topic: string;
    goal: string;
    status: string;
    file: string;
    keyDecisions?: string;
    channel?: string;
}
export declare function readIndex(projectDir: string): {
    active: IndexEntry[];
    archived: IndexEntry[];
    byTopic: Record<string, IndexEntry[]>;
    byChannel: Record<string, IndexEntry[]>;
};
export declare function addActiveSession(projectDir: string, entry: IndexEntry): void;
export declare function moveSessionToArchived(projectDir: string, sessionId: string): void;
export declare function removeSessionFromIndex(projectDir: string, sessionId: string): void;
export declare function writeIndex(projectDir: string, index: {
    active: IndexEntry[];
    archived: IndexEntry[];
    byTopic?: Record<string, IndexEntry[]>;
    byChannel?: Record<string, IndexEntry[]>;
}): void;
export declare function sessionMetaToIndexEntry(meta: SessionMeta): IndexEntry;
//# sourceMappingURL=index-manager.d.ts.map