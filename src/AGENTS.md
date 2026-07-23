# AGENTS.md - src/

- `this.qs()` / `this.qsa()` come from `@substrate-system/web-component`'s
  `WebComponent` base class. `qsa` actually returns a real `NodeList`
  (`this.querySelectorAll(selector)`), but the package's `.d.ts` types it
  as returning a single element or `null` -- don't trust that typing.
  Use `Array.from(this.querySelectorAll<T>(selector))` when you need to
  iterate. Also always pass an explicit generic to `this.qs<T>(selector)`
  when you plan to call type-specific methods (e.g.
  `addEventListener('pointerdown', ...)`) on the result -- otherwise the
  inferred type is the generic `Element`, and `tsc` fails during
  `npm run build`'s `--emitDeclarationOnly` step (not during
  `esbuild`/tape-run) with a "No overload matches this call" error.
- For drag-style pointer interactions (see `crop.ts`), snapshot the
  *start* rect and pointer position on `pointerdown`, then always
  recompute the new rect from that snapshot plus the *total*
  `(current - start)` delta on each `pointermove`. Don't accumulate
  incremental per-event deltas onto the live rect -- it drifts.
- `setPointerCapture` calls should be wrapped in `try/catch`: synthetic
  `PointerEvent`s dispatched in tests don't correspond to a real active
  pointer session, and some environments throw when capture is
  requested for a pointer id with no active pointer.
