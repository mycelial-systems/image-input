# AGENTS.md - example/

- `example/index.css` is styling for the example app only (layout
  around the demo). It is not part of the shipped package --
  component-library CSS belongs in `src/index.css`/`src/_vars.css`
  instead.
- `image-input` owns its own alt-text and crop dialogs. It renders
  two `<dialog>` elements itself and opens them from the ALT badge and
  the edit button, so the example does NOT need to build modals. See
  `src/AGENTS.md` and the README for the details.
- `image-input:edit` and `image-input:alt` still fire before the
  built-in dialog opens, and both are cancelable. A consumer that
  wants its own crop or alt UI calls `preventDefault()` on the event
  and then drives the component through `setImage(blob)` and the `alt`
  property. If the example demonstrates that path, it is showing the
  opt-out, not the default.
