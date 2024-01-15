// Replace require with import statements
import { request, fetch } from 'undici'
import { handleResponse } from 'fetch-errors'
import { createReadStream } from 'fs'
import afw from 'async-folder-walker'
import assert from 'nanoassert'
import { URL } from 'url'
import qs from 'querystring'
import os from 'os'

// Use import for local files as well
import { neocitiesLocalDiff } from './lib/folder-diff.js'
import { readPackage } from 'read-pkg'
import { SimpleTimer } from './lib/timer.js'
import { getStreamsLength, getStreamLength, meterStream, captureStreamLength } from './lib/stream-meter.js'
import { statsHandler } from './lib/stats-handler.js'
import { createForm, createForms } from './lib/create-form.js'

const defaultURL = 'https://neocities.org'

const pkg = await readPackage({ cwd: import.meta.directory })

// Progress API constants
const START = 'start'
const PROGRESS = 'progress' // progress updates
const STOP = 'stop'
const SKIP = 'skip'
const ERROR = 'error'
// Progress stages
const INSPECTING = 'inspecting'
const DIFFING = 'diffing'
const APPLYING = 'applying'

/**
 * NeocitiesAPIClient class representing a neocities api client.
 */
export class NeocitiesAPIClient {
  /**
   * getKey returns an apiKey from a sitename and password.
   * @param  {String} sitename   username/sitename to log into.
   * @param  {String} password   password to log in with.
   * @param  {Object} [opts]     Options object.
   * @param  {Object} [opts.url=https://neocities.org]  Base URL to request to.
   * @return {Promise<String>}    An api key for the sitename..
   */
  static getKey (sitename, password, opts) {
    assert(sitename, 'must pass sitename as first arg')
    assert(typeof sitename === 'string', 'user arg must be a string')
    assert(password, 'must pass a password as the second arg')
    assert(typeof password, 'password arg must be a string')

    opts = Object.assign({
      url: defaultURL
    }, opts)

    const baseURL = opts.url
    delete opts.url

    const url = new URL('/api/key', baseURL)
    opts.headers = {
      Authorization: `Basic ${btoa(sitename + ':' + password)}`
    }
    return fetch(url, opts)
  }

  static statsHandler (...args) { return statsHandler(...args) }

  /**
   * Create an async-neocities api client.
   * @param  {string} apiKey                             An apiKey to make requests with.
   * @param  {Object} [opts]                             Options object.
   * @param  {Object} [opts.url=https://neocities.org]   Base URL to make requests to.
   * @return {Object}                                    An api client instance.
   */
  constructor (apiKey, opts) {
    assert(apiKey, 'must pass apiKey as first argument')
    assert(typeof apiKey === 'string', 'apiKey must be a string')
    opts = Object.assign({
      url: defaultURL
    })

    this.url = opts.url
    this.apiKey = apiKey
  }

