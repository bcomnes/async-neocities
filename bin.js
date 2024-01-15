#!/usr/bin/env node
/* eslint-disable dot-notation */

import { parseArgs } from 'node:util'
import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import readline from 'node:readline'
import { minimatch } from 'minimatch'
import { NeocitiesAPIClient } from './index.js'
import { stackWithCauses } from 'pony-cause'
import { format } from '@lukeed/ms'
import createApplicationConfig from 'application-config'
import { printHelpText } from 'argsclopts'
import { pkg } from './pkg.cjs'
// @ts-ignore
import passwordPrompt from 'password-prompt'

/**
 * @typedef {import('argsclopts').ArgscloptsParseArgsOptionsConfig} ArgscloptsParseArgsOptionsConfig
 */

/** @type {ArgscloptsParseArgsOptionsConfig} */
const options = {
  help: {
    type: 'boolean',
    short: 'h',
    help: 'print help text'
  },
  src: {
    type: 'string',
    short: 's',
    default: 'public',
    help: 'The directory to deploy to neocities'
  },
  cleanup: {
    type: 'boolean',
    short: 'c',
    default: false,
    help: 'Destructively clean up orphaned files on neocities'
  },
  protect: {
    type: 'string',
    short: 'p',
    help: 'String to minimatch files which will never be cleaned up'
  },
  status: {
    type: 'boolean',
    help: 'Print auth status of current working directory'
  },
  'print-key': {
    type: 'boolean',
    help: 'Print api-key status of current working directory'
  },
  'clear-key': {
    type: 'boolean',
    help: 'Remove the currently assoicated API key'
  },
  'force-auth': {
    type: 'boolean',
    help: 'Force re-authorization of current working directory'
  }
}

const cfg = createApplicationConfig(pkg.name)

const args = parseArgs({ options })

if (args.values['version']) {
  console.log(pkg.version)
  process.exit(0)
}

if (args.values['help']) {
  await printHelpText({
    options,
    name: pkg.name,
    version: pkg.version,
    exampleFn: ({ name }) => '    ' + `Example: ${name} --src public\n`
  })

  process.exit(0)
}

if (args.values['status']) {
  try {
    const siteName = await getSiteName()
    if (!siteName) {
      console.log('No site configuration found')
      process.exit(0)
    }
    console.log(`Site name: ${siteName}`)

    const apiKey = await getAPIKey(siteName)
    if (apiKey) {
      console.log('Auth status: API key Found')
    } else {
      console.log('Auth status: No API key found')
    }

    process.exit(0)
  } catch (err) {
    console.error(new Error('Error reading the status of the current working directory'), {
      cause: err
    })
    process.exit(1)
  }
}

if (args.values['print-key']) {
  try {
    const siteName = await getSiteName()

    if (!siteName) {
      console.error('No site is configured for this directory')
      process.exit(0)
    }

    const apiKey = await getAPIKey(siteName)
    console.log('API Key:')
    console.log(apiKey)
    process.exit(0)
  } catch (err) {
    console.error(new Error('Error while printing the key'), {
      cause: err
    })
    process.exit(1)
  }
}

if (args.values['clear-key']) {
  try {
    const siteName = await getSiteName()

    if (!siteName) {
      console.error('No site is configured for this directory')
      process.exit(0)
    }

    const apiKey = await getAPIKey(siteName)
    if (!apiKey) {
      console.log('No api key found to clear')
      process.exit(0)
    }

    // Save the API key in the config store
    const configData = /** @type {*} */ (await cfg.read())
    delete configData[siteName]
    await cfg.write(configData)
    console.log(`API Key cleared for ${siteName}`)

    process.exit(0)
  } catch (err) {
    console.error(new Error('Error while clearing the key'), {
      cause: err
    })
    process.exit(1)
  }
}

const src = args.values['src']
const cleanup = Boolean(args.values['cleanup'])
const protectedFiles = String(args.values['protect'])
const forceAuth = Boolean(args.values['force-auth'])

