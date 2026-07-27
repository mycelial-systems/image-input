# AGENTS.md - example/

## The preact and custom-element contract

`example/index.ts` is a small `preact` app (via `htm/preact`) that
renders one `<image-input>` per entry in its `EXAMPLES` array -- one
per `crop` value the component accepts -- each with its own live state
panel (`example/panel.ts`, `example/state.ts`) driven by
`@preact/signals`. Five rules govern how it renders and talks to the
component. Breaking any of them either reintroduces a real bug or
silently defeats the point of the demo, so they are recorded here
rather than left to be rediscovered.

1. **No dynamic props on `<image-input>`.** It is rendered with
   attributes that are fixed for the life of the instance (e.g.
   `accept="image/*"`, `crop="circle"`), never a prop whose value
   changes across renders. The component owns `alt` as a reflected
   attribute, written from inside by `handleChange_alt`. If preact also
   drove `alt` from vdom state, both preact and the component would be
   writing the same attribute, and the last writer would win
   nondeterministically from a reader's point of view. This is a
   correctness rule, not a style preference.

   `crop` is safe to pass as a prop because nothing inside the
   component ever writes it back. The free-form example omits the
   attribute entirely (`const cropAttr = crop ? { crop } : {}`, spread
   into the vnode) rather than passing `null` or `''`: `crop` is in
   `reflectedStringAttributes`, so preact takes the property path, and
   a falsy value would be a second way to express "no constraint" that
   `parseCropAttribute` would have to absorb.

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
   name, so there is no `onImage-input:change` to write. `Example`
   takes a `ref` to the element and adds listeners with
   `addEventListener` inside a `useEffect`, whose cleanup removes every
   listener it added. `state.ts` exports those listeners as
   `[eventName, handler]` pairs, and the effect loops over them once to
   add -- a hand-written block per event is what drifts.

   Every listener is added with the `signal` of a single
   `AbortController`, and the cleanup only aborts it. Removal cannot go
   by name here: the exported handlers take `(state, ev)`, so the loop
   attaches a fresh arrow that binds this instance's state, and that
   arrow is not a reference `removeEventListener` could be handed
   later. The `AbortController` makes teardown symmetric by
   construction instead of by matching two loops.

   The `el.on('change', ...)` block in the same effect exists only to
   show that `.on` infers its `detail` type. That inference comes from
   the handler being contextually typed, so it must stay an inline
   arrow; naming it and annotating the parameter would prove nothing.
   It is removed with an `AbortController` signal instead of by name --
   `WebComponent.on` forwards its third argument straight to
   `addEventListener`, so `{ signal }` works. Note that `noImplicitAny:
   false` means broken inference degrades silently to `any` rather than
   erroring, so a clean `tsc` run does not prove this block still
   works. Verify by reading a bogus `detail` field from a throwaway
   file *inside* `example/` or `src/` (the tsconfig's `include` does
   not cover the repo root) and checking that `tsc` errors.

4. **Stable position, no `key`.** No `<image-input>` vnode ever carries
   a `key`. If preact recreated one of those DOM nodes, that
   component's file, object URL, preview and both dialogs would be
   destroyed along with it. The examples are `.map`ped out of
   `EXAMPLES`, which is safe only because that array is a module-level
   constant of fixed length and order: keyless children are matched by
   index, so every `Example` keeps its position across renders. Making
   `EXAMPLES` dynamic -- filtered, sorted, or built per render -- would
   break that guarantee, and adding a `key` to paper over it would
   reintroduce exactly the node-recreation this rule forbids.

5. **Signals are per instance and read inside `Panel`.** `State()`
   builds a fresh set of signals per `<image-input>`; `Example` holds
   them via `useMemo(State, [])` and passes that object down without
   ever reading a `.value`. The event handlers hang off `State` as
   statics taking `(state, ev)` rather than closing over one
   instance's signals, so the state stays plain data. They were
   module-level while the page held one input -- with several, that
   would mean every panel showed whichever input fired last. A signal
   read inside `Example` or `App` would subscribe that component, so
   every component event would re-render the subtree containing the
   `<image-input>` vnode. That is harmless given rule 1, but reading
   signals as deep as possible keeps it harmless by construction rather
   than by accident. Where a signal is only text, it goes directly into
   text position (`` html`<dd>${altTextText}</dd>` ``) so
   `@preact/signals` binds a text node and does no vdom work at all.
   `Panel`'s `computed`s are built in a `useMemo` keyed on the signals
   object, so a re-render does not allocate a fresh set each pass.

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
