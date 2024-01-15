import tap from 'tap'

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
    tap.test('token loaded', async t => {
      t.ok(token)
    })
  } catch (e) {
    console.warn('error loading config.json')
    console.warn('using fake token, live tests disabled')
    fakeToken = true
    token = '123456'
  }
}

tap.test('basic client api', async t => {
  const client = new NeocitiesAPIClient(token)

  t.ok(client.info, 'info method available')
  t.ok(client.list, 'list method available')
  t.ok(client.get, 'get method available')
  t.ok(client.post, 'post method available')
})

if (!fakeToken) {
  tap.test('can get info about site', async t => {
    const client = new NeocitiesAPIClient(token)

    const info = await client.info()
    // console.log(info)
    t.equal(info.result, 'success', 'info requesst successfull')
    const list = await client.list()
    // console.log(list)
    t.equal(list.result, 'success', 'list result successfull')
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

  tap.test('can upload and delete files', async t => {
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
    t.equal(uploadResults[0].statusCode, 200, 'list result successfull')

    const deleteResults = await client.delete([
      'toot.gif',
      'img/tootzzz.png'
    ])
    // console.log(deleteResults)
    t.equal(deleteResults.statusCode, 200, 'list result successfull')
  })

  tap.test('can deploy folders', async t => {
    const client = new NeocitiesAPIClient(token)

    const deployStats = await client.deploy(
      resolve(__dirname, 'fixtures'),
      {
        statsCb: statsHandler(),
        cleanup: false
      }
    )

    t.ok(deployStats)

    // console.dir(deployStats, { depth: 99, colors: true })

    const redeployStats = await client.deploy(
      resolve(__dirname, 'fixtures'),
      {
        statsCb: statsHandler(),
        cleanup: false
      }
    )

    t.ok(redeployStats)

    // console.dir(redeployStats, { depth: 99, colors: true })

    const cleanupStats = await client.deploy(
      resolve(__dirname, 'fixtures/empty'),
      {
        statsCb: statsHandler(),
        cleanup: true
      }
    )

    t.ok(cleanupStats)

    // console.dir(cleanupStats, { depth: 99, colors: true })
  })
}
