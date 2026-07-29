/**
 * Install the component's stylesheet.
 *
 * Some of this component's contracts are CSS-only -- `touch-action`
 * on the crop rect, for one -- and cannot be asserted at all without
 * the real stylesheet applied. tapout serves its own page, so the
 * tests bring their own styles instead of relying on a `<link>` in an
 * HTML fixture.
 *
 * `test/index.css` is bundled from `src/index.css` by `npm run
 * build-tests`, which resolves the `@import` of `_vars.css` before
 * esbuild inlines the result here as text.
 */
import css from './index.css'

const style = document.createElement('style')
style.textContent = css
document.head.appendChild(style)
