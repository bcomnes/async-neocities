/**
 * @import { Dispatcher } from 'undici'
 * @import { MessageResult, SiteFileList, SiteInfo, ApiKeyResponse, FileUpload } from './neocities.js'
 * @import { AsyncNeocitiesDiff } from './folder-diff.js'
 */
import afw from 'async-folder-walker'
import os from 'node:os'
import { request } from 'undici'
import { pkg } from '../pkg.cjs'
import { alwaysIgnore } from './always-ignore.js'
import { createFileForm, createForm } from './create-form.js'
import { chunk } from './chunk.js'
import { neocitiesLocalDiff } from './folder-diff.js'

const NEOCITIES_URL = 'https://neocities.org'

/**
 * Get an API for a neocities website.
 *
 * @param  {object} params
 * @param  {string} params.siteName  The name of the website on neocities.
 * @param  {string[]} params.ownerPassword   The user password to the owning user of the siteName.
 * @return {Promise<ApiKeyResponse>}
 */
export async function getApiKey ({
  siteName,
  ownerPassword
}) {
  const requestUrl = new URL('/api/key', NEOCITIES_URL)

  const response = await request(requestUrl, {
    headers: {
      ...defaultHeaders(),
      Authorization: `Basic ${btoa(siteName + ':' + ownerPassword)}`
    }
  })

  await handleBadResponse(response)

  /** @type {any} */
  const rawResponse = await response.body.json()
  const responseBody = /** @type {ApiKeyResponse} */ (rawResponse)

  return responseBody
}

/**
 * @typedef {{
 *           type: 'uploadResult'
 *           body: MessageResult,
 *           files: FileUpload[]
 *    }} UploadResult
 */

/**
 * @typedef {{
 *         errors: Array<Error>,
 *         results: Array<UploadResult>}} UploadResults
 */

/**
 * Upload files to a neocities website.
 *
 * @param  {object} params
 * @param  {string} params.apiKey  The api token tied to the site you want to delete files from.
 * @param  {FileUpload[]} params.files   Array of file details. Name is the unix path desired on neocities. Path is the local path to the file on disk.
 * @return {Promise<UploadResults>
 * }>}
 */
export async function uploadSiteFiles ({
  apiKey,
  files
}) {
  /** @type {Array<UploadResult>} */
  const results = []
  /** @type {Array<Error>} Array of errors encountered when uploading files */
  const errors = []

  const fileBatches = chunk(files, 20)

  const requestUrl = new URL('/api/upload', NEOCITIES_URL)

  for (const fileBatch of fileBatches) {
    try {
      const form = createFileForm(fileBatch)
      const response = await request(requestUrl, {
        method: 'POST',
        body: form,
        headers: {
          ...defaultAuthHeaders({ apiKey }),
          ...form.getHeaders()
        },
      })

      await handleBadResponse(response, { fileBatch })

      const rawResponse = await response.body.json()
      const responseBody = /** @type {MessageResult} */ (rawResponse)
      results.push({
        type: 'uploadResult',
        body: responseBody,
        files: fileBatch
      })
    } catch (err) {
      errors.push(new Error('async-neocities upload error', { cause: err }))
    }
  }

  return {
    results,
    errors,
  }
}

/**
 * Preview a directory deploy to neocities. Performs the content diff without modifying anything.
 * @param  {object}   options
 * @param  {string}   options.directory   The path to the directory preview deploy.
 * @param  {string}  options.apiKey     The API token of the neocities website to deploy to
 * @param  {boolean}  [options.includeUnsupportedFiles=false]     Set to true to bypass file type restrictions.
 * @param  {(path: string) => boolean} [options.protectedFileFilter] A filter function to filter out file you want to ignore.
 * @param  {Comparator<FileUpload>} [options.uploadSort] A sort function that lets you sort file upload order prior to uploading.
 * @return {Promise<AsyncNeocitiesDiff>}
 */
export async function previewDeployToNeocities ({
  directory,
  apiKey,
  includeUnsupportedFiles = false,
  protectedFileFilter,
  uploadSort
}) {
  const [localListing, neocitiesFiles] = await Promise.all([
    afw.allFiles(directory, {
      shaper: f => f,
      ignore: [
        ...alwaysIgnore
      ]
    }),
    listFilesForSite({ apiKey }).then(res => res.files)
  ])

  const diff = await neocitiesLocalDiff({
    neocitiesFiles,
    localListing,
    protectedFileFilter,
    includeUnsupportedFiles
  })

  if (typeof uploadSort === 'function') {
    diff.filesToUpload.sort(uploadSort)
  }

  return diff
}

/**
 * @typedef {UploadResult | DeleteResult} DeployResult
 */

/**
 * @typedef {{
 *           results: DeployResult[]
 *           errors: Error[],
 *           diff: AsyncNeocitiesDiff
 *    }} DeployResults
 */

/**
  * A generic comparator function type.
  *
  * @template T
  * @typedef {(a: T, b: T) => number} Comparator
  */

/**
 * Deploy a directory to neocities
 * @param  {object}   options
 * @param  {string}   options.directory   The path to the directory deploy.
 * @param  {string}  options.apiKey     The API token of the neocities website to deploy to
 * @param  {boolean}  [options.cleanup=false]     Set cleanup to true to delete orphaned file.
 * @param  {boolean}  [options.includeUnsupportedFiles=false]     Set to true to bypass file type restrictions.
 * @param  {(path: string) => boolean} [options.protectedFileFilter] A filter function to filter out file you want to ignore.
 * @param  {Comparator<FileUpload>} [options.uploadSort] A sort function that lets you sort file upload order prior to uploading.
 * @return {Promise<DeployResults>}
 */
