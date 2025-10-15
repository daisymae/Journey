Project development guidelines (Journey)

Audience: Advanced developers working on this TypeScript-only repository.

1) Build and configuration
- Toolchain: TypeScript 5.x (local devDependency), CommonJS modules, target ES2016, outDir=dist. tsconfig.json is source of truth for compilation options.
- Source layout: All sources live under src and are included by tsconfig.json. The entry point is src/index.ts and the compiled main is dist/index.js (as referenced by package.json "main").
- Build:
  - npm run build  # runs tsc using tsconfig.json and writes JS into dist
  - Run the compiled program: node .\\dist\\index.js
- Type checking: tsc performs strict type checking ("strict": true). Fix type errors prior to committing; do not weaken compiler options unless strictly justified.
- Module format: CommonJS ("module": "commonjs"). If you change to ESM, update package.json ("type": "module") and imports accordingly.
- Paths/aliases: None configured. Keep relative imports simple or propose a tsconfig paths change with clear justification.

2) Testing: configuring, running, and adding tests
This repo has no test framework dependency by design. For quick tests without adding dependencies, you can write self-contained TypeScript test files and execute them via the regular build. This avoids adding @types/node or a test runner.

A. Quick, dependency-free test pattern
- Create a file in src with a .test.ts suffix, implement minimal assertions inline so compilation doesn’t require Node typings.
  Example pattern:
  
  // src/example.test.ts
  function assertEqual(actual: unknown, expected: unknown, message?: string) {
    if (actual !== expected) throw new Error(message || `expected ${expected}, got ${actual}`)
  }
  function add(a: number, b: number) { return a + b }
  assertEqual(add(1, 2), 3)
  console.log('[example.test] All assertions passed')

- Build and run the test:
  - npm run build
  - node .\\dist\\example.test.js

- Expected output: [example.test] All assertions passed and exit code 0. If an assertion fails, Node will exit with a non-zero status and print the error.

B. How this was verified
- We created src\\example.test.ts locally with the above inline assertion approach, ran npm run build and node .\\dist\\example.test.js, and confirmed it passed. We then deleted the temporary files to keep the repo clean (see Cleanup below).

C. Adding more tests
- Keep tests colocated in src next to the code under test or under src/tests; use the .test.ts suffix to distinguish them.
- Use the inline assert helper to avoid adding dependencies. If you need richer assertions or async test orchestration, consider adding a test framework (recommended: Vitest or Jest) in a separate PR with consensus:
  - Vitest: fast, TS-friendly; would require devDeps (vitest, ts-node or tsx if running TS directly) and npm scripts (test, test:watch).
  - Jest: widely used; requires jest, ts-jest, @types/jest, and a basic config.
- If Node typings are needed, add @types/node as a devDependency and enable "types": ["node"] in tsconfig.json or add a per-file // eslint-disable comment; but prefer avoiding extra deps unless there’s clear value.

D. Executing multiple tests
- With the current minimal setup, explicitly run each compiled test with Node:
  - npm run build
  - node .\\dist\\path\\to\\your.test.js
- For convenience, you can add a temporary PowerShell one-liner locally (do not commit) to run all compiled .test.js files, e.g.:
  - Get-ChildItem -Recurse -Filter *.test.js -Path .\\dist | ForEach-Object { node $_.FullName }

3) Additional development & debugging information
- Code style and linting: No linter configured. Follow idiomatic, strict TypeScript. Prefer explicit types at public boundaries. Keep functions small and pure where possible. If introducing ESLint/Prettier, do so in a dedicated PR with shared configs.
- Strictness: "strict": true is enforced. Avoid using any; if necessary at boundaries, narrow types ASAP.
- Runtime: Node 18+ recommended (for up-to-date JS features corresponding to ES2016 target and modern tooling). If you change target or runtime, ensure compatibility.
- Debugging compiled output: Use source maps if needed by enabling "sourceMap": true in tsconfig.json (not enabled by default). Then run Node with --enable-source-maps or configure your IDE for sourcemaps.
- Build artifacts: Output is under dist. Do not edit files in dist; they are generated.
- Project hygiene: Keep src clean of experimental files. For local experiments, prefer creating throwaway branches or ensure you delete temporary test files before committing.

4) Reproducible example (performed and verified)
- Temporary file created: src\\example.test.ts
- Commands run:
  - npm run build
  - node .\\dist\\example.test.js
- Observed result: "[example.test] All assertions passed" and exit code 0.
- Cleanup performed: deleted src\\example.test.ts and dist\\example.test.js to keep the repo pristine.

5) Cleanup procedure for temporary tests
- After validating a test locally, remove the temporary .test.ts file from src and its compiled artifact from dist. This repository intentionally avoids committing test scaffolding until a formal testing strategy is adopted.

If you adopt a real test framework later, update this document with the chosen tools, scripts (e.g., npm run test), and any configuration files you add (jest.config.ts, vitest.config.ts, etc.).
