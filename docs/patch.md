# Upstream patch notes: @substrate-system packages

**Status, 2026-08-23:** items 1 through 6 are fixed in this repo. See
`docs/plans/2026-08-23-upstream-patches.md`. Items 7 through 10 belong
to `@substrate-system/drag-drop` and are still open there.

Found while implementing the composer drag-and-drop design
(`docs/design-plans/2026-08-22-composer-drag-drop.md`) on 2026-08-22.
Every item was read out of the INSTALLED `node_modules` build, not from
a README, and each one quotes the code it is about.

Nothing here blocks the `composer-drag-drop` branch. The branch works
around items 1 and 2 in-repo and takes item 3 as a known trap.

---

## @substrate-system/image-input 0.0.9

### 1. `getBlob` defaults to `image/jpeg` while holding the source file

`dist/crop.js`:

```js
getBlob (opts) {
  if (!this.#naturalWidth) { ... }
  const img = this.qs("img")
  const { x, y, width, height } = this.#crop
  const type = opts?.type ?? "image/jpeg"
```

The component already stores the source file as `#file` (set by
`setFile`), so it knows the input's real type and ignores it. A caller
who omits `type` gets a PNG silently re-encoded as JPEG: transparency is
flattened onto black, and the returned blob's MIME disagrees with the
file the author chose.

Suggested: default to `this.#file?.type ?? 'image/jpeg'`. That keeps the
behavior for a component with no file and makes the common case
lossless. It is technically a behavior change, so it wants a minor bump
and a changelog line.

Severity: high. This is the easiest way for a consumer to lose data
without any error.

Affects rebase.blog: yes, avoided. Phase 7 of the branch passes
`getBlob({ type: p.file.type })` explicitly, and has an e2e case that
fails if the argument is dropped.

### 2. No event when the image finishes loading

`dist/crop.js`:

```js
#handleImageLoad = () => {
  const img = this.qs("img")
  if (!img) return
  this.#naturalWidth = img.naturalWidth
  this.#naturalHeight = img.naturalHeight
  this.#ratio = ...
  this.#crop = ...
  this.#layout()
}
```

Loading is asynchronous and this is the only place the element becomes
usable, but it emits nothing. Until it runs, `crop` reads
`{0,0,0,0}` and `getBlob` rejects. A consumer therefore has no
supported way to know when the cropper is ready, and is left polling
`el.crop.width > 0`.

Suggested: `this.emit('load', { detail: { naturalWidth, naturalHeight } })`
at the end of the handler. The event vocabulary already exists; the
class emits `change` from three other places.

Severity: medium. It does not break anything, but it forces every
consumer to invent the same workaround.

### 3. Loading mutates the crop rect without emitting `change`

Same handler as item 2. `#handleImageLoad` ASSIGNS `#crop`, to either
the full natural frame or the ratio-fitted rect. Every other path that
mutates `#crop` announces it. Each of `handleChange_crop`,
`#handlePointerMove` and `#handleKeyDown` ends with the same line:

```js
this.emit("change", { detail: { ...this.#crop } })
```

Load is the one exception. A consumer tracking crop state from `change`
alone never learns the initial rect, so its first observed value is
whatever the user's first drag produced.

This is separable from item 2 and arguably the more clear-cut bug: it
is an inconsistency inside the class rather than a missing feature. If
item 2 lands as a `load` event, this could reasonably be folded into it
by emitting both.

Severity: medium.

### 4. `render()` interpolates `src` into an HTML string unescaped

`dist/crop.js`:

```js
render () {
  const src = this.src ?? ""
  ...
  this.innerHTML = `<div class="image-crop-frame">
          <img src="${src}" alt="" />
```

`src` is a reflected string attribute, so it is whatever the consumer
put there. A value containing a double quote breaks out of the
attribute: `el.src = '" onerror="…'` injects markup into the component.

Suggested: build the `<img>` with `document.createElement` and
`setAttribute`, or at minimum escape `"` and `&`. The rest of the
template is static, so this is the only interpolation to fix.

Severity: low in practice, since a consumer normally sets an object URL
it created. Worth closing anyway because it costs nothing and the
component is a general-purpose one.

