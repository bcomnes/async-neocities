import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSupportedFiletypes, updateSupportedFiletypes } from './update-supported-filetypes.js'

const page = `
  <p>The full list of supported file extensions is:</p>
  <strong>apng asc glsl html jxl sf2 xsl xslt</strong>
  <p>In addition, we have measures in place.</p>
`

test('parses the full supported filetypes list from the Neocities page', () => {
  assert.deepEqual(parseSupportedFiletypes(page), [
    '.apng',
    '.asc',
    '.glsl',
    '.html',
    '.jxl',
    '.sf2',
    '.xsl',
    '.xslt'
  ])
})

test('updates the supportedFiletypes declaration', () => {
  const source = [
    'const header = true',
    '',
    'export const supportedFiletypes = new Set([',
    '  \'.old\',',
    '  \'.html\'',
    '])',
    ''
  ].join('\n')

  const expected = [
    'const header = true',
    '',
    'export const supportedFiletypes = new Set([',
    '  \'.apng\',',
    '  \'.asc\',',
    '  \'.glsl\',',
    '  \'.html\',',
    '  \'.jxl\',',
    '  \'.sf2\',',
    '  \'.xsl\',',
    '  \'.xslt\'',
    '])',
    ''
  ].join('\n')

  assert.equal(updateSupportedFiletypes(source, page), expected)
})

test('fails when the Neocities page no longer contains the expected list', () => {
  assert.throws(
    () => parseSupportedFiletypes('<h1>Allowed File Types</h1>'),
    /Unable to find the supported filetypes marker/
  )
})
