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

export function renderTemplate(template: string, vars: TemplateVars): { content: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (vars[key] !== undefined && vars[key] !== "") {
      return vars[key];
    }
    unresolved.push(key);
    return match;
  });
  return { content, unresolved };
}
