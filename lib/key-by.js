/**
 * @template T
 * @template {keyof T} K
 * @param {T[]} array
 * @param {K} key
 * @returns {Record<string, T>}
 */
export function keyByKey (array, key) {
  return array.reduce(
    /**
     * @param {Record<string, T>} acc
     * @param {T} item
     */
    (acc, item) => {
      const keyValue = String(item[key])
      acc[keyValue] = item
      return acc
    },
    /** @type {Record<string, T>} */ ({})
  )
}

/**
 * @template T
 * @param {T[]} array
 * @param {(item: T) => string} fn
 * @returns {Record<string, T>}
 */
export function keyByFn (array, fn) {
  return array.reduce(
    /**
     * @param {Record<string, T>} acc
     * @param {T} item
     */
    (acc, item) => {
      const keyValue = fn(item)
      acc[keyValue] = item
      return acc
    },
    /** @type {Record<string, T>} */ ({})
  )
}

/**
 * Key an array of objects by string key or key function. Similar to lodash.keyBy, but simpler
 *
 * @template T
 * @param {T[]} array
 * @param {keyof T | ((item: T) => string)} keyOrFn
 * @returns {Record<string, T>}
 */
export function keyBy (array, keyOrFn) {
  if (typeof keyOrFn === 'function') {
    return keyByFn(array, keyOrFn)
  } else {
    return keyByKey(array, keyOrFn)
  }
}
