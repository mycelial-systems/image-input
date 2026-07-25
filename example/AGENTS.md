# AGENTS.md - example/

## The preact and custom-element contract

`example/index.ts` is a small `preact` app (via `htm/preact`) that
renders `<image-input>` and a live state panel (`example/panel.ts`,
`example/state.ts`) driven by `@preact/signals`. Five rules govern how
it renders and talks to the component. Breaking any of them either
reintroduces a real bug or silently defeats the point of the demo, so
they are recorded here rather than left to be rediscovered.

1. **No dynamic props on `<image-input>`.** It is rendered with static
   attributes only (e.g. `accept="image/*"`), never a prop whose value
   changes across renders. The component owns `alt` as a reflected
   attribute, written from inside by `handleChange_alt`. If preact also
   drove `alt` from vdom state, both preact and the component would be
   writing the same attribute, and the last writer would win
   nondeterministically from a reader's point of view. This is a
   correctness rule, not a style preference.

2. **Import the component before calling `render()`.** `import
   '../src/index.js'` runs `ImageInput.define()` at module scope, and
   that import must stay above the `render()` call so preact only ever
   sees an upgraded element. Preact 10 sets a *property* when `name in
   domElement` and falls back to setting an *attribute* otherwise; an
   element that has not upgraded yet has no reflected property
   accessors on its prototype, so the same code would silently take the
   attribute path instead. Rule 1 makes this moot today, but the
   ordering itself is still a correctness dependency, not incidental.

3. **Listeners are attached via `ref` and `useEffect`, not `on*`
   props.** The component's events are namespaced with a colon
   (`image-input:change`, `image-input:alt-change`, and so on). Preact
   lowercases event prop names and a colon cannot survive as a prop
   name, so there is no `onImage-input:change` to write. `App` takes a
   `ref` to the element and adds listeners with `addEventListener`
   inside a `useEffect`, whose cleanup removes every listener it added.

4. **Stable position, no `key`.** The `<image-input>` vnode keeps a
   fixed position in the tree and never carries a `key`. If preact ever
   recreated that DOM node, the component's file, object URL, preview
   and both dialogs would be destroyed along with it.

5. **Signals are read inside `Panel`, never inside `App`.** A signal
   read inside `App` would subscribe `App`, so every component event
   would re-render the subtree containing the `<image-input>` vnode.
   That is harmless given rule 1, but reading signals as deep as
   possible keeps it harmless by construction rather than by accident.
   Where a signal is only text, it goes directly into text position
   (`` html`<span>${altText}</span>` ``) so `@preact/signals` binds a
   text node and does no vdom work at all.

Full rationale and the state/event wiring lives in
`specs/tasks/example-preact.md`.

## The component owns its dialogs

`image-input` renders and opens its own alt-text and crop dialogs. The
example does not build modals, and it should not: that was the old
design. `image-input:edit` and `image-input:alt` still fire and are
still cancelable, so a consumer with its own UI calls
`preventDefault()` and drives the component through `setImage(blob)`
and the `alt` property.

Do not restate the component's API here. `src/AGENTS.md` and the README
are the source of truth for how it behaves.

## CSS

`example/index.css` styles the demo page only. It is not part of the
shipped package. Component-library CSS belongs in `src/index.css` and
`src/_vars.css` instead.

Two things about it that are deliberate but easy to misread:

- It uses bare `button` and `input` element selectors. Those now also
  match the component's built-in dialog buttons and its visually
  hidden file input. That is acceptable on a demo page, where the
  author controls the whole document. Never copy that pattern into
  `src/` -- library CSS must stay scoped under the `image-input`
  element so it cannot reach a consumer's markup.
- It sets `.box` width and `min-height`. The component does not size
  itself, by design, so any page using it has to. The README documents
  this.
