Read `AGENTS.md` before working. If a task touches `src/`, `example/`, or
`test/`, read that directory's `AGENTS.md` too.

# Mission

Build and maintain this production-ready image input web component. It
provides a client-side image preview, alt text, and cropping support.

This repository is a TypeScript package. The component lives in `src/`, the
Preact demo lives in `example/`, and browser tests live in `test/`.

## Session rules

- Read `specs/prd.json` at the start of each session.
- Work on the unfinished story with the lowest `priority` number.
- Complete exactly one story per session.
- Treat that story's acceptance criteria as the definition of done.
- Do not change `specs/prd.json` until the story is actually complete.
- Do not push changes. Commit completed work with a descriptive message.
- If the story cannot be completed honestly, leave `passes` as `false` and
  explain the blocker in your response.

## Repository conventions

- Keep lines under 80 columns, including comments and documentation.
- Use four spaces for indentation in TypeScript and JavaScript.
- Use `@preact/signals` for state in the demo. State-changing functions
  belong on the `State` object.
- Keep component CSS scoped to the component. Define colors as shared CSS
  variables. Do not add `border-radius` unless it is for an icon or an
  icon button.
- Preserve the existing light-DOM, custom-element, and native form-control
  behavior. Read the relevant source and tests before changing markup or
  event behavior.
- Update `README.md` when a public API, event, attribute, CSS variable, or
  user-visible behavior changes.

## Work process

1. Inspect the relevant source, tests, documentation, and git status before
   editing.
2. For a feature or bug fix, add a focused failing test first when practical.
   Docs-only, configuration-only, and scaffolding changes do not need a test.
3. Make the smallest change that satisfies the selected story.
4. Keep generated files and package exports consistent with the build scripts.
5. Run the checks that cover the files you changed.
6. Set the completed story's `passes` field to `true` only after verification.

## Testing and builds

This project uses `tapzero`, `tapout`, and `tap-spec`. Use the commands
listed below rather than assuming a different test runner or test layout.

- `npm run lint` checks TypeScript and JavaScript.
- `npm run build` builds CommonJS, ESM, declarations, and CSS. The
  declaration emit is the repository's TypeScript build check.
- `npm run build-tests` bundles the browser tests and their CSS.
- `npm run test-tapout` runs the generated browser-test bundle.
- `npm test` runs lint, the package build, test bundling, and the test suite.
- `npx stylelint src/*.css` checks component CSS when CSS changes.

Run the narrowest useful checks while working. Before marking a code story
complete, run `npm test` and any additional CSS check required by the files
changed. Do not delete, skip, weaken, or rewrite tests just to get a passing
result.

## Current task tracker

The active stories are in `specs/prd.json`. The current PRD covers a
standalone crop dialog and its package export and tests. Follow the exact
acceptance criteria there rather than adding unrelated API changes.

When a story is complete:

1. Update its `passes` field in `specs/prd.json`.
2. Review the diff and run the required checks again if the tracker change
   affects generated output or validation.
3. Commit the story, its tests, documentation, and tracker update together.
4. Stop. Do not begin the next story in the same session.

When every story in `specs/prd.json` has `passes: true`, output the exact
string `<promise>COMPLETE</promise>` and do no further work.
