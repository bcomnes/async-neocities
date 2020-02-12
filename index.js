const { handleResponse } = require('fetch-errors')
const { createReadStream } = require('fs')
const afw = require('async-folder-walker')
const FormData = require('form-data')
const assert = require('nanoassert')
const fetch = require('node-fetch')
const { URL } = require('url')
const qs = require('qs')
const os = require('os')

const { neocitiesLocalDiff } = require('./lib/folder-diff')
const pkg = require('./package.json')

const defaultURL = 'https://neocities.org'

/**
 * NeocitiesAPIClient class representing a neocities api client.
 */
class NeocitiesAPIClient {
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
    url.username = sitename
    url.password = password
    return fetch(url, opts)
  }

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
  post (endpoint, formEntries, opts) {
    assert(endpoint, 'must pass endpoint as first argument')
    assert(formEntries, 'must pass formEntries as second argument')
    const form = new FormData()
    opts = Object.assign({
      method: 'POST',
      body: form
    }, opts)

    for (const { name, value } of formEntries) {
      form.append(name, value)
    }

    opts.headers = Object.assign(
      {},
      this.defaultHeaders,
      form.getHeaders(),
      opts.headers)

    const url = new URL(`/api/${endpoint}`, this.url)
    return fetch(url, opts)
  }

  /**
   * Upload files to neocities
   */
  upload (files) {
    const formEntries = files.map(({ name, path }) => {
      const streamCtor = (next) => next(createReadStream(path))
      streamCtor.path = path
      return {
        name,
        value: streamCtor
      }
    })

    return this.post('upload', formEntries).then(handleResponse)
  }

  /**
   * delete files from your website
   */
  delete (filenames) {
    assert(filenames, 'filenames is a required first argument')
    assert(Array.isArray(filenames), 'filenames argument must be an array of file paths in your website')

    const formEntries = filenames.map(file => ({
      name: 'filenames[]',
      value: file
    }))

    return this.post('delete', formEntries).then(handleResponse)
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
   * @param  {String} directory      The path of the directory to deploy.
   * @param  {Object} opts           Options object.
   * @param  {Boolean} opts.cleanup  Boolean to delete orphaned files nor not.  Defaults to false.
   * @param  {Boolean} opts.statsCb  Get access to stat info before uploading is complete.
   * @return {Promise}               Promise containing stats about the deploy
   */
  async deploy (directory, opts) {
    opts = {
      cleanup: false, // delete remote orphaned files
      statsCb: () => {},
      ...opts
    }

    const [localFiles, remoteFiles] = await Promise.all([
      afw.allFiles(directory, { shaper: f => f }),
      this.list()
    ])

    const { filesToUpload, filesToDelete, filesSkipped } = await neocitiesLocalDiff(remoteFiles.files, localFiles)
    opts.statsCb({ filesToUpload, filesToDelete, filesSkipped })
    const work = []
    if (filesToUpload.length > 0) work.push(this.upload(filesToUpload))
    if (opts.cleanup && filesToDelete.length > 0) { work.push(this.delete(filesToDelete)) }

    await Promise.all(work)

    return { filesToUpload, filesToDelete, filesSkipped }
  }
}

module.exports = NeocitiesAPIClient
