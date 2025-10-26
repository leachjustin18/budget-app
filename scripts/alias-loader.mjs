import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const projectRoot = pathToFileURL(path.resolve(".") + path.sep);

export function resolve(specifier, context, defaultResolve) {
  if (specifier === "@budget") {
    return {
      url: projectRoot.href,
      shortCircuit: true,
    };
  }

  if (specifier === "server-only") {
    return defaultResolve(new URL("./scripts/server-only-stub.js", projectRoot).href, context, defaultResolve);
  }

  if (specifier.startsWith("@budget/")) {
    const relativeSpecifier = specifier.slice("@budget/".length);
    const trimmedSpecifier = relativeSpecifier.startsWith("lib/")
      ? relativeSpecifier.slice(4)
      : relativeSpecifier;
    const baseUrl = new URL(relativeSpecifier, projectRoot);
    const compiledCandidates = [
      `.tmp/tests/${relativeSpecifier}.js`,
      `.tmp/tests/${relativeSpecifier}.mjs`,
      `.tmp/tests/${relativeSpecifier}/index.js`,
      `.tmp/tests/${relativeSpecifier}/index.mjs`,
      `.tmp/tests/${trimmedSpecifier}.js`,
      `.tmp/tests/${trimmedSpecifier}.mjs`,
      `.tmp/tests/${trimmedSpecifier}/index.js`,
      `.tmp/tests/${trimmedSpecifier}/index.mjs`,
    ];
    for (const candidate of compiledCandidates) {
      const url = new URL(candidate, projectRoot);
      const fsPath = fileURLToPath(url);
      if (fs.existsSync(fsPath)) {
        return {
          url: url.href,
          shortCircuit: true,
        };
      }
    }

    const fallbackCandidates = [
      baseUrl.href,
      new URL(`${relativeSpecifier}.ts`, projectRoot).href,
      new URL(`${relativeSpecifier}.tsx`, projectRoot).href,
      new URL(`${relativeSpecifier}.js`, projectRoot).href,
      new URL(`${relativeSpecifier}.mjs`, projectRoot).href,
      new URL(`${relativeSpecifier}/index.ts`, projectRoot).href,
      new URL(`${relativeSpecifier}/index.tsx`, projectRoot).href,
      new URL(`${relativeSpecifier}/index.js`, projectRoot).href,
      new URL(`${relativeSpecifier}/index.mjs`, projectRoot).href,
    ];

    for (const candidate of fallbackCandidates) {
      try {
        return defaultResolve(candidate, context, defaultResolve);
      } catch {
        // ignore and try next candidate
      }
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
