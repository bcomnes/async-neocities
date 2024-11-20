/**
* @import { AsyncNeocitiesDiff } from './folder-diff.js'
* @import { SimpleTimer } from './timer.js'
* @import { DeployResults } from './api-endpoints.js'
*/

import { format } from '@lukeed/ms'

/**
 *  @param {object} params
 *  @param {AsyncNeocitiesDiff} params.diff
 *  @param {SimpleTimer} params.timer
 *  @param {boolean} params.cleanup
 *  @param {boolean} params.includeUnsupportedFiles
*/
export function printPreviewText ({
  diff,
  timer,
  cleanup,
  includeUnsupportedFiles
}) {
  console.log(`Preview deploy to Neocities in ${format(timer.elapsed)}:`)
  console.log(`    Upload ${diff.filesToUpload.length} files`)
  console.log(`    ${cleanup ? 'Delete' : 'Orphan'} ${diff.filesToDelete.length} files`)
  console.log(`    Skip ${diff.filesSkipped.length} files`)
  console.log(`    ${includeUnsupportedFiles ? 'Include' : 'Ignore'} ${diff.unsupportedFiles.length} unsupported files:`)
  if (diff.unsupportedFiles.length) {
    console.log(diff.unsupportedFiles)
  }
  console.log(`    Found ${diff.protectedFiles.length} protected files:`)
  if (diff.protectedFiles.length) {
    console.log(diff.protectedFiles)
  }
}

/**
 *  @param {object} params
 *  @param {DeployResults} params.results
 *  @param {SimpleTimer} params.timer
 *  @param {boolean} params.cleanup
 *  @param {boolean} params.includeUnsupportedFiles
*/
export function printDeployText ({
  results,
  timer,
  cleanup,
  includeUnsupportedFiles
}) {
  console.log(`Deployed to Neocities in ${format(timer.elapsed)}:`)
  console.log(`    Uploaded ${results.diff.filesToUpload.length} files`)
  console.log(`    ${cleanup ? 'Deleted' : 'Orphaned'} ${results.diff.filesToDelete.length} files`)
  console.log(`    Skipped ${results.diff.filesSkipped.length} files`)
  console.log(`    ${includeUnsupportedFiles ? 'Included' : 'Ignored'} ${results.diff.unsupportedFiles.length} unsupported files:`)
  if (results.diff.unsupportedFiles.length) {
    console.log(results.diff.unsupportedFiles)
  }
  console.log(`    Found ${results.diff.protectedFiles.length} protected files:`)
  if (results.diff.protectedFiles.length) {
    console.log(results.diff.protectedFiles)
  }
}

/**
 *  @param {object} params
 *  @param {DeployResults} params.results
 *  @param {SimpleTimer} params.timer
*/
export function printResultsErrorDump ({
  results,
  timer
}) {
  console.log(`The Deploy finished in ${format(timer.elapsed)} with Errors! Dumping the results:\n\n`)
  console.log('Successful results:')
  console.dir({ results: results.results }, { depth: null })
  console.log('\n\n')

  console.log('Deploy Diff:')
  console.dir({ diff: results.diff }, { depth: null })
  console.log('\n\n')

  console.log('Deploy Errors:')
  console.dir({ errors: results.errors }, { depth: null })
  console.log('\n\n')

  console.log('Please inspect the errors and debug output to look for hints as to why this might have failed.')
  console.log('Your website may have ')
}
