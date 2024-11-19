import afw from 'async-folder-walker'
import { minimatch } from 'minimatch'
import assert from 'node:assert'
import path from 'node:path'
import test from 'node:test'
import { alwaysIgnore } from './always-ignore.js'
import { neocitiesLocalDiff } from './folder-diff.js'

const __dirname = import.meta.dirname

const neocitiesFiles = [
  {
    path: 'img',
    is_directory: true,
    updated_at: 'Thu, 21 Nov 2019 04:06:17 -0000'
  },
  {
    path: 'index.html',
    is_directory: false,
    size: 1094,
    updated_at: 'Mon, 11 Nov 2019 22:23:16 -0000',
    sha1_hash: '7f15617e87d83218223662340f4052d9bb9d096d'
  },
  {
    path: 'neocities.png',
    is_directory: false,
    size: 13232,
    updated_at: 'Mon, 11 Nov 2019 22:23:16 -0000',
    sha1_hash: 'fd2ee41b1922a39a716cacb88c323d613b0955e4'
  },
  {
    path: 'not_found.html',
    is_directory: false,
    size: 347,
    updated_at: 'Mon, 11 Nov 2019 22:23:16 -0000',
    sha1_hash: 'd7f004e9d3b2eaaa8827f741356f1122dc9eb030'
  },
  {
    path: 'style.css',
    is_directory: false,
    size: 298,
    updated_at: 'Mon, 11 Nov 2019 22:23:16 -0000',
    sha1_hash: 'e516457acdb0d00710ab62cc257109ef67209ce8'
  },
  {
    path: 'a-folder/foo',
    is_directory: false,
    size: 298,
    updated_at: 'Mon, 11 Nov 2019 22:23:16 -0000',
    sha1_hash: 'e516457acdb0d00710ab62cc257109ef67209ce8'
  },
  {
    path: 'a-folder/bar',
    is_directory: false,
    size: 298,
    updated_at: 'Mon, 11 Nov 2019 22:23:16 -0000',
    sha1_hash: 'e516457acdb0d00710ab62cc257109ef67209ce8'
  }
]

test('test differ', async _t => {
  const localListing = await afw.allFiles(path.join(__dirname, '../fixtures'), {
    shaper: f => f,
    ignore: [...alwaysIgnore]
  })

  const diff = await neocitiesLocalDiff({
    neocitiesFiles,
    localListing
  })

  const {
    filesToUpload,
    filesToDelete,
    filesSkipped,
    protectedFiles,
    unsupportedFiles
  } = diff

  assert.ok(['tootzzz.png', 'toot.gif', 'cat.png', 'a-folder/baz.txt'].every(path => {
    const found = filesToUpload.find(ftu => ftu.name === path)
    assert.ok(found, 'we found the file')
    assert.ok(found.path && found.name, 'each file to upload has a name and path')
    return found
  }), 'every file to upload is included')

  assert.ok(['needle.mp3'].every(path => {
    const found = filesToUpload.find(ftu => ftu.name === path)
    assert.ok(!found, 'Unwanted files are not found')
    return !found
  }), 'unsupported files are not included in the filesToUpload data')

  assert.deepEqual(filesToDelete, [
    'not_found.html',
    'style.css',
    'a-folder/foo',
    'a-folder/bar'
  ], 'filesToDelete returned correctly')

  assert.ok(['neocities.png'].every(path => {
    const found = filesSkipped.find(fs => fs === path)
    return found
  }), 'every file skipped is included')

  assert.equal(protectedFiles.length, 0, 'no files are protected by default')
  assert.equal(unsupportedFiles.length, 1, 'There is one unsupported file')
  assert.equal(unsupportedFiles[0], 'needle.mp3', 'The correct unsupported file is found')
})

test('protected files', async _t => {
  const localListing = await afw.allFiles(path.join(__dirname, '../fixtures'), {
    shaper: f => f,
    ignore: [...alwaysIgnore]
  })

  const {
    filesToDelete,
    protectedFiles
  } = await neocitiesLocalDiff({
    neocitiesFiles,
    localListing,
    protectedFileFilter: minimatch.filter('a-folder/*')
  })

  assert.deepEqual(filesToDelete, [
    'not_found.html',
    'style.css'
  ], 'filesToDelete returned correctly')

  assert.deepEqual(protectedFiles, ['a-folder/foo', 'a-folder/bar'], 'protected files are protected')
})

test('unsupported files can be included for neocities supporters', async _t => {
  const localListing = await afw.allFiles(path.join(__dirname, '../fixtures'), {
    shaper: f => f,
    ignore: [...alwaysIgnore]
  })

  const diff = await neocitiesLocalDiff({
    neocitiesFiles,
    localListing,
    includeUnsupportedFiles: true
  })

  const {
    filesToUpload,
    unsupportedFiles
  } = diff

  assert.equal(unsupportedFiles.length, 1, 'There is one unsupported file')
  assert.equal(unsupportedFiles[0], 'needle.mp3', 'The correct unsupported file is found')

  assert.ok(['tootzzz.png', 'toot.gif', 'cat.png', 'a-folder/baz.txt', 'needle.mp3'].every(path => {
    const found = filesToUpload.find(ftu => ftu.name === path)
    assert.ok(found, 'we found the file')
    assert.ok(found.path && found.name, 'each file to upload has a name and path')
    return found
  }), 'every file to upload is included')
})
