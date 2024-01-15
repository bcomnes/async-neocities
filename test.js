import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NeocitiesAPIClient } from './index.js'
import { statsHandler } from './lib/stats-handler.js'

const __dirname = import.meta.dirname

let token = process.env.NEOCITIES_API_TOKEN
let fakeToken = false

if (!token) {
  try {
    const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json')))
    token = config.token
    test('token loaded', async t => {
      assert.ok(token)
    })
  } catch (e) {
    console.warn('error loading config.json')
    console.warn('using fake token, live tests disabled')
    fakeToken = true
    token = '123456'
  }
}

test('basic client api', async t => {
  const client = new NeocitiesAPIClient(token)

  assert.ok(client.info, 'info method available')
  assert.ok(client.list, 'list method available')
  assert.ok(client.get, 'get method available')
  assert.ok(client.post, 'post method available')
})

if (!fakeToken) {
  test('can get info about site', async t => {
    const client = new NeocitiesAPIClient(token)

    const info = await client.info()
    // console.log(info)
    assert.equal(info.result, 'success', 'info requesst successfull')
    const list = await client.list()
    // console.log(list)
    assert.equal(list.result, 'success', 'list result successfull')
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

  test('can upload and delete files', async t => {
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

    // console.log(uploadResults[0])
    assert.equal(uploadResults[0].statusCode, 200, 'list result successfull')

    const deleteResults = await client.delete([
      'toot.gif',
      'img/tootzzz.png'
    ])
    // console.log(deleteResults)
    assert.equal(deleteResults.statusCode, 200, 'list result successfull')
  })

  test('can deploy folders', async t => {
    const client = new NeocitiesAPIClient(token)

    const deployStats = await client.deploy(
      resolve(__dirname, 'fixtures'),
      {
        statsCb: statsHandler(),
        cleanup: false
      }
    )

    assert.ok(deployStats)

    // console.dir(deployStats, { depth: 99, colors: true })

    const redeployStats = await client.deploy(
      resolve(__dirname, 'fixtures'),
      {
        statsCb: statsHandler(),
        cleanup: false
      }
    )

    assert.ok(redeployStats)

    // console.dir(redeployStats, { depth: 99, colors: true })

    const cleanupStats = await client.deploy(
      resolve(__dirname, 'fixtures/empty'),
      {
        statsCb: statsHandler(),
        cleanup: true
      }
    )

    assert.ok(cleanupStats)

    // console.dir(cleanupStats, { depth: 99, colors: true })
  })
}
