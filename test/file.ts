import { test } from '@substrate-system/tapzero'
import { encodableType } from '../src/file.js'

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
