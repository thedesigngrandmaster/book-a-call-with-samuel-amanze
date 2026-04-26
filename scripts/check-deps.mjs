// Fails the build early if required runtime packages are missing.
// Run via the "prebuild" npm script.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const REQUIRED = [
  { pkg: "@heroicons/react", install: "bun add @heroicons/react" },
  { pkg: "@supabase/supabase-js", install: "bun add @supabase/supabase-js" },
  { pkg: "react-router-dom", install: "bun add react-router-dom" },
  { pkg: "date-fns", install: "bun add date-fns" },
  { pkg: "zod", install: "bun add zod" },
  { pkg: "sonner", install: "bun add sonner" },
];

const missing = REQUIRED.filter(
  ({ pkg }) => !existsSync(resolve(root, "node_modules", pkg)),
);

if (missing.length) {
  console.error("\n\x1b[31m✗ Build prerequisites missing:\x1b[0m");
  for (const { pkg, install } of missing) {
    console.error(`  • ${pkg}   →   run: \x1b[33m${install}\x1b[0m`);
  }
  console.error("");
  process.exit(1);
}
