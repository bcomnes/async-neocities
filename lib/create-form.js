const FormData = require('form-data')
const batch = require('lodash.chunk')

function createForm (formEntries) {
  const form = new FormData()
  for (const { name, value } of formEntries) {
    form.append(name, value)
  }

  return form
}

exports.createForm = createForm

function createForms (formEntries, opts = {}) {
  const { batchSize = 50 } = opts
  const forms = []
  const batchedFormEntries = batch(formEntries, batchSize)

  for (const formEntryBatch of batchedFormEntries) {
    const form = createForm(formEntryBatch)
    forms.push(form)
  }

  return forms
}

exports.createForms = createForms
