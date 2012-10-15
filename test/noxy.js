/*global describe:true, it:true, before:true, after:true, beforeEach:true, afterEach:true */
var net = require('net')
  , expect = require('chai').expect
  , stepdown = require('stepdown')
  , msgpack = require('msgpack3')
  , noxy = require('../lib/noxy')

describe('Noxy', function () {
  beforeEach(function () {
    this.options = {
      tunnel: 'localhost:9999'
    , port: 9999
    , passcode: 'secure'
    , service: 10000
    }
    this.server = noxy.createServer(this.options)
    this.client = noxy.createClient(this.options)
  })

  afterEach(function (done) {
    this.client.destroy()
    this.server.close(done)
  })

  describe('Server', function () {
    it('should listen on the provided port', function (done) {
      var self = this

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          net.createConnection(self.options.port, this.next)
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
          socket = net.createConnection(self.options.port, this.addResult())
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

    it('should treat connections after the first successful as public', function (done) {
      var self = this
        , socket
        , tooLate

      stepdown([
        function () {
          self.server.listen(this.next)
          expect(self.server._tunnel).to.not.exist
        }
      , function () {
          socket = net.createConnection(self.options.port, this.addResult())
        }
      , function () {
          socket.write(msgpack.pack({
            passcode: self.options.passcode
          }), this.next)
        }
      , function () {
          tooLate = net.createConnection(self.options.port, this.next)
        }
      , function () {
          expect(self.server._tunnel).to.exist
          tooLate.destroy()

          return null
        }
      ], done)
    })

    it('should forward public traffic to the private tunnel', function (done) {
      var self = this
        , localServer
        , publicClient

      stepdown([
        function () {
          self.server.listen(this.addResult())
          localServer = net.createServer(function (socket) {
            socket.on('data', function (data) {
              data = msgpack.unpack(data)

              expect(data).to.have.property('answer', 42)
              publicClient.destroy()
              localServer.close(done)
            })
          })
          localServer.listen(self.options.service, this.addResult())
        }
      , function () {
          self.client.connect(this.next)
        }
      , function () {
          publicClient = net.createConnection(self.options.port, function () {
            publicClient.write(msgpack.pack({
              answer: 42
            }))
          })
        }
      ])
    })

    it('should forward private responses to the public client', function (done) {
      var self = this
        , localServer
        , publicClient

      stepdown([
        function () {
          self.server.listen(this.addResult())
          localServer = net.createServer(function (socket) {
            socket.on('data', function (data) {
              data = msgpack.unpack(data)

              expect(data).to.have.property('answer', 42)
              socket.write(msgpack.pack({
                question: '???'
              }))
            })
          })
          localServer.listen(self.options.service, this.addResult())
        }
      , function () {
          self.client.connect(this.next)
        }
      , function () {
          publicClient = net.createConnection(self.options.port, function () {
            publicClient.write(msgpack.pack({
              answer: 42
            }))
          })

          publicClient.on('data', function (data) {
            data = msgpack.unpack(data)

            expect(data).to.have.property('question', '???')
            publicClient.destroy()
            localServer.close(done)
          })
        }
      ])
    })
  })

  describe('Client', function () {
    it('should connect to the provided port', function (done) {
      var self = this

      stepdown([
        function () {
          self.server.listen(this.next)
        }
      , function () {
          self.client.connect(this.next)
        }
      , function () {
          expect(self.server._server.connections).to.equal(1)
          return null
        }
      ], done)
    })

    it('should provide the supplied passcode', function (done) {
      var self = this
        , tooLate

      stepdown([
        function () {
          self.server.listen(this.next)
          expect(self.server._tunnel).to.not.exist
        }
      , function () {
          self.client.connect(this.next)
        }
      , function () {
          tooLate = net.createConnection(self.options.port, this.next)
        }
      , function () {
          expect(self.server._tunnel).to.exist
          tooLate.destroy()

          return null
        }
      ], done)
    })
  })
})
