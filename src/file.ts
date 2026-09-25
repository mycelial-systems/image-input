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

/**
 * Normalize a stored `src`. An empty string and a missing value both
 * mean "no stored image" -- preact turns `undefined` into `''` when it
 * sets a property, so '' has to be treated as absent here, not in a
 * setter.
 */
export function storedSrc (raw:string|null|undefined):string|null {
    return raw || null
}

function defaultBase ():string {
    return typeof location === 'undefined' ?
        'http://localhost/' :
        location.href
}

/**
 * The decoded last path segment of `url`, or '' when there is none.
 * `data:` and `blob:` URLs have no meaningful path, so they give ''.
 * Query and fragment are never part of a pathname, so they are
 * ignored for free.
 */
function lastSegment (url:string, base?:string):string {
    let parsed:URL
    try {
        parsed = new URL(url, base ?? defaultBase())
    } catch (_err) {
        return ''
    }
    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
        return ''
    }
    const segment = parsed.pathname.split('/').pop() ?? ''
    try {
        return decodeURIComponent(segment)
    } catch (_err) {
        return segment
    }
}

/**
 * Guess a MIME type from the extension on a URL's path, through a
 * reverse lookup of `EXT` plus `jpeg`. Case-insensitive. Returns null
 * when there is no extension or it is unknown. `EXT` is read on every
 * call, so a runtime change to `ImageInput.EXT` is honored.
 */
export function guessType (url:string, base?:string):string|null {
    const match = /\.([^.]+)$/.exec(lastSegment(url, base))
    if (!match) return null
    const ext = match[1].toLowerCase()
    if (ext === 'jpeg') return 'image/jpeg'
    for (const [type, known] of Object.entries(EXT)) {
        if (known.toLowerCase() === ext) return type
    }
    return null
}

/**
 * A file name for a crop of `src`: the base name comes from the URL's
 * last path segment, and the extension from the blob's actual type, so
 * the two always agree. Falls back to `image` when the URL has no
 * usable segment.
 */
export function cropName (
    src:string,
    blobType:string,
    base?:string
):string {
    const segment = lastSegment(src, base)
    const stem = segment.replace(/\.[^.]+$/, '')
    return deriveName(blobType, stem ? segment : null)
}

/**
 * The single rule for the inner file input's `required`: a stored
 * image satisfies it.
 */
export function inputRequired (
    wantsRequired:boolean,
    hasStoredImage:boolean
):boolean {
    return wantsRequired && !hasStoredImage
}
