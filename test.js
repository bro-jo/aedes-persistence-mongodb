'use strict'

var test = require('tape').test
var persistence = require('./')
var abs = require('aedes-cached-persistence/abstract')
var mqemitterMongo = require('mqemitter-mongodb')
var clean = require('mongo-clean')
var mongourl = 'mongodb://127.0.0.1/aedes-test'

clean(mongourl, { exclude: ['pubsub'] }, function (err, db) {
  if (err) {
    throw err
  }

  var dbopts = {
    url: mongourl
  }

  var lastEmitter = null

  db.close()

  abs({
    test: test,
    buildEmitter: function () {
      var emitter = mqemitterMongo(dbopts)
      lastEmitter = emitter
      return emitter
    },
    persistence: function build (cb) {
      clean(mongourl, { exclude: ['pubsub'] }, function (err, db) {
        if (err) {
          return cb(err)
        }
        db.close()

        var instance = persistence(dbopts)

        var oldDestroy = instance.destroy

        instance.destroy = function (cb) {
          oldDestroy.call(this, function () {
            lastEmitter.close(cb)
          })
        }

        cb(null, instance)
      })
    }
  })

  test('multiple persistences', function (t) {
    t.plan(6)

    clean(db, function (err) {
      t.error(err)

      var instance = persistence(dbopts)
      var instance2 = persistence(dbopts)
      var client = { id: 'abcde' }
      var subs = [{
        topic: 'hello',
        qos: 1
      }, {
        topic: 'hello/#',
        qos: 1
      }, {
        topic: 'matteo',
        qos: 1
      }]

      instance.addSubscriptions(client, subs, function (err) {
        t.notOk(err, 'no error')
        instance2.subscriptionsByTopic('hello', function (err, resubs) {
          t.notOk(err, 'no error')
          t.deepEqual(resubs, [{
            clientId: client.id,
            topic: 'hello/#',
            qos: 1
          }, {
            clientId: client.id,
            topic: 'hello',
            qos: 1
          }])
          instance.destroy(t.pass.bind(t, 'first dies'))
          instance2.destroy(t.pass.bind(t, 'second dies'))
        })
      })
    })
  })
})
