/**
 * Simple timer lets you record start and stop times, with an elapsed time getter.
 */
export class SimpleTimer {
  /** @type {number} */ start
  /** @type {number?} */ end = null
  /** @type {boolean} */ stopped = false

  /**
    @param {number} [startTime=Date.now()] - The time to start the timer at. If not provided, the timer will start at the current time.
  */
  constructor (startTime) {
    this.start = startTime || Date.now()
  }

  get elapsed () {
    if (this.stopped) {
      if (!this.end) this.end = Date.now()
      return this.end - this.start
    } else {
      return Date.now() - this.start
    }
  }

  stop () {
    if (this.stopped) return
    this.stopped = true
    this.end = Date.now()
  }

  toString () {
    return this.elapsed
  }

  toJSON () {
    return this.elapsed
  }
}
