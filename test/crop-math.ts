import { test } from '@substrate-system/tapzero'
import {
    moveRect,
    resizeRect,
    resizeRectLocked,
    toNaturalRect,
    fitWithin,
    fitRatioRect,
    parseAspectRatio,
    parseCropAttribute,
    resolveCropRatio
} from '../src/crop-math.js'

test('fitWithin fits to the width when height is unconstrained', t => {
    const size = fitWithin(400, 200, 200, 0)
    t.equal(size.width, 200, 'width should fill the available width')
    t.equal(size.height, 100, 'height should preserve the aspect ratio')
})

test('fitWithin constrains by height when the image is too tall', t => {
    // A 400x1200 image in a 480x800 box must fit the height.
    const size = fitWithin(400, 1200, 480, 800)
    t.equal(size.height, 800, 'height should be capped at the available height')
    t.equal(size.width, 400 * (800 / 1200),
        'width should shrink to preserve the aspect ratio')
})

test('fitWithin constrains by width when the image is too wide', t => {
    const size = fitWithin(1200, 400, 480, 800)
    t.equal(size.width, 480, 'width should be capped at the available width')
    t.equal(size.height, 400 * (480 / 1200),
        'height should shrink to preserve the aspect ratio')
})

test('moveRect shifts the rect by dx, dy within bounds', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 200, height: 100 }

    const moved = moveRect(rect, 5, -5, bounds)

    t.equal(moved.x, 15, 'should shift x by dx')
    t.equal(moved.y, 5, 'should shift y by dy')
    t.equal(moved.width, 50, 'width should be unchanged')
    t.equal(moved.height, 50, 'height should be unchanged')
})

test('moveRect clamps to the left/top bounds', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 200, height: 100 }

    const moved = moveRect(rect, -50, -50, bounds)

    t.equal(moved.x, 0, 'should not move past the left bound')
    t.equal(moved.y, 0, 'should not move past the top bound')
})

test('moveRect clamps to the right/bottom bounds', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 100, height: 80 }

    const moved = moveRect(rect, 100, 100, bounds)

    t.equal(moved.x, 50, 'should not push the right edge past the bound')
    t.equal(moved.y, 30, 'should not push the bottom edge past the bound')
})

test('resizeRect with a corner handle resizes both axes', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 200, height: 200 }

    const resized = resizeRect(rect, 'se', 10, 20, bounds, 32)

    t.equal(resized.x, 10, 'left edge should be unchanged')
    t.equal(resized.y, 10, 'top edge should be unchanged')
    t.equal(resized.width, 60, 'width should grow by dx')
    t.equal(resized.height, 70, 'height should grow by dy')
})

test('resizeRect with an edge handle resizes only one axis', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 200, height: 200 }

    const resized = resizeRect(rect, 'e', 10, 20, bounds, 32)

    t.equal(resized.width, 60, 'width should grow by dx')
    t.equal(resized.height, 50, 'height should be unaffected by dy')
    t.equal(resized.y, 10, 'top edge should be unaffected')
})

test('resizeRect with the nw handle moves the origin', t => {
    const rect = { x: 20, y: 20, width: 50, height: 50 }
    const bounds = { width: 200, height: 200 }

    const resized = resizeRect(rect, 'nw', -10, -5, bounds, 32)

    t.equal(resized.x, 10, 'left edge should move by dx')
    t.equal(resized.y, 15, 'top edge should move by dy')
    t.equal(resized.width, 60, 'width should grow to compensate')
    t.equal(resized.height, 55, 'height should grow to compensate')
})

test('resizeRect enforces a minimum size', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 200, height: 200 }

    const resized = resizeRect(rect, 'se', -100, -100, bounds, 32)

    t.equal(resized.width, 32, 'width should not shrink below the minimum')
    t.equal(resized.height, 32, 'height should not shrink below the minimum')
})

test('resizeRect clamps growth to the image bounds', t => {
    const rect = { x: 10, y: 10, width: 50, height: 50 }
    const bounds = { width: 80, height: 70 }

    const resized = resizeRect(rect, 'se', 1000, 1000, bounds, 32)

    t.equal(resized.width, 70, 'width should not push past the right bound')
    t.equal(resized.height, 60, 'height should not push past the bottom bound')
})

test('toNaturalRect converts a display rect back to natural pixels', t => {
    const displayRect = { x: 20, y: 10, width: 100, height: 50 }

    const natural = toNaturalRect(displayRect, 0.5)

    t.equal(natural.x, 40, 'x should divide by scale')
    t.equal(natural.y, 20, 'y should divide by scale')
    t.equal(natural.width, 200, 'width should divide by scale')
    t.equal(natural.height, 100, 'height should divide by scale')
})

test('parseAspectRatio accepts a bare number', t => {
    t.equal(parseAspectRatio('0.75'), 0.75, 'should parse a decimal')
})

test('parseAspectRatio accepts CSS aspect-ratio slash syntax', t => {
    t.equal(parseAspectRatio('3/4'), 0.75, 'should divide w by h')
    t.equal(parseAspectRatio('3 / 4'), 0.75, 'should allow spaces around the slash')
})

test('parseAspectRatio rejects zero, negative and non-finite values', t => {
    t.equal(parseAspectRatio('0'), null, 'zero should be rejected')
    t.equal(parseAspectRatio('-1'), null, 'negative should be rejected')
    t.equal(parseAspectRatio('1/0'), null, 'division by zero should be rejected')
    t.equal(parseAspectRatio('abc'), null, 'a non-numeric string should be rejected')
})

