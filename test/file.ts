import { test } from '@substrate-system/tapzero'
import {
    encodableType, storedSrc, guessType, cropName,
    inputRequired, EXT, CANVAS_TYPES
} from '../src/file.js'
import { ImageInput } from '../src/index.js'

test('encodableType keeps a type the canvas can encode', t => {
    t.equal(encodableType('image/png'), 'image/png',
        'should keep png')
    t.equal(encodableType('image/jpeg'), 'image/jpeg',
        'should keep jpeg')
    t.equal(encodableType('image/webp'), 'image/webp',
        'should keep webp')
})

test('encodableType falls back to jpeg for a type the canvas cannot ' +
    'encode', t => {
    t.equal(encodableType('image/heic'), 'image/jpeg',
        'heic is not encodable, so it should fall back')
    t.equal(encodableType('image/gif'), 'image/jpeg',
        'gif is not encodable, so it should fall back')
    t.equal(encodableType('image/avif'), 'image/jpeg',
        'avif is not encodable, so it should fall back')
    t.equal(encodableType('image/svg+xml'), 'image/jpeg',
        'svg is not encodable, so it should fall back')
})

test('encodableType falls back to jpeg when there is no type', t => {
    t.equal(encodableType(undefined), 'image/jpeg',
        'should fall back when there is no file')
    t.equal(encodableType(null), 'image/jpeg',
        'should fall back for null')
    t.equal(encodableType(''), 'image/jpeg',
        'should fall back for a file with an empty type')
})

test('storedSrc normalizes empty/absent values to null', t => {
    t.equal(storedSrc(''), null, 'empty string -> null')
    t.equal(storedSrc(null), null, 'null -> null')
    t.equal(storedSrc(undefined), null, 'undefined -> null')
})

test('storedSrc returns non-empty strings unchanged', t => {
    t.equal(storedSrc('http://example.com/img.png'),
        'http://example.com/img.png', 'http URL')
    t.equal(storedSrc('/images/photo.jpg'), '/images/photo.jpg',
        'relative path')
    t.equal(storedSrc('data:image/png;base64,...'),
        'data:image/png;base64,...', 'data URL')
})

test('inputRequired follows the rule: stored image satisfies required',
    t => {
        t.equal(inputRequired(true, false), true,
            'required=true, has image=false -> true (input needs to be ' +
        'required)')
        t.equal(inputRequired(true, true), false,
            'required=true, has image=true -> false (stored image satisfies)')
        t.equal(inputRequired(false, false), false,
            'required=false, has image=false -> false')
        t.equal(inputRequired(false, true), false,
            'required=false, has image=true -> false')
    })

test('guessType detects known extensions', t => {
    t.equal(guessType('/image.png'), 'image/png', '.png')
    t.equal(guessType('/IMAGE.PNG'), 'image/png', '.PNG (uppercase)')
    t.equal(guessType('/photo.jpg'), 'image/jpeg', '.jpg')
    t.equal(guessType('/photo.jpeg'), 'image/jpeg', '.jpeg')
    t.equal(guessType('/graphic.webp'), 'image/webp', '.webp')
    t.equal(guessType('/animation.gif'), 'image/gif', '.gif')
    t.equal(guessType('/modern.avif'), 'image/avif', '.avif')
})

test('guessType ignores query and fragment', t => {
    t.equal(guessType('/a/b.png?v=2#x.jpg'), 'image/png',
        'png with query and fragment')
})

test('guessType works with absolute URLs', t => {
    t.equal(guessType('https://cdn.example.com/images/photo.png'),
        'image/png', 'full URL')
})

test('guessType returns null for missing/unknown extensions', t => {
    t.equal(guessType('/api/cover/123'), null, 'no extension')
    t.equal(guessType('/a.bmp'), null, 'unknown extension')
    t.equal(guessType('/a.heic'), null, 'heic (not in EXT)')
})

test('guessType returns null for data: URLs', t => {
    t.equal(guessType('data:image/png;base64,iVBOR...'), null,
        'data: URL has no path')
})

test('guessType honors runtime mutation of ImageInput.EXT', t => {
    try {
        ImageInput.EXT['image/bmp'] = 'bmp'
        t.equal(guessType('/image.bmp'), 'image/bmp',
            'newly added extension detected')
    } finally {
        delete ImageInput.EXT['image/bmp']
    }
})

test('cropName builds filename from URL and blob type', t => {
    t.equal(cropName('/assets/post/abc.png', 'image/png'), 'abc.png',
        'preserves name when type matches')
    t.equal(cropName('/assets/post/abc.png', 'image/jpeg'), 'abc.jpg',
        'changes extension when type differs')
})

test('cropName falls back to image.<ext> when URL has no path', t => {
    t.equal(cropName('https://example.com/', 'image/webp'), 'image.webp',
        'root URL')
    t.equal(cropName('data:image/png;base64,...', 'image/png'),
        'image.png', 'data: URL')
})

test('cropName property check: all results end with correct ' +
    'extension and have stem', t => {
    // Seeded LCG for deterministic randomness
    let seed = 12345
    function nextRandom ():number {
        seed = (seed * 1103515245 + 12345) >>> 0
        return seed / 0x100000000
    }

    function randomString (
        chars:string,
        maxLen:number
    ):string {
        const len = Math.floor(nextRandom() * (maxLen + 1))
        let result = ''
        for (let i = 0; i < len; i++) {
            result += chars[Math.floor(nextRandom() * chars.length)]
        }
        return result
    }

    const failures:string[] = []
    const tests = 200

    for (let i = 0; i < tests; i++) {
        // Build URL from parts
        const depth = Math.floor(nextRandom() * 4) + 1
        const dirs:string[] = []
        for (let d = 0; d < depth; d++) {
            dirs.push(randomString('abcdefghijklmnopqrstuvwxyz', 4))
        }
        const stem = randomString(
            'abcdefghijklmnopqrstuvwxyz0123456789-_.%20',
            8
        )
        const hasExt = nextRandom() > 0.3
        let segment = stem
        if (hasExt) {
            const knownExts = Object.values(EXT)
            const useKnown = nextRandom() > 0.3
            if (useKnown) {
                const ext =
                    knownExts[Math.floor(nextRandom() * knownExts.length)]
                segment = stem ? `${stem}.${ext}` : ext
            } else if (nextRandom() > 0.5) {
                // Random uppercase extension
                const ext =
                    knownExts[Math.floor(nextRandom() * knownExts.length)]
                segment = stem ?
                    `${stem}.${ext.toUpperCase()}` :
                    ext.toUpperCase()
            } else {
                // Unknown extension
                segment = stem ? `${stem}.xyz` : 'xyz'
            }
        }
        if (nextRandom() > 0.5) {
            segment += '?query=value'
        }
        if (nextRandom() > 0.5) {
            segment += '#fragment'
        }

        const url = `https://example.com/${dirs.join('/')}/${segment}`
        const canvasTypes = Array.from(CANVAS_TYPES)
        for (const type of canvasTypes) {
            const result = cropName(url, type)
            const expectedExt = EXT[type]
            if (!result.endsWith(`.${expectedExt}`)) {
                failures.push(
                    `URL ${url} with type ${type} gave ` +
                    `${result}, expected to end with .${expectedExt}`
                )
            }
            const beforeExt = result.replace(/\.[^.]+$/, '')
            if (!beforeExt) {
                failures.push(
                    `URL ${url} with type ${type} gave ${result}, ` +
                    'no stem before extension'
                )
            }
        }
    }

    for (const failure of failures) {
        t.fail(failure)
    }
    t.ok(failures.length === 0, 'all 200 property checks passed')
})
