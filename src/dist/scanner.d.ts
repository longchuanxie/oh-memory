export interface ProjectInfo {
    projectName: string;
    projectPurpose: string;
    techStack: string;
    currentPhase: string;
    branch: string;
    directoryStructure: string;
    date: string;
    hasAgentsMd: boolean;
    hasGitignore: boolean;
    [key: string]: string | boolean;
}
export declare function scanProject(projectDir: string): ProjectInfo;
//# sourceMappingURL=scanner.d.ts.map