Affects rebase.blog: no. We only ever pass `URL.createObjectURL(file)`.

### 5. `ImageCrop` is not reachable from the package root

`dist/index.d.ts` exports `ImageInput` and `ImageInputEventMap` only, so
`import { ImageCrop } from '@substrate-system/image-input'` fails with
TS2305 and the `/crop` subpath is the only way in. Worth a re-export for
discoverability.

Severity: low, DX only.

Verified NOT a problem: the `/crop` subpath itself resolves and
typechecks correctly under this repo's `moduleResolution: "Bundler"`,
including `setFile`, the `crop` getter and `getBlob`, even though the
exports map has no explicit `./crop` entry and no `types` condition. It
falls through the `"./*"` wildcard to `dist/crop.js` and picks up
`dist/crop.d.ts` beside it. An explicit entry would be more robust
across resolvers, but nothing is broken today.

### 6. No CSS subpath for the cropper alone

`exports` offers `./css` and `./css/min`, both the whole
`dist/index.css`. A consumer using only `<image-crop>` (as this repo
does) ships the styles for the full `<image-input>` box as well. A
`./css/crop` entry would trim that.

Severity: low.

### 7. It depends on drag-drop and inherits both defects below

`"dependencies": { "@substrate-system/drag-drop": "^0.4.12" }`. Worth
sequencing: fixing drag-drop first means image-input picks the fixes up
on its next release.

---

## @substrate-system/drag-drop 0.4.13

Both of these are the reason the branch does not use the module's text
path at all. They are described in more detail in
`docs/implementation-plans/2026-08-22-composer-drag-drop/phase_03.md`.

### 8. `getData("text")` is read after an `await`, so it returns ""

`dist/index.js`:

```js
async function onDrop (ev) {
  ...
  const files = ev.dataTransfer.files
  let record = await handleItems(ev.dataTransfer.items, showHidden)
  ...
  listenerObject.onDrop?.(record, { pos, files })
  const text = ev.dataTransfer.getData("text")     // after the await
  if (text && listenerObject.onDropText) {
    listenerObject.onDropText(text, pos)
  }
```

`handleItems` awaits `fileEntry.file(resolve)`, a genuine async
callback. By the time it resolves the drop event has finished
dispatching and the drag data store is in protected mode, where
`getData` answers the empty string. `onDropText` is therefore
unreliable, and unreliable in a way that depends on what was dragged.

Suggested: capture `const text = ev.dataTransfer.getData("text")` at the
TOP of `onDrop`, before the await, and pass the captured value to
`onDropText`. The public API does not change.

Severity: high. The callback silently never fires.

### 9. A text-only drag lights up the drop zone

`dist/util.js`:

```js
if (fileItems.length === 0 && textItems.length === 0) return false
if (fileItems.length > 0 && listeners.onDrop) return true
if (textItems.length > 0 && listeners.onDropText) return true
return false
```

`onDragEnter` adds the `drag` class whenever `isEventHandleable` is
true. So merely registering `onDropText` makes any drag whose types are
only `text/*` light up the drop zone, including dragging a text
selection around inside a textarea that happens to sit in the drop
target. The user gets a drop affordance for something the drop will not
act on.

Suggested: gate the class on the drop being actionable rather than on
which callbacks happen to be registered, or expose an option for it.

Severity: medium, cosmetic but constant during ordinary text editing.

### 10. Minor: the drop listener alone skips `isEventHandleable`

`onDragEnter`, `onDragOver` and `onDragLeave` all early-return when the
drag is not handleable. `onDrop` does not, so the consumer's `onDrop`
callback fires for a drop carrying nothing at all, with an empty record
and an empty FileList.

This is arguably correct and the branch relies on it (it is what makes a
single callback the one dispatch point, and it is why the module
`preventDefault`s every drop on the target, which is a genuine safety
property). Recording it only because the asymmetry looks accidental and
should not be "tidied up" without noticing that consumers may depend on
it. If anything, it deserves a comment rather than a change.

Severity: none. Do not change without a deprecation.
