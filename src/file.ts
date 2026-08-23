/**
 * Blob-to-File promotion, shared by `ImageInput` and
 * `ImageInputClient`.
 *
 * Both need the same guarantee -- that the file they hold, and the
 * file they hand to consumers on `image-input:change`, is always a
 * `File` and never a bare `Blob`. `ImageCrop.setFile()` requires a
 * `File`, and consumers read `detail.file.name`. Keeping the rule in
 * one module is deliberate: the markup used to be duplicated between
 * `html.ts` and `index.ts` and the two drifted apart.
 */

export const EXT:Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif'
}

/**
 * Build a filename for a blob of the given MIME type, reusing the
 * previous file's base name when there is one so a cropped image
 * stays recognisably the same photo.
 */
export function deriveName (type:string, prevName?:string|null):string {
    const base = prevName ?
        prevName.replace(/\.[^.]+$/, '') :
        'image'
    const ext = EXT[type] ?? 'jpg'
    return `${base}.${ext}`
}

/**
 * Return `file` unchanged when it is already a `File` and no name
 * override was asked for. Otherwise wrap it in a `File`, naming it
 * from `name`, or from `prevName` plus the type's extension.
 */
export function toFile (
    file:File|Blob,
    name?:string,
    prevName?:string|null
):File {
    if (file instanceof File && !name) return file
    return new File([file], name ?? deriveName(file.type, prevName), {
        type: file.type
    })
}

/**
 * The MIME types `canvas.toBlob` is actually able to encode.
 *
 * Anything outside this set is silently encoded as PNG while the
 * caller believes they asked for something else, so a blob's `type`
 * would disagree with its bytes. `EXT` above is a different list on
 * purpose: it maps types this package might *receive* to file
 * extensions, which includes types the canvas cannot write.
 */
export const CANVAS_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp'
])

/**
 * The type a canvas should be encoded to, given the source image's
 * own type.
 *
 * Re-encoding a PNG as JPEG flattens its transparency onto black and
 * mislabels the result, so prefer the source type. Fall back to
 * `image/jpeg` -- the historical default, and a type the canvas can
 * always write -- for a source the canvas cannot encode, and for an
 * image that arrived with no file at all (a bare `src` attribute).
 */
export function encodableType (type?:string|null):string {
    return (type && CANVAS_TYPES.has(type)) ? type : 'image/jpeg'
}
