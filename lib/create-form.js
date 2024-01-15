import FormData from 'form-data'

export function createForm (formEntries) {
  const form = new FormData()
  for (const { name, value } of formEntries) {
    form.append(name, value)
  }

  return form
}

export function createForms (formEntries, opts = {}) {
  const { batchSize = 50 } = opts
  const forms = []
  const batchedFormEntries = chunk(formEntries, batchSize)

  for (const formEntryBatch of batchedFormEntries) {
    const form = createForm(formEntryBatch)
    forms.push(form)
  }

  return forms
}

function chunk (array, size) {
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
