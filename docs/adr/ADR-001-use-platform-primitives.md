# ADR-001: Use platform primitives instead of framework abstractions

**Date:** 2026-07-25

**Superseded in part by
[ADR-002](ADR-002-events-not-dialogs.md):** the component no longer
renders dialogs of its own, so the third and fifth bullets of the
decision below, and the closing note about `@starting-style` and the
`overlay` transition, describe a version that has been removed. The
rest still holds, and applies to the dialog the application now writes.

## Context

`image-input` is a redistributable web component. It is consumed by
applications we do not control, in build setups we do not control,
alongside frameworks we do not control. A file picker with a preview,
a crop tool and alt text is the kind of widget that is usually shipped
as a React/Vue/Svelte component with its own runtime, its own state
container, its own focus-trap implementation, its own modal, and its
own theming API.

Every one of those layers has a browser-native equivalent now.
`<input type="file">` already participates in forms and constraint
validation. `<dialog>` already does top layer, focus trapping, inert
background and Esc-to-close. Custom properties already do theming.
`CustomEvent` already does the observer pattern, including
cancellation. Pointer Events already do capture across element
boundaries. Canvas already does image resampling and encoding.

Re-implementing any of these means shipping code that is larger,
slower to load, less accessible than the native version, and wrong in
edge cases the platform has already worked out. It also means the
component only composes with consumers who accept our abstractions.

## Decision

Build on platform primitives, and treat reaching for a library or a
hand-rolled abstraction as the exception that needs justification.
Concretely:

* The real control is a native `<input type="file">`. Every input
  path -- picker, drop, `setImage()` -- normalizes to a `File` and
  writes it back into `input.files` through a `DataTransfer`, so a
  surrounding `<form>` submits it and `required` is reported by
  native constraint validation with no shim. The input is hidden with
  a clip-path trick rather than `display:none`, `visibility:hidden`
  or `hidden`, all of which would make it unfocusable and suppress
  `required`.
* The component renders into the light DOM. No shadow root. Consumer
  CSS reaches the markup, and form association is the browser's
  default rather than something we re-establish with
  `ElementInternals`.
* The built-in alt-text and crop dialogs are native `<dialog>`
  elements opened with `showModal()`. Focus trapping, Esc, backdrop
  and top-layer stacking come from the platform.
* Theming is CSS custom properties, declared in `src/_vars.css`. There
  is no JS theme object and no style props. The component sets no
  width, height or aspect ratio at all -- sizing belongs to the
  consumer's stylesheet.
* The extension points are bubbling, cancelable `CustomEvent`s
  (`image-input:change`, `:edit`, `:alt`, `:remove`, `:alt-change`,
  `:error`). Calling `preventDefault()` on `:edit` or `:alt`
  suppresses the built-in dialog so the consumer can substitute their
  own UI. No callback props, no render props, no plugin registry.
* Cropping is Canvas 2D plus `toBlob()`. The crop handles are Pointer
  Events with `setPointerCapture`, not a drag library.
* Presentation is separated from behavior: `src/html.ts` emits markup
  as a string, so the same component can be server-rendered and
  hydrated by `ImageInputClient` without the custom element at all.
* Runtime dependencies stay near zero. `@preact/signals`, `preact` and
  `htm` are used by the example app, not by `src/`.

Where the platform is incomplete, document the gap rather than
polyfill it. The dialogs' open animation uses `@starting-style` and
`transition-behavior: allow-discrete` (Baseline 2024-08-06); the
`overlay` transition property that would animate the *close* is
Chromium-only, so Firefox and Safari close instantly. That is recorded
as a known limitation, not patched with a JS animation.

## Consequences

Easier:

* Forms, validation, keyboard access and screen reader behavior are
  correct by default because they are the browser's implementations,
  not ours.
* The component composes with any consumer -- plain HTML, React, Vue,
  server-rendered pages -- because it exposes only DOM.
* The bundle stays small and has no framework runtime to duplicate or
  conflict with the host application's.
* Theming has no API surface to version. Adding a custom property is
  not a breaking change.

Harder:

* Light DOM gives no style encapsulation. Consumer CSS can break the
  component, and the component's own selectors must be specific enough
  to survive the page. It also rules out `id` attributes in our markup
  entirely, since ten `<image-input>` elements on a page would emit
  ten duplicate ids -- dialogs are labeled with `aria-label`, and
  per-dialog class names (`.alt-save`, `.crop-save`) replace shared
  ones.
* Platform APIs have rough edges we absorb instead of hiding. A
  `FileList` cannot be constructed, so writing files back to the input
  requires `DataTransfer`, which is not constructible in every
  environment and needs a `try`/`catch`. `setPointerCapture` throws
  for synthetic pointers.
* Tests must run in a real browser (`tape-run`), not jsdom, because
  `<dialog>`, `DataTransfer`, canvas encoding and pointer capture are
  all involved.
* We inherit a browser support floor from Baseline features rather
  than choosing one via polyfills, and behavior differs across engines
  where the platform itself differs.
* Consumers who want behavior we did not anticipate must work through
  DOM events and CSS. There is no imperative escape hatch beyond
  `preventDefault()` plus `setImage()`.
