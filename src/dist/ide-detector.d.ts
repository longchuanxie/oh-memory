export interface IDEConfig {
    id: string;
    name: string;
    configPath: string;
    configFormat: "json" | "markdown" | "mdc";
    hasConfig: (projectDir: string) => boolean;
    detectInstallation: () => boolean;
}
export declare const IDE_CONFIGS: IDEConfig[];
export declare function detectInstalledIDEs(): IDEConfig[];
export declare function detectProjectIDEs(projectDir: string): IDEConfig[];
export declare function getIDEById(id: string): IDEConfig | undefined;
//# sourceMappingURL=ide-detector.d.ts.map