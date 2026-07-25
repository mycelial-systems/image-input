# Design: rewrite the example on preact, signals and htm

Date: 2026-07-25
Branch: `rewrite`
Repo: `/Users/nick/code/image-input`

## Problem

`example/index.ts` is 15 lines of imperative DOM: it appends a markup
string to `document.body`, then wires one event listener by id. That
was appropriate when the example also had to build two modal dialogs,
but the component owns those now, so almost nothing is left.

`preact`, `@preact/signals` and `htm` have been devDependencies since
before this branch and are imported by nothing. The example should use
them, both because that is the house pattern for frontend state and
because a demo page written the way a real preact consumer would write
it is more useful than one written in raw DOM calls.

## Scope

Only `example/`. No change to `src/`, to the shipped package, to the
build scripts, or to `package.json`. All three libraries are already
installed at compatible versions:

- `preact@^10.29.7`
- `@preact/signals@^2.10.0`, which peers `preact >= 10.25.0`
- `htm@^3.1.1`, whose `htm/preact` subpath ships its own types

## What the example demonstrates

One `<image-input>`, plus a panel showing live state: the current alt
text, the selected file's name and size, the most recent event the
component emitted, and the reason from any error event.

That covers every event in the component's public API, including
`image-input:edit` and `image-input:alt`, which still fire even though
the component now opens its own dialogs in response. Showing those two
in the panel is the point: it makes visible that the events a consumer
would hook for the `preventDefault()` opt-out are still there.

## Files

`example/index.html` gains a `<div id="app"></div>`. This is only legal
because the old `example/AGENTS.md` rule -- keep `<body>` to the module
`<script>` tag, because anything static gets duplicated -- has been
removed along with the imperative rendering that motivated it.

Three modules, each with one responsibility:

- `example/index.ts` -- imports the component and the CSS, defines the
  `App` component, attaches the event listeners, and calls `render()`
- `example/state.ts` -- the signals and the handler functions that
  write them
- `example/panel.ts` -- the display component

## The preact and custom-element contract

This is the part with real correctness risk. Five rules, all binding.

### 1. No dynamic props on `<image-input>`

The element is rendered with static attributes only. The component
already owns `alt` as a reflected attribute, updated from inside by
`handleChange_alt`. If preact also drove `alt` from vdom state, preact
and the component would both be writing the same attribute and the
last writer would win, nondeterministically from the reader's point of
view. Static props mean preact creates the element and then never
writes to it again.

### 2. Import the component before rendering

`import '../src/index.js'` runs `ImageInput.define()` at module scope.
That import must stay above the `render()` call so preact only ever
encounters an upgraded element.

The reason is specific: preact 10 sets a *property* when
`name in domElement` and falls back to setting an *attribute*
otherwise. An element that has not upgraded yet has no reflected
property accessors on its prototype, so the same code silently takes
the attribute path instead. Rule 1 makes this moot today, but the
ordering must not be treated as incidental.

### 3. Listeners via `ref` and `useEffect`, not `on*` props

The component's events are `image-input:change`,
`image-input:alt-change` and so on. Preact lowercases event prop names
and a colon cannot survive as a prop name, so there is no
`onImage-input:change` to write. `App` takes a `ref` to the element and
a `useEffect` adds the listeners, returning a cleanup that removes
them.

### 4. Stable position, no `key`

The `<image-input>` vnode keeps a stable position in the tree and
carries no `key`. If preact ever recreated that DOM node, the
component's file, object URL, preview and both dialogs would be
destroyed with it.

### 5. Signals are read in `Panel`, never in `App`

A signal read inside `App` would subscribe `App`, so every event would
re-render the tree containing the `<image-input>` vnode. That is
harmless given rule 1, but reading signals as deep as possible keeps it
harmless by construction rather than by accident.

Where a signal is only text, it goes directly into text position --
`` html`<span>${altText}</span>` `` -- so `@preact/signals` binds a
text node and does no vdom work at all.

## State

Five signals in `example/state.ts`:

| Signal | Written by |
| --- | --- |
| `altText` | `image-input:alt-change` |
| `fileName` | `image-input:change`, cleared by `:remove` |
| `fileSize` | `image-input:change`, cleared by `:remove` |
| `lastEvent` | every event, including `:edit` and `:alt` |
| `errorReason` | `image-input:error`, cleared by `:change` |

The `remove` handler deliberately does NOT clear `altText`. The
component's `#clear()` ends with `this.alt = null` (`src/index.ts:318`),
which runs `handleChange_alt` and emits `image-input:alt-change` with
an empty string, so the alt-change handler already clears it. Clearing
it a second time in the remove handler would be redundant and would
hide that behaviour from anyone reading the example.

Any handler that sets more than one signal wraps them in `batch`, per
the repo's frontend state rule. The `change` handler sets four, so it
must.

## Verification

No new tests. `test/` covers the component, the example is not in that
harness, and the project rule forbids writing tests for docs and demo
pages. The obligations are:

- `npm test` still passes end to end
- `npm run build-example` succeeds
- `npx eslint example/*.ts` passes with no config change

`example/AGENTS.md` gains the five contract rules above, so the next
agent to touch the example does not undo them.

## Out of scope

- Any change to `src/`, the build, or `package.json`
- Demonstrating the `preventDefault()` opt-out with a custom dialog
- Putting `image-input` inside a `<form>` to demo form participation
- JSX or any build-step template transform. `htm` tagged templates
  only, which is why no compiler configuration changes.
