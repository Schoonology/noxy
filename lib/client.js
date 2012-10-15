var net = require('net')
  , stepdown = require('stepdown')
  , msgpack = require('msgpack3')

function NoxyClient(options) {
  if (!(this instanceof NoxyClient)) {
    return new NoxyClient(options)
  }

  var self = this

  self.passcode = options.passcode
  self.private = options.private
  self.public = options.public

  self._tunnel = null
  self._sockets = {}
}
NoxyClient.createClient = NoxyClient

NoxyClient.prototype.connect = connect
function connect(port, callback) {
  if (typeof port === 'function') {
    callback = port
    port = this.private
  }

  var self = this

  stepdown([
    function delegate() {
      self._tunnel = net.createConnection(port, this.next)
      self._tunnel.on('data', function (data) {
        var unpacked = msgpack.unpack(data)
          , event = unpacked.event
          , clientId = unpacked.clientId
          , data = unpacked.data || null
          , socket = self._sockets[clientId]

        switch(event) {
          case 'connection':
            socket = self._sockets[clientId] = net.createConnection(self.public, function () {
              self._tunnel.write(msgpack.pack({
                event: 'ready'
              , clientId: clientId
              }))
            })

            socket.on('data', function (data) {
              self._tunnel.write(msgpack.pack({
                event: 'data'
              , clientId: clientId
              , data: data.toString('base64')
              }))
            })

            socket.on('end', function () {
              self._tunnel.write(msgpack.pack({
                event: 'end'
              , clientId: clientId
              }))

              self._sockets[clientId] = null
            })
            break;
          case 'data':

            if (!socket) {
              console.error('Missed connection for', clientId)
              // TODO: Tell server?
              return
            }
            socket.write(data, 'base64')
            break;
          case 'end':
            if (!socket) {
              return
            }
            socket.destroy()
            self._sockets[clientId] = null
            break;
        }
      })
    }
  , function auth() {
      self._tunnel.write(msgpack.pack({
        passcode: self.passcode
      }), this.next)
    }
  ], callback)
}

NoxyClient.prototype.destroy = destroy
function destroy() {
  if (this._tunnel) {
    this._tunnel.destroy()
    return
  }
}

module.exports = NoxyClient
