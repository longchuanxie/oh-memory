export interface TemplateVars {
    projectName: string;
    projectPurpose: string;
    techStack: string;
    currentPhase: string;
    branch: string;
    directoryStructure: string;
    date: string;
    [key: string]: string;
}
export declare function renderTemplate(template: string, vars: TemplateVars): {
    content: string;
    unresolved: string[];
};
//# sourceMappingURL=renderer.d.ts.map