import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ClientBuildValidationResult = {
  ok: boolean;
  checkedFiles: number;
  issues: string[];
};

const forbiddenMarkers = [
  "__GAME_TEST__",
  "GEMINI_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "firebase-adminsdk-",
];

const listFiles = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
};

export const validateClientBuild = (
  distDir = path.resolve(process.cwd(), "dist"),
): ClientBuildValidationResult => {
  const files = listFiles(distDir).filter((file) =>
    /\.(?:html|js|css|json|map)$/u.test(file),
  );
  const issues: string[] = [];
  if (files.length === 0) {
    issues.push(
      `No production client files found in ${distDir}. Run npm run build first.`,
    );
  }

  for (const file of files) {
    const body = fs.readFileSync(file, "utf8");
    for (const marker of forbiddenMarkers) {
      if (body.includes(marker)) {
        issues.push(`Forbidden client marker '${marker}' found in ${file}.`);
      }
    }
  }
  return { ok: issues.length === 0, checkedFiles: files.length, issues };
};

const invokedDirectly = process.argv[1]
  ? path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url))
  : false;

if (invokedDirectly) {
  const result = validateClientBuild();
  if (!result.ok) {
    console.error(result.issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `✅ Client build security validation passed (files=${result.checkedFiles}, forbiddenMarkers=0).`,
    );
  }
}
