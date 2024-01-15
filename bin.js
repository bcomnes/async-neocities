#!/usr/bin/env node
/* eslint-disable dot-notation */

import { parseArgs } from 'node:util'
import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import readline from 'node:readline'
import Conf from 'conf'
import { minimatch } from 'minimatch'
import { NeocitiesAPIClient } from './index.js'
import { stackWithCauses } from 'pony-cause'
import { format } from '@lukeed/ms'
import { readPackage } from 'read-pkg'
import { createHash } from 'crypto'

const options = {
  help: {
    type: 'boolean',
    short: 'h'
  },
  src: {
    type: 'string',
    short: 's',
    default: 'public'
  },
  cleanup: {
    type: 'boolean',
    short: 'c',
    default: false
  },
  protect: {
    type: 'string',
    short: 'p'
  }
}

const pkg = await readPackage({ cwd: import.meta.directory })

const configStore = new Conf({ projectName: pkg.name })
const args = parseArgs({ options })

const src = args.values.src
const cleanup = args.values.cleanup
const protectedFiles = args.values.protect

async function main () {
  let siteName
  let apiKey

  try {
    // Try to read the config file
    const configFile = await fs.readFile('deploy-to-neocities.json', 'utf8')
    const config = JSON.parse(configFile)

    // Check if siteName is in the config
    if (config.siteName) {
      siteName = config.siteName
      console.log(`Found siteName in config: ${siteName}`)
    } else {
      throw new Error('siteName not found in config')
    }
  } catch (error) {
    // Config file not found or siteName is missing
    console.log('Config file not found or siteName is missing. Please enter siteName:')

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

    // Save the siteName into deploy-to-neocities.json
    await fs.writeFile('deploy-to-neocities.json', JSON.stringify({ siteName }), 'utf8')
    console.log(`siteName saved: ${siteName}`)
  }

  // Check if the API key is in the config store
  const keyPath = `keys.${hashKey(siteName)}.key`
  console.log(keyPath)
  if (configStore.has(keyPath)) {
    apiKey = configStore.get(keyPath)
    console.log(`API Key found for ${siteName}`)
  } else {
    console.log(`API Key not found for ${siteName}. Please enter your Neocities password:`)

    // Setup readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    // Ask user for Neocities password
    const password = await new Promise((resolve) => {
      rl.question('Enter Neocities password: ', (input) => {
        rl.close()
        resolve(input)
      })
    })

    /// Use the async-neocities package to get the API key
    apiKey = await NeocitiesAPIClient.getKey(siteName, password)

    // Save the API key in the config store
    configStore.set(keyPath, apiKey)
    console.log(`API Key saved for ${siteName}`)
  }

  assert(apiKey, 'An API key is required to proceed')
  assert(typeof src === 'string', 'a string src is required')
  const distDir = join(process.cwd(), src)

  const stat = await fs.stat(distDir)
  assert(stat.isDirectory(), 'dist_dir must be a directory that exists')

  const client = new NeocitiesAPIClient(apiKey)

  const deployOpts = {
    cleanup,
    statsCb: NeocitiesAPIClient.statsHandler()
  }

  if (protectedFiles) deployOpts.protectedFileFilter = minimatch.filter(protectedFiles)

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

function hashKey (key) {
  return createHash('sha256').update(key).digest('hex')
}