test('parseCropAttribute resolves the "constrain" keyword', t => {
    t.deepEqual(parseCropAttribute('constrain'), { kind: 'constrain' })
})

test('parseCropAttribute resolves the "circle" keyword to a 1:1 ' +
    'ratio marked circle', t => {
    t.deepEqual(
        parseCropAttribute('circle'),
        { kind: 'ratio', ratio: 1, circle: true }
    )
})

test('parseCropAttribute resolves a ratio literal', t => {
    t.deepEqual(
        parseCropAttribute('3/4'),
        { kind: 'ratio', ratio: 0.75, circle: false }
    )
})

test('parseCropAttribute returns null for no value or an empty string', t => {
    t.equal(parseCropAttribute(null), null, 'null should be free-form')
    t.equal(parseCropAttribute(''), null, 'empty string should be free-form')
})

test('parseCropAttribute falls back to null for an unusable value', t => {
    t.equal(parseCropAttribute('sideways'), null,
        'an unrecognized keyword should fall back to free-form')
    t.equal(parseCropAttribute('0'), null,
        'zero should fall back to free-form')
})

test('resolveCropRatio reads a literal ratio straight through', t => {
    const ratio = resolveCropRatio({ kind: 'ratio', ratio: 2, circle: false }, 400, 100)
    t.equal(ratio, 2, 'should ignore the natural size for a literal ratio')
})

test('resolveCropRatio reads "constrain" off the natural image size', t => {
    const ratio = resolveCropRatio({ kind: 'constrain' }, 400, 200)
    t.equal(ratio, 2, 'should be naturalWidth / naturalHeight')
})

test('resolveCropRatio returns null for "constrain" with no image loaded yet', t => {
    const ratio = resolveCropRatio({ kind: 'constrain' }, 0, 0)
    t.equal(ratio, null, 'should not divide by a zero natural size')
})

test('fitRatioRect centers the largest rect of the given ratio inside ' +
    'a wider image', t => {
    // 400x200 image, locked to 1:1 -> the largest square that fits is
    // 200x200, centered horizontally
    const rect = fitRatioRect(1, 400, 200)
    t.deepEqual(rect, { x: 100, y: 0, width: 200, height: 200 })
})

test('fitRatioRect centers the largest rect of the given ratio inside ' +
    'a taller image', t => {
    // 200x400 image, locked to 1:1 -> the largest square that fits is
    // 200x200, centered vertically
    const rect = fitRatioRect(1, 200, 400)
    t.deepEqual(rect, { x: 0, y: 100, width: 200, height: 200 })
})

test('resizeRectLocked with a corner handle scales both axes, ' +
    'preserving the ratio', t => {
    const rect = { x: 20, y: 20, width: 100, height: 50 }
    const bounds = { width: 400, height: 400 }

    const resized = resizeRectLocked(rect, 'se', 40, 0, bounds, 32, 2)

    t.equal(resized.width / resized.height, 2, 'ratio should be preserved')
    t.equal(resized.x, 20, 'the anchored (nw) corner should not move')
    t.equal(resized.y, 20, 'the anchored (nw) corner should not move')
    t.ok(resized.width > rect.width, 'should have grown')
})

test('resizeRectLocked anchors the opposite corner from the dragged one', t => {
    const rect = { x: 100, y: 100, width: 100, height: 50 }
    const bounds = { width: 400, height: 400 }

    const resized = resizeRectLocked(rect, 'nw', -40, 0, bounds, 32, 2)

    t.equal(resized.width / resized.height, 2, 'ratio should be preserved')
    t.equal(resized.x + resized.width, rect.x + rect.width,
        'the anchored (se) corner\'s right edge should not move')
    t.equal(resized.y + resized.height, rect.y + rect.height,
        'the anchored (se) corner\'s bottom edge should not move')
})

test('resizeRectLocked enforces a minimum size on both axes without ' +
    'breaking the ratio', t => {
    const rect = { x: 20, y: 20, width: 100, height: 50 }
    const bounds = { width: 400, height: 400 }

    const resized = resizeRectLocked(rect, 'se', -1000, -1000, bounds, 32, 2)

    t.equal(resized.width / resized.height, 2, 'ratio should be preserved')
    t.ok(resized.width >= 32, 'width should not shrink below the minimum')
    t.ok(resized.height >= 32, 'height should not shrink below the minimum')
})

test('resizeRectLocked shrinks from a delta on a single axis -- a ' +
    'pure horizontal/vertical drag, or a keyboard step, leaves the ' +
    'other delta at exactly zero and must still be able to shrink',
t => {
    const rect = { x: 50, y: 0, width: 100, height: 100 }
    const bounds = { width: 200, height: 100 }

    const resized = resizeRectLocked(rect, 'se', -30, 0, bounds, 32, 1)

    t.ok(resized.width < rect.width, 'should shrink from a dx-only delta')
    t.equal(resized.width, resized.height, 'ratio should be preserved')
})

test('resizeRectLocked clamps growth to the bounds without breaking ' +
    'the ratio', t => {
    const rect = { x: 20, y: 20, width: 100, height: 50 }
    const bounds = { width: 150, height: 100 }

    const resized = resizeRectLocked(rect, 'se', 1000, 1000, bounds, 32, 2)

    t.equal(resized.width / resized.height, 2, 'ratio should be preserved')
    t.ok(resized.x + resized.width <= bounds.width,
        'right edge should stay inside the bounds')
    t.ok(resized.y + resized.height <= bounds.height,
        'bottom edge should stay inside the bounds')
})
