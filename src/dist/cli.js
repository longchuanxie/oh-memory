#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./commands/index");
(0, index_1.run)().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map