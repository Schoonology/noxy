/*global describe:true, it:true, before:true, after:true, beforeEach:true, afterEach:true */
var net = require('net')
  , expect = require('chai').expect
  , stepdown = require('stepdown')
  , msgpack = require('msgpack3')
  , noxy = require('../lib/noxy')

describe('Noxy', function () {
  beforeEach(function () {
    this.options = {
      public: 9999
    , private: 9998
    , passcode: 'secure'
    }
    this.server = noxy.createServer(this.options)
    this.client = noxy.createClient(this.options)
  })

  afterEach(function (done) {
    this.client.destroy()
    this.server.close(done)
  })

  describe('Server', function () {
    it('should listen on both the public and private ports simulateneously', function (done) {
      var self = this

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          net.createConnection(self.options.private, this.addResult())
          net.createConnection(self.options.public, this.addResult())
        }
      ], done)
      // If this fails, we'll get ECONNREFUSED.
    })

    it('should close any client socket that provides an invalid passcode', function (done) {
      var self = this
        , socket

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          socket = net.createConnection(self.options.private, this.addResult())
        }
      , function () {
          var next = this.next

          socket.on('close', function (hadError) {
            next(hadError ? new Error('Transmission Error') : null)
          })

          socket.write('wrongpasscode', function (err) {
            if (err) {
              next(err)
            }
          })
        }
      ], done)
    })

    it('should auto-reject further client connections after the first successful', function (done) {
      var self = this
        , socket

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          socket = net.createConnection(self.options.private, this.addResult())
        }
      , function () {
          socket.write(msgpack.pack({
            passcode: self.options.passcode
          }), this.next)
        }
      , function () {
          var tooLate = net.createConnection(self.options.private)
            , next = this.next

          tooLate.on('close', function (hadError) {
            next(hadError ? new Error('Transmission Error') : null)
          })
        }
      ], done)
    })

    it('should forward public traffic to the private tunnel')
  })

  describe('Client', function () {
    it('should connect to the provided Server\'s private port', function (done) {
      var self = this

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          self.client.connect(this.next)
        }
      , function () {
          expect(self.server._private.connections).to.equal(1)
          expect(self.server._public.connections).to.equal(0)
          return null
        }
      ], done)
    })

    it('should provide the supplied passcode', function (done) {
      var self = this

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          self.client.connect(this.next)
        }
      , function () {
          // Same test as before: If we succeeded, this should auto-reject.
          var tooLate = net.createConnection(self.options.private)
            , next = this.next

          tooLate.on('close', function (hadError) {
            next(hadError ? new Error('Transmission Error') : null)
          })
        }
      ], done)
    })
  })
})
