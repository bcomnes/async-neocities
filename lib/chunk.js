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
