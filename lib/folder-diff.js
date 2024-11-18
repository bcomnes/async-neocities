/**
 * @import { SiteFileList, FileUpload } from './neocities.js'
 * @import afw from 'async-folder-walker'
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { keyBy } from './key-by.js'
import { supportedFiletypes } from './supported-filetypes.js'

/**
 * @typedef {{
 *    filesToUpload: FileUpload[]
 *    filesToDelete: string[]
 *    filesSkipped: string[]
 *    protectedFiles: string[]
 *    unsupportedFiles: string[]
 * }} AsyncNeocitiesDiff
 */

/**
 * neocitiesLocalDiff returns an array of files to delete and update and some useful stats.
 * @param  {object} params
 * @param  {SiteFileList['files']} params.neocitiesFiles Array of files returned from the neocities list api.
 * @param  {afw.FWStats[]} params.localListing   Array of files returned by a full data async-folder-walker run.
 * @param  {(path: string) => boolean} [params.protectedFileFilter]
 * @param  {boolean} [params.includeUnsupportedFiles=false] Set to true to bypass file type restrictions when a neocities supporter account is used.
 * @return {Promise<AsyncNeocitiesDiff>}
 */
export async function neocitiesLocalDiff ({
  neocitiesFiles,
  localListing,
  protectedFileFilter = (_path) => false,
  includeUnsupportedFiles = false
}) {
  const neoCitiesFiltered = neocitiesFiles.filter(f => !f.is_directory)
  const ncIndex = keyBy(neoCitiesFiltered, 'path')

  const ncFiles = new Set(neoCitiesFiltered.map(f => f.path)) // shape

  const localListingFiltered = localListing.filter(f => !f.stat.isDirectory()) // files only
  const localIndex = keyBy(localListingFiltered, 'relname')
  const localFiles = new Set(localListingFiltered.map(f => forceUnixRelname(f.relname))) // shape

  const unsupportedFilesFiltered = localListingFiltered.filter(f => !supportedFiletypes.has(path.extname(f.basename)))
  const unsupportedFilesSet = new Set(unsupportedFilesFiltered.map(f => forceUnixRelname(f.relname)))

  /** @type {Set<string>} */
  const protectedSet = new Set()

  ncFiles.forEach(ncFile => {
    if (protectedFileFilter(ncFile)) protectedSet.add(ncFile)
  })

  const localFilesWorkingSet = includeUnsupportedFiles
    ? localFiles // All local files, regardless of file support (neocities supporter only)
    : difference(localFiles, unsupportedFilesSet) // Only upload supported filetypes

  const filesToAdd = difference(localFilesWorkingSet, ncFiles)
  const filesToDeleteSet = difference(difference(ncFiles, localFilesWorkingSet), protectedSet)

  const maybeUpdate = intersection(localFilesWorkingSet, ncFiles)
  /** @type {Set<string>}  */
  const skipped = new Set()

  for (const p of maybeUpdate) {
    const local = localIndex[p]
    const remote = ncIndex[p]

    if (!local) throw new Error(`Missing local file stats for ${p}`)
    if (!remote) throw new Error(`Missing remote file stats for ${p}`)

    if (local.stat.size !== remote.size) { filesToAdd.add(p); continue }

    const localSha1 = await sha1FromPath(local.filepath)
    if (localSha1 !== remote.sha1_hash) { filesToAdd.add(p); continue }

    skipped.add(p)
  }

  const filesToUpload = Array.from(filesToAdd).map(p => {
    const localFile = localIndex[p]
    if (!localFile) throw new Error(`Unable to lookup localFile for upload ${p}`)
    return /** @type {FileUpload} */({
      name: forceUnixRelname(localFile.relname),
      path: localFile.filepath
    })
  })

  const filesToDelete = Array.from(filesToDeleteSet).map(p => {
    const neocitiesFile = ncIndex[p]
    if (!neocitiesFile) throw new Error(`Error looking up neocities file ${p}`)
    return neocitiesFile.path
  })

  const filesSkipped = Array.from(skipped).map(p => {
    const localSkipFile = localIndex[p]
    if (!localSkipFile) throw new Error(`Error looking up localSkipFile ${p}`)
    return localSkipFile.relname
  })

  const protectedFiles = Array.from(protectedSet).map(p => {
    const protectedFile = ncIndex[p]
    if (!protectedFile) throw new Error(`Error looking up protected file ${p}`)
    return protectedFile.path
  })

  const unsupportedFiles = Array.from(unsupportedFilesSet).map(p => {
    const unsupportedFile = localIndex[p]
    if (!unsupportedFile) throw new Error(`Error looking up unsupportedFile file ${p}`)
    return unsupportedFile.relname
  })

  return {
    filesToUpload,
    filesToDelete,
    filesSkipped,
    protectedFiles,
    unsupportedFiles
  }
}

/**
 * sha1FromPath returns a sha1 hex from a path
 * @param  {string} p string of the path of the file to hash
 * @return {Promise<string>}   the hex representation of the sha1
 */
async function sha1FromPath (p) {
  const rs = fs.createReadStream(p)
  const hash = crypto.createHash('sha1')

  await pipeline(rs, hash)

  return hash.digest('hex')
}

/**
 * Computes the difference between two sets (setA \ setB).
 *
 * @template T
 * @param {Set<T>} setA - The left-hand side set.
 * @param {Set<T>} setB - The right-hand side set.
 * @returns {Set<T>} - A new set containing the elements in setA that are not in setB.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#Implementing_basic_set_operations|MDN: Implementing basic set operations}
 */
function difference (setA, setB) {
  const _difference = new Set(setA)
  for (const elem of setB) {
    _difference.delete(elem)
  }
  return _difference
}

/**
 * Computes the intersection of two sets (setA ∩ setB).
 *
 * @template T
 * @param {Set<T>} setA - The left-hand side set.
 * @param {Set<T>} setB - The right-hand side set.
 * @returns {Set<T>} - A new set containing the elements that are in both setA and setB.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#Implementing_basic_set_operations|MDN: Implementing basic set operations}
 */
function intersection (setA, setB) {
  const _intersection = new Set()
  for (const elem of setB) {
    if (setA.has(elem)) {
      _intersection.add(elem)
    }
  }
  return _intersection
}

/**
 * forceUnixRelname forces a OS dependent path to a unix style path.
 * @param  {String} relname String path to convert to unix style.
 * @return {String}      The unix variant of the path
 */
function forceUnixRelname (relname) {
  return relname.split(path.sep).join('/')
}
