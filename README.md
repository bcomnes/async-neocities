# async-neocities
[![Actions Status](https://github.com/bcomnes/async-neocities/workflows/tests/badge.svg)](https://github.com/bcomnes/async-neocities/actions)

An api client for [neocities][nc] with an async/promise API and an efficient deploy algorithm.

<center><img src="logo.jpg"></center>

Now available as a Github Action: [deploy-to-neocities](https://github.com/marketplace/actions/deploy-to-neocities)

```console
npm install async-neocities
```

## Usage

``` js
const path = require('path')
const Neocities = require('async-neocities')

async function deploySite () {
  const token = await Neocities.getKey('sitename', 'password')

  const client = new Neocities(token)

  console.log(await client.list()) // site files
  console.log(await client.info()) // site info

  return client.deploy(path.join(__dirname, './site-contents'))
}

deploySite.then(info => { console.log('done deploying site!') })
  .catch(e => { throw e })
```

## API

### `Neocities = require('async-neocities')`

Import the Neocities API client.

### `apiKey = await Neocities.getKey(sitename, password, [opts])`

Static class method that will get an API Key from a sitename and password.

`opts` include:

```js
{
  url: 'https://neocities.org' // Base URL to use for requests
}
```

### `client = new Neocities(apiKey, [opts])`

Create a new API client for a given API key.

`opts` include:

```js
{
  url: 'https://neocities.org' // Base URL to use for requests
}
```

### `response = await client.upload(files, opts)`

Pass an array of objects with the `{ name, path }` pair to upload these files to neocities, where `name` is desired remote unix path on neocities and `path` is the local path on disk in whichever format the local operating system desires.
When a large nunber of files are passed, the request is batched into `opts.batchSize` requests.

Opts are passed through to `client.batchPost`.

A successful `response` is the array of request results:

```js
[{
  result: 'success',
  message: 'your file(s) have been successfully uploaded'
}]
```

### `response = await client.delete(filenames)`

Pass an array of path strings to delete on neocities.  The path strings should be the unix style path of the file you want to delete.

A successful `response`:

```js
{ result: 'success', message: 'file(s) have been deleted' }
```

### `response = await client.list([queries])`

Get a list of files for your site.  The optional `queries` object is passed through Node's [querystring][querystring] and added to the request.

Available queries:

```js
{
  path // list the contents of a subdirectory on neocities
}
```

Example `responses`:

```json
{
  "result": "success",
  "files": [
    {
      "path": "index.html",
      "is_directory": false,
      "size": 1023,
      "updated_at": "Sat, 13 Feb 2016 03:04:00 -0000",
      "sha1_hash": "c8aac06f343c962a24a7eb111aad739ff48b7fb1"
    },
    {
      "path": "not_found.html",
      "is_directory": false,
      "size": 271,
      "updated_at": "Sat, 13 Feb 2016 03:04:00 -0000",
      "sha1_hash": "cfdf0bda2557c322be78302da23c32fec72ffc0b"
    },
    {
      "path": "images",
      "is_directory": true,
      "updated_at": "Sat, 13 Feb 2016 03:04:00 -0000"
    },
    {
      "path": "images/cat.png",
      "is_directory": false,
      "size": 16793,
      "updated_at": "Sat, 13 Feb 2016 03:04:00 -0000",
      "sha1_hash": "41fe08fc0dd44e79f799d03ece903e62be25dc7d"
    }
  ]
}
```

With the `path` query:

```json
{
  "result": "success",
  "files": [
    {
      "path": "images/cat.png",
      "is_directory": false,
      "size": 16793,
      "updated_at": "Sat, 13 Feb 2016 03:04:00 -0000",
      "sha1_hash": "41fe08fc0dd44e79f799d03ece903e62be25dc7d"
    }
  ]
}
```

### `response = await client.info([queries])`

Get info about your or other sites.  The optional `queries` object is passed through [querystring][querystring] and added to the request.

Available queries:

```js
{
  sitename // get info on a given sitename
}
```

Example `responses`:

```json
{
  "result": "success",
  "info": {
    "sitename": "youpi",
    "hits": 5072,
    "created_at": "Sat, 29 Jun 2013 10:11:38 +0000",
    "last_updated": "Tue, 23 Jul 2013 20:04:03 +0000",
    "domain": null,
    "tags": []
  }
}
```

### `stats = await client.deploy(directory, [opts])`

Deploy a path to a `directory`, efficiently only uploading missing and changed files.  Files are determined to be different by size, and sha1 hash, if the size is the same.

`opts` include:

```js
{
  cleanup: false, // delete orphaned files on neocities that are not in the `directory`
  statsCb: (stats) => {},
  batchSize: 50, // number of files to upload per request,
  protectedFileFilter: path => false // a function that is passed neocities file paths.  When it returns true, that path will never be cleaned up when cleanup is set to true.
}
```

For an example of a stats handler, see [lib/stats-handler.js](lib/stats-handler.js).

### `client.get(endpoint, [quieries], [opts])`

Low level GET request to a given `endpoint`.

**NOTE**: The `/api/` prefix is automatically added: `/api/${endpoint}` so that must be omitted from `endpoint`.

The optional `queries` object is stringified to a querystring using [`querystring`][querystring]a and added to the request.

`opts` includes:

```js
{
  method: 'GET',
  headers: { ...client.defaultHeaders, ...opts.headers },
}
```

Note, that `opts` is passed internally to [`node-fetch`][nf] and you can include any options that work for that client here.

### `client.post(endpoint, formEntries, [opts])`

Low level POST request to a given `endpoint`.

**NOTE**: The `/api/` prefix is automatically adeded: `/api/${endpoint}` so that must be omitted from `endpoint.

Pass a `formEntries` array or iterator containing objects with `{name, value}` pairs to be sent with the POST request as [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).  The [form-datat][fd] module is used internally.

`opts` include:

```js
{
  method: 'POST',
  body: new FormData(), // Don't override this.
  headers: { ...client.defafultHeaders, ...formHeaders, opts.headers }
}
```

Note, that `opts` is passed internally to [`node-fetch`][nf] and you can include any options that work for that client here.

### `client.post(endpoint, formEntries, [opts])`

Low level batched post request to a given endpoint. Same as `client.post`, except requests are batched into `opts.batchSize` requests.

## See also

- [Neocities API docs](https://neocities.org/api)
- [Official Node.js API client](https://github.com/neocities/neocities-node)
- [bcomnes/deploy-to-neocities](https://github.com/bcomnes/deploy-to-neocities) This module as an action.

## License

MIT

[querystring]: https://nodejs.org/api/querystring.html
[nf]: https://ghub.io/node-fetch
[fd]: https://ghub.io/form-data
[nc]: https://neocities.org
