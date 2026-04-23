#!/usr/bin/env node

import { run } from "./commands/index";

run().catch((err: Error) => {
  console.error("Error:", err.message);
  process.exit(1);
});
