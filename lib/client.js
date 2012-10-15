var net = require('net')
  , stepdown = require('stepdown')
  , msgpack = require('msgpack3')

function NoxyClient(options) {
  if (!(this instanceof NoxyClient)) {
    return new NoxyClient(options)
  }

  var self = this

  self.passcode = self.passcode || options.passcode
  self.tunnel = self.tunnel || options.port || options.tunnel
  self.service = self.service || options.service

  self._tunnel = null
  self._sockets = {}
}
NoxyClient.createClient = NoxyClient

NoxyClient.prototype.connect = connect
function connect(port, callback) {
  if (typeof port === 'function') {
    callback = port
    port = this.tunnel
  } else if (port == null) {
    port = this.tunnel
  }

  console.log('Connecting to:', port)

  if (typeof port === 'string') {
    port = port.split(':')
    port = {
      host: port[0]
    , port: port[1]
    }
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
          case 'ready':
            console.log('Ready.')
            callback()
            break;
          case 'connection':
            socket = self._sockets[clientId] = net.createConnection(self.service, function () {
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

      self._tunnel.on('end', function () {
        console.log('End.')
        self._tunnel = null
      })
    }
  , function auth() {
      console.log('Connected. Auth...')
      self._tunnel.write(msgpack.pack({
        passcode: self.passcode
      }), this.next)
    }
  , function () {
      console.log('Waiting for ready...')
    }
  ])
}

NoxyClient.prototype.destroy = destroy
function destroy() {
  if (this._tunnel) {
    this._tunnel.destroy()
    return
  }
}

module.exports = NoxyClient
