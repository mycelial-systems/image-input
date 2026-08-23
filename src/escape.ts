/**
 * Escape a string for safe interpolation inside a double-quoted HTML
 * attribute. `&` must run first, or the entities this introduces
 * would themselves get escaped.
 *
 * This lives in its own module rather than in `html.ts` because
 * `crop.ts` needs it too, and `crop.ts` is a standalone entry point
 * (`@substrate-system/image-input/crop`). Importing it from `html.ts`
 * would pull `dialogs.ts` and the whole `<image-input>` markup into
 * every crop-only bundle.
 */
export function escapeAttr (value:string):string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
