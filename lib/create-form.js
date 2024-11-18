/**
 * @import { FileUpload } from './neocities.js'
 */

import FormData from 'form-data'
import { createReadStream } from 'node:fs'

/**
 * @param  {FileUpload[]} files
 */
export function createFileForm (files) {
  const fileFormEntries = files.map(({ name, path }) => {
    const streamCtor =
      /**
       * @param  {(stream: NodeJS.ReadableStream) => any} next
       * @return {NodeJS.ReadableStream}
       */
      (next) => next(createReadStream(path))
    streamCtor.path = path
    return {
      name,
      value: streamCtor
    }
  })

  return createForm(fileFormEntries)
}

/**
 * @param  {{ name: string, value: any }[]} formEntries
 * @return {FormData}
 */
export function createForm (formEntries) {
  const form = new FormData()
  for (const { name, value } of formEntries) {
    form.append(name, value)
  }

  return form
}

/**
 * @param  {{ name: string, value: any }[]} formEntries
 * @param  {{
 *         batchSize: number
 * }}  opts
 * @return {FormData[]}
 */
export function createForms (formEntries, opts) {
  const { batchSize = 50 } = opts
  const forms = []
  const batchedFormEntries = chunk(formEntries, batchSize)

  for (const formEntryBatch of batchedFormEntries) {
    const form = createForm(formEntryBatch)
    forms.push(form)
  }

  return forms
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @template T
 * @param {T[]} array - The array to chunk.
 * @param {number} size - The size of each chunk.
 * @return {T[][]} - An array of chunks.
 */
export function chunk (array, size) {
  if (!Array.isArray(array)) {
    throw new TypeError('First argument must be an array.')
  }

  if (!Number.isInteger(size) || size <= 0) {
    throw new TypeError('Size must be a positive integer.')
  }

  const chunked = []
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size))
  }

  return chunked
}
