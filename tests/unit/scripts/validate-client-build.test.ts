import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateClientBuild } from "../../../scripts/validate-client-build.js";

const temporaryDirectories: string[] = [];

const makeDist = (): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gg2026-dist-"));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe("production client bundle guard", () => {
  it("accepts a client-only production bundle", () => {
    const dist = makeDist();
    fs.writeFileSync(
      path.join(dist, "index.html"),
      '<div id="root"></div><script src="/assets/app.js"></script>',
    );
    fs.mkdirSync(path.join(dist, "assets"));
    fs.writeFileSync(path.join(dist, "assets", "app.js"), "console.log('ok')");

    expect(validateClientBuild(dist)).toEqual({
      ok: true,
      checkedFiles: 2,
      issues: [],
    });
  });

  it("rejects test bridges and provider credentials in browser artifacts", () => {
    const dist = makeDist();
    fs.writeFileSync(
      path.join(dist, "app.js"),
      "window.__GAME_TEST__; const key = 'GEMINI_API_KEY';",
    );

    const result = validateClientBuild(dist);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.stringContaining("__GAME_TEST__"),
      expect.stringContaining("GEMINI_API_KEY"),
    ]);
  });

  it("fails closed when build output is absent", () => {
    const missing = path.join(makeDist(), "missing");
    expect(validateClientBuild(missing)).toMatchObject({
      ok: false,
      checkedFiles: 0,
      issues: [expect.stringContaining("Run npm run build first")],
    });
  });
});
