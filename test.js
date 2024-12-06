import test from 'node:test'
import assert from 'node:assert'
import { resolve } from 'node:path'
import { NeocitiesAPIClient } from './index.js'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = import.meta.dirname

let token = process.env['NEOCITIES_API_TOKEN']
let fakeToken = false

if (!token) {
  console.warn('error loading .env file. Don\'t forget to pass node --env-file-if-exists=.env')
  console.warn('using fake token, live tests disabled')
  fakeToken = true
  token = '123456'
}

test('basic client api', async _t => {
  const client = new NeocitiesAPIClient(token)

  assert.ok(client.info, 'info method available')
  assert.ok(client.list, 'list method available')
  assert.ok(client.upload, 'upload method available')
  assert.ok(client.delete, 'delete method available')
  assert.ok(client.deploy, 'deploy method available')
})

if (!fakeToken) {
  test('can get info about site', async _t => {
    const client = new NeocitiesAPIClient(token)

    const info = await client.info()
    assert.strictEqual(info.result, 'success', 'info request successful')
    const list = await client.list()
    assert.strictEqual(list.result, 'success', 'list result successful')
  })

  // test('form data works the way I think', t => {
  //   const form = new FormData();
  //   const p = resolve(__dirname, 'package.json');
  //   form.append('package.json', next => next(createReadStream(p)));
  //
  //   const concatStream = concat((data) => {
  //     console.log(data);
  //     t.end();
  //   });
  //
  //   form.on('error', (err) => {
  //     t.error(err);
  //   });
  //   form.pipe(concatStream);
  // });

  test('can upload and delete files', async _t => {
    const client = new NeocitiesAPIClient(token)

    const uploadResults = await client.upload([
      {
        name: 'toot.gif',
        path: resolve(__dirname, 'fixtures/toot.gif')
      },
      {
        name: 'img/tootzzz.png',
        path: resolve(__dirname, 'fixtures/tootzzz.png')
      }
    ])

    // console.dir({ uploadResults }, { depth: 999 })
    assert.strictEqual(uploadResults.results.length, 1, 'upload result have a success result')
    assert.strictEqual(uploadResults.results[0]?.body.result, 'success', 'upload result have a success result')
    assert.strictEqual(uploadResults.results[0]?.files.length, 2, 'The result batch has 2 files in it')
    assert.strictEqual(uploadResults.errors.length, 0, 'No errors occurred')

    const deleteResults = await client.delete([
      'toot.gif',
      'img/tootzzz.png'
    ])
    // console.log({ deleteResults })
    assert.strictEqual(deleteResults?.body.result, 'success', 'Delete result is successful')
  })

  test('can deploy folders', async _t => {
    const client = new NeocitiesAPIClient(token)

    const deployStats = await client.deploy({
      directory: resolve(__dirname, 'fixtures'),
      cleanup: false,
      uploadSort: (a, b) => a.name < b.name
        ? 1
        : a.name > b.name
          ? -1
          : 0
    })

    assert.ok(deployStats)

    // console.dir({ deployStats }, { depth: 99, colors: true })

    assert.strictEqual(deployStats.errors.length, 0, 'no errors!')
    assert.strictEqual(deployStats.results.length, 1, 'one upload batch')

    const redeployStats = await client.deploy({
      directory: resolve(__dirname, 'fixtures'),
      cleanup: false
    })

    assert.ok(redeployStats)
    assert.strictEqual(redeployStats.errors.length, 0, 'no errors!')
    assert.strictEqual(redeployStats.results.length, 0, 'noop all work skipped')

    // console.dir({ redeployStats }, { depth: 99, colors: true })

    const cleanupStats = await client.deploy({
      directory: resolve(__dirname, 'fixtures/empty'),
      cleanup: true
    })

    assert.ok(cleanupStats)

    assert.strictEqual(cleanupStats.errors.length, 0, 'no errors!')
    assert.strictEqual(cleanupStats.results.length, 2, '1 upload and 1 delete step')

    // console.dir({ cleanupStats }, { depth: 99, colors: true })

    const reCleanupStats = await client.deploy({
      directory: resolve(__dirname, 'fixtures/empty'),
      cleanup: true
    })

    assert.ok(reCleanupStats)
    assert.strictEqual(reCleanupStats.errors.length, 0, 'no errors!')
    assert.strictEqual(reCleanupStats.results.length, 0, 'noop all work skipped')
  })
}
