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
