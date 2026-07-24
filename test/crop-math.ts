import { test } from '@substrate-system/tapzero'
import {
    moveRect,
    resizeRect,
    toNaturalRect,
    fitWithin
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