  get defaultHeaders () {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': `async-neocities/${pkg.version} (${os.type()})`
    }
  }

  /**
   * Generic GET request to neocities.
   * @param  {String} endpoint An endpoint path to GET request.
   * @param  {Object} [quieries] An object that gets added to the request in the form of a query string.
   * @param  {Object} [opts] Options object.
   * @param  {String} [opts.method=GET] The http method to use.
   * @param  {Object} [opts.headers] Headers to include in the request.
   * @return {Object} The parsed JSON from the request response.
   */
  get (endpoint, quieries, opts) {
    assert(endpoint, 'must pass endpoint as first argument')
    opts = Object.assign({
      method: 'GET'
    }, opts)
    opts.headers = Object.assign({}, this.defaultHeaders, opts.headers)

    let path = `/api/${endpoint}`
    if (quieries) path += `?${qs.stringify(quieries)}`

    const url = new URL(path, this.url)
    return fetch(url, opts)
  }

  /**
   * Low level POST request to neocities with FormData.
   * @param  {String} endpoint    The endpoint to make the request to.
   * @param  {Array.<{name: String, value: String}>} formEntries Array of form entries.
   * @param  {Object} [opts]        Options object.
   * @param  {String} [opts.method=POST] HTTP Method.
   * @param  {Object} [opts.headers]  Additional headers to send.
   * @return {Object}             The parsed JSON response object.
   */
  async post (endpoint, formEntries, opts) {
    assert(endpoint, 'must pass endpoint as first argument')
    assert(formEntries, 'must pass formEntries as second argument')

    opts = Object.assign({
      method: 'POST',
      statsCb: () => {}
    }, opts)
    const statsCb = opts.statsCb
    delete opts.statsCb

    const stats = {
      totalBytes: await getStreamLength(createForm(formEntries)),
      bytesWritten: 0
    }
    statsCb(stats)

    const form = createForm(formEntries)

    opts.body = meterStream(form, bytesRead => {
      stats.bytesWritten = bytesRead
      statsCb(stats)
    })

    opts.headers = Object.assign(
      {},
      this.defaultHeaders,
      form.getHeaders(),
      opts.headers)

    const url = new URL(`/api/${endpoint}`, this.url)
    return request(url, opts)
  }

  /**
   * Batched POST requests.  When you have a large number of form entries, use this.
   * @param  {String} endpoint    The endpoint to make the request to.
   * @param  {Array.<{name: String, value: String}>} formEntries Array of form entries.
   * @param  {Object} [opts]        Options object.
   * @param  {String} [opts.method=POST] HTTP Method.
   * @param  {Object} [opts.headers]  Additional headers to send.
   * @param  {Integer} opts.batchSize The number of files to upload per request. Default to 50.
   * @return {Array.<Object>}         The array of successful request results.
   */
  async batchPost (endpoint, formEntries, opts) {
    assert(endpoint, 'must pass endpoint as first argument')
    assert(formEntries, 'must pass formEntries as second argument')

    opts = Object.assign({
      method: 'POST',
      statsCb: () => {},
      batchSize: 50
    }, opts)

    const statsCb = opts.statsCb
    delete opts.statsCb
    const batchSize = opts.batchSize
    delete opts.batchSize

    const stats = {
      totalBytes: await getStreamsLength(createForms(formEntries, batchSize)),
      bytesWritten: 0
    }

    statsCb(stats)

    const forms = createForms(formEntries, batchSize)
    const url = new URL(`/api/${endpoint}`, this.url)
    const results = []

    for (const form of forms) {
      const reqOpts = { ...opts }

      reqOpts.body = captureStreamLength(form, bytesRead => {
        stats.bytesWritten += bytesRead
        statsCb(stats)
      })

      reqOpts.headers = Object.assign(
        {},
        this.defaultHeaders,
        form.getHeaders(),
        reqOpts.headers
      )

      try {
        const result = await request(url, reqOpts)
        results.push(result)
      } catch (err) {
        const wrappedError = new Error('Neocities API error', {
          cause: err
        })
        wrappedError.results = results
        throw wrappedError
      } finally {
        statsCb({ stage: ERROR, status: STOP })
      }
    }

    return results
  }

  /**
   * Upload files to neocities
   */
  upload (files, opts = {}) {
    opts = {
      statsCb: () => {},
      ...opts
    }
    const formEntries = files.map(({ name, path }) => {
      const streamCtor = (next) => next(createReadStream(path))
      streamCtor.path = path
      return {
        name,
        value: streamCtor
      }
    })

    return this.batchPost('upload', formEntries, opts)
  }

  /**
   * delete files from your website
   */
  delete (filenames, opts = {}) {
    assert(filenames, 'filenames is a required first argument')
    assert(Array.isArray(filenames), 'filenames argument must be an array of file paths in your website')
    opts = {
      statsCb: () => {},
      ...opts
    }

    const formEntries = filenames.map(file => ({
      name: 'filenames[]',
      value: file
    }))

    return this.post('delete', formEntries, { statsCb: opts.statsCb })
  }

  list (queries) {
    // args.path: Path to list
    return this.get('list', queries).then(handleResponse)
  }

  /**
   * info returns info on your site, or optionally on a sitename querystrign
   * @param  {Object} args Querystring arguments to include (e.g. sitename)
   * @return {Promise} Fetch request promise
   */
  info (queries) {
    // args.sitename: sitename to get info on
    return this.get('info', queries).then(handleResponse)
  }

  /**
   * Deploy a directory to neocities, skipping already uploaded files and optionally cleaning orphaned files.
   * @param  {String} directory        The path of the directory to deploy.
   * @param  {Object} opts             Options object.
   * @param  {Boolean} opts.cleanup    Boolean to delete orphaned files nor not.  Defaults to false.
   * @param  {Boolean} opts.statsCb    Get access to stat info before uploading is complete.
   * @param  {Integer} opts.batchSize  The number of files to upload per request. Default to 50.
   * @param  {Function} opts.protected FileFilter A filter function that will prevent files from being cleaned up.
   * @return {Promise}                 Promise containing stats about the deploy
   */
  async deploy (directory, opts) {
    opts = {
      cleanup: false, // delete remote orphaned files
      statsCb: () => {},
      protectedFileFilter: (path) => false, // no protected files by default
      ...opts
    }

    const statsCb = opts.statsCb
    const totalTime = new SimpleTimer(Date.now())
    const { protectedFileFilter } = opts

    // INSPECTION STAGE
    statsCb({ stage: INSPECTING, status: START })
    const [localFiles, remoteFiles] = await Promise.all([
      afw.allFiles(directory, { shaper: f => f }),
      this.list().then(res => res.files)
    ])
    statsCb({ stage: INSPECTING, status: STOP })

    // DIFFING STAGE
    statsCb({ stage: DIFFING, status: START })
    const { filesToUpload, filesToDelete, filesSkipped, protectedFiles } = await neocitiesLocalDiff(remoteFiles, localFiles, { protectedFileFilter })
    statsCb({ stage: DIFFING, status: STOP })

    // APPLYING STAGE
    if (filesToUpload.length === 0 && (!opts.cleanup || filesToDelete.length === 0)) {
      statsCb({ stage: APPLYING, status: SKIP })
      return stats()
    }

    statsCb({ stage: APPLYING, status: START })
    const work = []

    if (filesToUpload.length > 0) {
      const uploadJob = this.upload(filesToUpload, {
        batchSize: opts.batchSize,
        statsCb ({ totalBytes, bytesWritten }) {
          statsCb({
            stage: APPLYING,
            status: PROGRESS,
            complete: false,
            totalBytes,
            bytesWritten,
            get progress () {
              return (this.bytesWritten / this.totalBytes) || 0
            }
          })
        }
      }).then((_) => {
        statsCb({
          stage: APPLYING,
          status: PROGRESS,
          complete: true,
          progress: 1.0
        })
      })
      work.push(uploadJob)
    }

    if (opts.cleanup && filesToDelete.length > 0) {
      work.push(this.delete(filesToDelete))
    }

    try {
      await Promise.all(work)
    } catch (err) {
      // Wrap error with stats so that we don't lose all that context
      const wrappedError = new Error('Error uploading files', {
        cause: err
      })
      wrappedError.stats = stats()
      throw wrappedError
    } finally {
      statsCb({ stage: ERROR, status: STOP })
    }

    return stats()

    function stats () {
      totalTime.stop()
      return {
        time: totalTime.elapsed,
        filesToUpload,
        filesToDelete,
        filesSkipped,
        protectedFiles
      }
    }
  }
}
