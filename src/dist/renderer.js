"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
function renderTemplate(template, vars) {
    const unresolved = [];
    const content = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (vars[key] !== undefined && vars[key] !== "") {
            return vars[key];
        }
        unresolved.push(key);
        return match;
    });
    return { content, unresolved };
}
//# sourceMappingURL=renderer.js.map