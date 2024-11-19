/**
 * @typedef {{
 *  result: 'success',
 *  api_key: string
 * }} ApiKeyResponse
 *
 */

/**
 * @typedef {{
 *       result: 'success',
 *       files: {
 *           path: string
 *           is_directory: boolean
 *           size?: number
 *           updated_at: string
 *           sha1_hash?: string
 *       }[]
 * }} SiteFileList
 */

/**
 * @typedef {{
 *       result: 'success',
 *       info: {
 *           sitename: string
 *           hits: number
 *           created_at: string
 *           last_updated: string
 *           domain: string | null
 *           tags: string[]
 *       }
 * }} SiteInfo
 */

/**
 * @typedef {{
 *     result: 'success',
 *     message: string
 * }} MessageResult
 */

/**
 * @typedef {{
 *   name: string;
 *   path: string;
 * }} FileUpload
 */
