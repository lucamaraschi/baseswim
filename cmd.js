#! /usr/bin/env node

'use strict'

const BaseSwim = require('../baseswim')
const minimist = require('minimist')
const pino = require('pino')
const Rx = require('rx')

function start () {
  const logger = pino()
  const info = logger.info
  const argv = minimist(process.argv.slice(2), {
    integer: ['port'],
    alias: {
      port: 'p',
      host: 'h',
      help: 'H',
      joinTimeout: 'j'
    },
    default: {
      port: process.env.SWIM_PORT
    }
  })

  if (argv.help) {
    console.error('Usage:', process.argv[1], '[--port PORT] [--host YOURIP] base1 base2')
    process.exit(1)
  }

  argv.base = argv._

  let baseswim = new BaseSwim(argv)

  Rx.Observable.fromEvent(baseswim, 'httpReady')
  .subscribe((event) => {
    info('http server listening on port %d', event)
  })

  Rx.Observable.fromEvent(baseswim, 'peerUp')
  .subscribe((peer) => {
    info(peer, 'peer online')
  })

  Rx.Observable.fromEvent(baseswim, 'peerSuspect')
  .subscribe((peer) => {
    info(peer, 'peer suspect')
  })

  Rx.Observable.fromEvent(baseswim, 'peerDown')
  .subscribe((peer) => {
    info(peer, 'peer offline')
  })

  Rx.Observable.fromEvent(baseswim, 'up')
  .subscribe((peer) => {
    info({ id: baseswim.whoami() }, 'I am up')
  })
}

if (require.main === module) {
  start()
}