export async function deployToNeocities ({
  directory,
  apiKey,
  cleanup = false,
  includeUnsupportedFiles = false,
  protectedFileFilter,
  uploadSort
}) {
  const diff = await previewDeployToNeocities({
    directory,
    apiKey,
    includeUnsupportedFiles,
    protectedFileFilter,
    uploadSort
  })

  const { filesToUpload, filesToDelete } = diff

  if (filesToUpload.length === 0 && (!cleanup || filesToDelete.length === 0)) {
    return {
      errors: [],
      results: [],
      diff
    }
  }

  /** @type {DeployResult[]} */
  const results = []
  /** @type {Array<Error>} */
  const errors = []

  const uploadResults = await uploadSiteFiles({
    apiKey,
    files: filesToUpload
  })

  results.push(...uploadResults.results)
  errors.push(...uploadResults.errors)

  if (cleanup && filesToDelete.length > 0) {
    try {
      const cleanupResult = await deleteSiteFiles({
        apiKey,
        fileNames: filesToDelete
      })
      results.push(cleanupResult)
    } catch (err) {
      errors.push(new Error('async-neocities deploy cleanup error', { cause: err }))
    }
  }

  return {
    results,
    errors,
    diff,
  }
}

/**
 * @typedef {{
 *           type: 'deleteResult'
 *           body: MessageResult,
 *           fileNames: string[]
 *    }} DeleteResult
 */

/**
 * Delete files from a neocities website.
 *
 * @param  {object} params
 * @param  {string} params.apiKey  The api token tied to the site you want to delete files from.
 * @param  {string[]} params.fileNames   Array of file paths on the neocities website to delete.
 * @return {Promise<DeleteResult>}
 */
export async function deleteSiteFiles ({
  apiKey,
  fileNames
}) {
  const formEntries = fileNames.map(file => ({
    name: 'filenames[]',
    value: file
  }))

  const form = createForm(formEntries)

  const requestUrl = new URL('/api/delete', NEOCITIES_URL)

  const response = await request(requestUrl, {
    method: 'POST',
    headers: {
      ...defaultAuthHeaders({ apiKey }),
      ...form.getHeaders()
    },
    body: form
  })

  await handleBadResponse(response, { fileNames })

  /** @type {any} */
  const rawResponse = await response.body.json()
  const responseBody = /** @type {MessageResult} */ (rawResponse)

  return {
    type: 'deleteResult',
    body: responseBody,
    fileNames
  }
}

/**
 * Return info about a neocities site.
 * @param  {object} options
 * @param  {string} options.apiKey    The API token to request with
 * @param  {string} [options.path]    Only list files for a given path
 * @return {Promise<SiteFileList>} The fetched site info
 */
export async function listFilesForSite ({
  apiKey,
  path
}) {
  const requestUrl = new URL('/api/list', NEOCITIES_URL)
  if (path) requestUrl.searchParams.set('path', path)

  const response = await request(requestUrl, {
    method: 'GET',
    headers: defaultAuthHeaders({ apiKey })
  })

  await handleBadResponse(response, { path })

  /** @type {any} */
  const rawResponse = await response.body.json()
  const responseBody = /** @type {SiteFileList} */ (rawResponse)

  return responseBody
}

/**
 * Return info about a neocities site.
 * @param  {object} options
 * @param  {string} options.apiKey    The API token to request with
 * @param  {string} [options.siteName]  Retrieve info on a specific website. Returns info on the token context when omitted.
 * @return {Promise<SiteInfo>} The fetched site info
 */
export async function getInfo ({
  apiKey,
  siteName
}) {
  const requestUrl = new URL('/api/info', NEOCITIES_URL)
  if (siteName) requestUrl.searchParams.set('sitename', siteName)

  const response = await request(requestUrl, {
    method: 'GET',
    headers: defaultAuthHeaders({ apiKey })
  })

  await handleBadResponse(response, { siteName })

  /** @type {any} */
  const rawResponse = await response.body.json()
  const responseBody = /** @type {SiteInfo} */ (rawResponse)

  return responseBody
}

function defaultHeaders () {
  return {
    Accept: 'application/json',
    'User-Agent': `async-neocities/${pkg.version} (${os.type()})`
  }
}

/**
 * @param  {object} params
 * @param  {string} params.apiKey
 */
function defaultAuthHeaders ({ apiKey }) {
  return {
    ...defaultHeaders(),
    Authorization: `Bearer ${apiKey}`,
  }
}

/**
 * @param  {Dispatcher.ResponseData} response
 * @param  {any} [extra]
 */
async function handleBadResponse (response, extra) {
  if (response.statusCode > 299) {
    const contentTypeHeaders = response.headers['Content-Type']
    const contentType = Array.isArray(contentTypeHeaders) ? contentTypeHeaders[0] : contentTypeHeaders
    const isJSON = contentType && contentType.match(/json/)
    /** @type { any } */
    const body = isJSON ? await response.body.json() : await response.body.text()
    throw new AsyncNeocitiesHTTPError(response, body, extra)
  }
}

class AsyncNeocitiesHTTPError extends Error {
  /** @type { number } */ statusCode
  /** @type {string | object } */ body
  /** @type {any} */ extra

  /**
   * @param  {Dispatcher.ResponseData} response A undici Response
   * @param  {string | object} body response body
   * @param  {any} [extra] any extra info to attach to the error
   */
  constructor (response, body, extra) {
    super('Unexpected response status code')
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)

    this.statusCode = response.statusCode
    this.body = body
    this.extra = extra
  }
}
