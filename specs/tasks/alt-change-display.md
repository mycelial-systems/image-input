# Task: Alt text display driven by component events

Branch: `ralphing`
Repo: `/Users/nick/code/image-input`

## Context

The `<image-input>` web component (`src/index.ts`) manages an image file
and an `alt` string (a reflected attribute/property). The example page
(`example/index.ts`) already opens an alt-text editor dialog when the
component emits `image-input:alt` (fired when the user clicks the ALT
badge). Saving the dialog sets `input.alt = altTextarea.value`.

The gap: the component never announces when its alt value actually
changes. Setting `input.alt` runs `handleChange_alt` internally (updates
the badge and the `img` alt attribute) but emits nothing. The example
page should show the current alt text in a div below the image, driven
purely by events emitted by the component. That requires a new event.

The component extends `@substrate-system/web-component`, which provides
`this.emit(name, opts)` -- it prefixes event names with the tag, so
`this.emit('alt-change', ...)` produces an event named
`image-input:alt-change`. See existing calls to `this.emit` in
`src/index.ts` for the pattern.

## Tasks

### 1. Emit `image-input:alt-change` from the component

File: `src/index.ts`

Emit the event whenever the alt value changes, through any path:

- the `alt` property setter
- the `alt` attribute
- alt being cleared to null when the image is removed (`#clear()` sets
  `this.alt = null`)

All three paths already funnel through `handleChange_alt(_old, newValue)`,
so emit from there:

```ts
this.emit('alt-change', { detail: { alt: newValue ?? '' } })
```

Payload shape: `{ alt: string }`, normalized with `?? ''` to match the
existing convention in the `change` and `alt` events.

Edge case, decided: `handleChange_alt` also runs on initial render when
`alt` is set as an attribute in markup. Let the event fire on that first
pass -- it syncs any listener on load and is harmless. Do not
special-case it.

### 2. Show the alt text on the example page

Files: `example/index.ts` (and `example/index.css` only if styling is
needed for the new div)

- Add a div directly below the `<image-input>` element in the markup
  string, e.g.:

  ```html
  <div id="alt-display">Alt: <span id="alt-value"></span></div>
  ```

- The div is labeled ("Alt:") and stays visible in the layout when the
  value is empty. Do not hide it.
- Update its content ONLY from `image-input:alt-change` events:

  ```ts
  input.addEventListener('image-input:alt-change', ((e:CustomEvent) => {
      altValue.textContent = e.detail.alt
  }) as EventListener)
  ```

- Because `#clear()` sets alt to null and that path emits the event with
  `alt: ''`, the display empties itself automatically when the image is
  removed. No extra wiring for that.
- Do NOT update the div directly from the alt dialog's save handler.
  The event is the single source of truth.

### 3. Test the new event

Add a test alongside the existing component tests. Cover:

- Setting the `alt` property fires `image-input:alt-change` with detail
  `{ alt: '<the value>' }`.
- Clearing alt (e.g. removing the image, or setting alt to null) fires
  the event with `{ alt: '' }`.

Test the event and its payload shape only. Do NOT assert on HTML text
content (house rule: no brittle tests). Follow the style of the existing
tests in the repo (see the `test/` directory and the recent commit
"TEST: US-009" for the payload-shape test pattern).

## Constraints (from house style)

- TypeScript, no space between colon and type annotation
  (`(e:CustomEvent)`), max 80 columns.
- Do not change CSS unrelated to this task. If the new div needs style,
  use variables from `src/_vars.css` and nested selectors.
- No emojis, no em dashes, no arrow glyphs in code comments or docs.
- Do not touch the existing `change`, `alt`, `edit`, or `remove` events.

## Definition of Done

1. `image-input:alt-change` is emitted on every alt change (property,
   attribute, clear on remove) with detail `{ alt: string }`.
2. The example page shows `Alt: <value>` in a div below the component,
   always present in the layout, updated only by the new event.
3. Tests cover the event firing and payload shape, and the full test
   suite passes.
