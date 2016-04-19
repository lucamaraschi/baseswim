'use strict'

const networkAddress = require('network-address')
const Swim = require('swim')
const assert = require('assert')
const xtend = require('xtend')
const control = require('./lib/control')
const udpFreePort = require('udp-free-port')
const Rx = require('rx')
const defaults = {
  joinTimeout: 5000,
  pingTimeout: 200, // increase the swim default 10 times
  pingReqTimeout: 600, // increase the swim default 10 times
  interval: 200 // double swim default
}

let _instance = null

const BaseSwim = class BaseSwim extends Swim {
  constructor (id, opts) {
    if (typeof id === 'object') {
      opts = id
      id = null
    }

    opts = xtend(defaults, opts)

    // cannot use xtend because it is not recursive
    opts.local = opts.local || {}
    opts.base = opts.base || []

    // initialize the current host with the id
    opts.local.host = opts.local.host || id

    super(opts)
    this.initialize(opts)
  }

  static Baseswim (id, opts) {
    if (!_instance) {
      _instance = new BaseSwim(id, opts)
    }
    return _instance
  }

  initialize (opts) {
    const hostname = opts.host || networkAddress()

    if (!opts.local.host && opts.port) {
      opts.local.host = hostname + ':' + opts.port
    } else if (!opts.local.host && !opts.port) {
      udpFreePort((err, port) => {
        if (err) {
          this.emit('error', err)
        }

        opts.local.host = hostname + ':' + port
      })
    }

    assert(opts.local.host, 'missing id or opts.local.host or opts.port')
    // hacky fix to have stable events
    let set = new Set()

    Rx.Observable.fromEvent(this, Swim.EventType.Change)
      .subscribe((event) => {
        switch (event.state) {
          case 0:
            if (!set.has(event.host)) {
              set.add(event.host)
              this.emit('peerUp', event)
            }

            break
        }
      })

    Rx.Observable.fromEvent(this, Swim.EventType.Update)
      .subscribe((event) => {
        switch (event.state) {
          case 0:
            if (!set.has(event.host)) {
              set.add(event.host)
              this.emit('peerUp', event)
            }
            break
          case 1:
            this.emit('peerSuspect', event)
            break
          case 2:
            set.delete(event.host)
            this.emit('peerDown', event)
            break
        }
      })

    BaseSwim.EventType = Swim.EventType

    this.boot(opts)
  }

  boot (opts) {
    this.bootstrap(opts.base, (err) => {
      if (err) {
        this.emit('error', err)
        return
      }
      if (opts.http) {
        if (typeof opts.http === 'number') {
          opts.http = { port: parseInt(opts.http) }
        }
        this._http = control(this)
        this._http.listen(opts.http.port || 3000, (err) => {
          if (err) {
            this.emit('error', err)
            return
          }
          this.emit('httpReady', opts.http.port)
          this.emit('up')
        })
      } else {
        this.emit('up')
      }
    })
  }

  leave () {
    if (this._http) {
      this._http.close()
    }

    Swim.prototype.leave.call(this)
  }
}

module.exports = BaseSwim
