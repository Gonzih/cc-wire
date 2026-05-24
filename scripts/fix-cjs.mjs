/**
 * Post-process the CJS output:
 * 1. Rewrite internal require("./foo.js") → require("./foo.cjs") inside each file
 * 2. Rename all .js files to .cjs
 */
import { readdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";

const dir = new URL("../dist/cjs", import.meta.url).pathname;

const files = readdirSync(dir).filter((f) => f.endsWith(".js"));

for (const file of files) {
  const filePath = join(dir, file);
  let src = readFileSync(filePath, "utf-8");
  // Rewrite relative require paths: require("./foo.js") → require("./foo.cjs")
  src = src.replace(/require\(("\.\/[^"]+)\.js"\)/g, 'require($1.cjs")');
  writeFileSync(filePath, src, "utf-8");
  renameSync(filePath, join(dir, file.replace(/\.js$/, ".cjs")));
}

console.log(`[fix-cjs] processed ${files.length} files`);
