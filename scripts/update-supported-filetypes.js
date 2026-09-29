import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const NEOCITIES_ALLOWED_TYPES_URL = 'https://neocities.org/site_files/allowed_types'

const supportedFiletypesDeclaration = /export const supportedFiletypes = new Set\(\[\n[\s\S]*?\n\]\)/

/**
 * Parse the full supported-extension list from the Neocities allowed-types page.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function parseSupportedFiletypes (html) {
  const marker = 'full list of supported file extensions is:'
  const markerIndex = html.toLowerCase().indexOf(marker)
  if (markerIndex === -1) {
    throw new Error(`Unable to find the supported filetypes marker on ${NEOCITIES_ALLOWED_TYPES_URL}`)
  }

  const afterMarker = html.slice(markerIndex + marker.length)
  const listMatch = afterMarker.match(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/i) ??
    afterMarker.match(/\*\*([^*]+)\*\*/)

  if (!listMatch?.[1]) {
    throw new Error(`Unable to find the supported filetypes list on ${NEOCITIES_ALLOWED_TYPES_URL}`)
  }

  const extensions = listMatch[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;|&#47;/g, '/')
    .trim()
    .split(/\s+/)
    .map(extension => extension.replace(/^\./, ''))
    .map(extension => `.${extension}`)

  if (extensions.length === 0 || extensions.some(extension => !/^\.[A-Za-z0-9]+$/.test(extension))) {
    throw new Error(`Neocities returned an invalid supported filetypes list: ${listMatch[1]}`)
  }

  const uniqueExtensions = new Set(extensions)
  if (uniqueExtensions.size !== extensions.length) {
    throw new Error('Neocities returned duplicate supported filetypes')
  }

  return [...uniqueExtensions].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

/**
 * Replace the supported-filetypes declaration with a generated, sorted list.
 *
 * @param {string} source
 * @param {string} html
 * @returns {string}
 */
export function updateSupportedFiletypes (source, html) {
  const extensions = parseSupportedFiletypes(html)
  const replacement = [
    'export const supportedFiletypes = new Set([',
    ...extensions.map(extension => `  '${extension}',`),
    '])'
  ].join('\n').replace(/,\n\]\)$/, '\n])')

  const matches = source.match(supportedFiletypesDeclaration)
  if (!matches || matches.length !== 1) {
    throw new Error('Unable to find the supportedFiletypes declaration')
  }

  return source.replace(supportedFiletypesDeclaration, replacement)
}

async function main () {
  const sourcePath = join(import.meta.dirname, '../lib/supported-filetypes.js')
  const response = await fetch(NEOCITIES_ALLOWED_TYPES_URL, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'async-neocities-supported-filetypes-updater'
    }
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch ${NEOCITIES_ALLOWED_TYPES_URL}: ${response.status} ${response.statusText}`)
  }

  const [source, html] = await Promise.all([
    readFile(sourcePath, 'utf8'),
    response.text()
  ])
  const updatedSource = updateSupportedFiletypes(source, html)

  if (updatedSource === source) {
    console.log('Supported Neocities filetypes are up to date.')
    return
  }

  await writeFile(sourcePath, updatedSource)
  console.log(`Updated ${sourcePath} from ${NEOCITIES_ALLOWED_TYPES_URL}.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