async function main () {
  const cwd = process.cwd()
  let siteName = await getSiteName(cwd)
  let apiKey

  // Check if siteName is in the config
  if (siteName) {
    console.log(`Found siteName in config: ${siteName}`)
  } else {
    // Config file not found or siteName is missing
    console.log('deploy-to-neocities.json not found or siteName is missing.')
    console.log('Please enter siteName:')

    // Setup readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    // Ask user for siteName
    siteName = await new Promise((resolve) => {
      rl.question('Enter siteName: ', (input) => {
        rl.close()
        resolve(input)
      })
    })

    if (!siteName) {
      console.log('You must provide a valid neocities site name!')
      process.exit(1)
    }

    // Save the siteName into deploy-to-neocities.json
    await fs.writeFile(join(cwd, 'deploy-to-neocities.json'), JSON.stringify({ siteName }), 'utf8')
    console.log(`siteName saved: ${siteName}`)
  }

  // Check if the API key is in the config store
  apiKey = await getAPIKey(siteName)

  if (apiKey && !forceAuth) {
    console.log(`API Key found for ${siteName}`)
  } else {
    console.log(`API Key not found for ${siteName}. Please enter your Neocities password:`)

    // Ask user for Neocities password
    // Ask user for password
    const password = await passwordPrompt('Enter Neocities password: ')

    if (!password) {
      console.log('You must provide a valid password')
      process.exit(1)
    }

    /// Use the async-neocities package to get the API keys
    const newApiKey = await NeocitiesAPIClient.getKey(siteName, password)
    if (!newApiKey) {
      console.log('The API did not return an API key for some reason.')
      process.exit(1)
    }
    apiKey = newApiKey

    // Save the API key in the config store
    const configData = /** @type {*} */ (await cfg.read())
    configData[siteName] = apiKey
    await cfg.write(configData)
    console.log(`API Key saved for ${siteName}`)
  }

  assert(apiKey, 'An API key is required to proceed')
  assert(typeof src === 'string', 'a string src is required')
  const distDir = join(cwd, src)

  const stat = await fs.stat(distDir)
  assert(stat.isDirectory(), 'dist_dir must be a directory that exists')

  const client = new NeocitiesAPIClient(apiKey)

  const deployOpts = {
    cleanup,
    statsCb: NeocitiesAPIClient.statsHandler(),
    protectedFileFilter: minimatch.filter(protectedFiles)
  }

  const stats = await client.deploy(distDir, deployOpts)

  console.log(`Deployed to Neocities in ${format(stats.time)}:`)
  console.log(`    Uploaded ${stats.filesToUpload.length} files`)
  console.log(`    ${cleanup ? 'Deleted' : 'Orphaned'} ${stats.filesToDelete.length} files`)
  console.log(`    Skipped ${stats.filesSkipped.length} files`)
  console.log(`    ${stats.protectedFiles.length} protected files:`)
  if (stats.protectedFiles.length) {
    console.log(stats.protectedFiles)
  }
}

// Run the main function with top-level await
await main().catch(err => {
  console.error(stackWithCauses(err))
  if (err.stats) {
    console.log('Files to upload: ')
    console.dir(err.stats.filesToUpload, { colors: true, depth: 999 })

    if (cleanup) {
      console.log('Files to delete: ')
      console.dir(err.stats.filesToDelete, { colors: true, depth: 999 })
    }
  }

  process.exit(1)
})

/**
 * Get the siteName from deploy-to-neocities.json in cwd, or from ASYNC_NEOCITIES_SITE_NAME env var
 * @param  {string} cwd
 * @return {Promise<string|undefined>}
 */
async function getSiteName (cwd = process.cwd()) {
  let siteName = process.env['ASYNC_NEOCITIES_SITE_NAME']
  if (siteName) return siteName
  try {
    const configFile = await fs.readFile(join(cwd, 'deploy-to-neocities.json'), 'utf8')
    const config = JSON.parse(configFile)
    siteName = config?.siteName
  } catch (err) {
    // swallow errors
  }

  return siteName
}

/**
 * Get an API key from the ENV or config given a provided siteName
 * @param  {string} siteName
 * @return {Promise<string|undefined>}
 */
async function getAPIKey (siteName) {
  const envKey = process.env['ASYNC_NEOCITIES_API_KEY'] || process.env['NEOCITIES_API_TOKEN']
  if (envKey) return envKey
  if (!siteName) throw new Error('A siteName is required to look up an API key if no ENV key is provided')
  // Receive the data as unknown
  const rawData = await cfg.read()

  /** @type {{ [siteName: string]: string }} */
  const configData = /** @type {*} */ (rawData)
  return configData?.[siteName]
}
