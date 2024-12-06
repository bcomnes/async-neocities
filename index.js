/**
 * @import { ApiKeyResponse, FileUpload } from './lib/neocities.js'
 * @import { AsyncNeocitiesDiff } from './lib/folder-diff.js'
 */

import * as Endpoints from './lib/api-endpoints.js'
export { supportedFiletypes } from './lib/supported-filetypes.js'
export { printDeployText, printPreviewText, printResultsErrorDump } from './lib/output-strings.js'
export { SimpleTimer } from './lib/timer.js'

/**
 * NeocitiesAPIClient class representing a neocities api client.
 */
export class NeocitiesAPIClient {
  /** @type {string} */ apiKey

  /**
   * Get an API for a neocities website.
   *
   * @param  {object} params
   * @param  {string} params.siteName  The name of the website on neocities.
   * @param  {string[]} params.ownerPassword   The user password to the owning user of the siteName.
   * @return {Promise<ApiKeyResponse>}
   */
  static async getKey (params) {
    return await Endpoints.getApiKey(params)
  }

  /**
   * Create an async-neocities api client.
   * @param  {string} apiKey                             An apiKey to make requests with.
   */
  constructor (apiKey) {
    this.apiKey = apiKey
  }

  /**
   * Upload files to neocities.
   *
   * @param  {FileUpload[]} files   Array of file details. Name is the unix path desired on neocities. Path is the local path to the file on disk.
   * @return {ReturnType<typeof Endpoints.uploadSiteFiles>}
   */
  async upload (files) {
    const { apiKey } = this
    return await Endpoints.uploadSiteFiles({
      apiKey,
      files
    })
  }

  /**
   * Delete files from your neocities website.
   *
   * @param  {string[]} fileNames   Array of neocities file paths to delete.
   * @return {ReturnType<typeof Endpoints.deleteSiteFiles>}
   */
  async delete (fileNames) {
    const { apiKey } = this
    return await Endpoints.deleteSiteFiles({
      apiKey,
      fileNames
    })
  }

  /**
   * Return info about a neocities site.
   *
   * @param  {string} [path]   Only list files for a given path
   * @return {ReturnType<typeof Endpoints.listFilesForSite>}
   */
  async list (path) {
    const { apiKey } = this
    return await Endpoints.listFilesForSite({
      apiKey,
      path
    })
  }

  /**
   * Return info about a neocities site.
   * @param  {string} [siteName]    Returns info on the token context when omitted.
   * @return {ReturnType<typeof Endpoints.getInfo>} The fetched site info
   */
  async info (siteName) {
    const { apiKey } = this
    return await Endpoints.getInfo({
      apiKey,
      siteName
    })
  }

  /**
   * Deploy a directory to neocities
   * @param  {object}   options
   * @param  {string}   options.directory   The path to the directory deploy.
   * @param  {boolean}  [options.cleanup=false]     Set cleanup to true to delete orphaned file.
   * @param  {boolean}  [options.includeUnsupportedFiles=false]     Set to true to bypass file type restrictions.
   * @param  {(path: string) => boolean} [options.protectedFileFilter] A filter function to filter out file you want to ignore.
   * @param  {Endpoints.Comparator<FileUpload>} [options.uploadSort] A sort function that lets you sort file upload order prior to uploading. FileUpload.name is probably what you want to sort by.
   * @return {ReturnType<typeof Endpoints.deployToNeocities>} The fetched site info
   */
  async deploy (options) {
    const { apiKey } = this
    return await Endpoints.deployToNeocities({
      apiKey,
      ...options
    })
  }

  /**
   * Preview a directory deploy to neocities. Performs the content diff without modifying anything.
   * @param  {object}   options
   * @param  {string}   options.directory   The path to the directory preview deploy.
   * @param  {boolean}  [options.includeUnsupportedFiles=false]     Set to true to bypass file type restrictions.
   * @param  {(path: string) => boolean} [options.protectedFileFilter] A filter function to filter out file you want to ignore.
   * @param  {Endpoints.Comparator<FileUpload>} [options.uploadSort] A sort function that lets you sort file upload order prior to uploading. FileUpload.name is probably what you want to sort by.
   * @return {Promise<AsyncNeocitiesDiff>}
   */
  async previewDeploy (options) {
    const { apiKey } = this
    return await Endpoints.previewDeployToNeocities({
      apiKey,
      ...options
    })
  }
}
