var net = require('net')
  , stepdown = require('stepdown')
  , msgpack = require('msgpack3')

function NoxyServer(options) {
  if (!(this instanceof NoxyServer)) {
    return new NoxyServer(options)
  }

  var self = this

  self.passcode = self.passcode || options.passcode
  self.port = process.env.PORT || self.port || options.port || options.tunnel.port

  self._server = net.createServer(function (socket) {
    self._onConnection(socket)
  })

  self._tunnel = null
  self._sockets = {}
}
NoxyServer.createServer = NoxyServer

NoxyServer.prototype.listen = listen
function listen(port, callback) {
  if (typeof port === 'function') {
    callback = port
    port = this.port
  }

  var self = this

  stepdown([
    function delegate() {
      if (typeof port === 'number') {
        self._server.listen(port, this.addResult())
      } else {
        self._server.listen(port.port, port.host, this.addResult())
      }
    }
  ], callback)
}

NoxyServer.prototype.close = close
function close(callback) {
  var self = this

  stepdown([
    function cleanUp() {
      Object.keys(self._sockets).forEach(function (clientId) {
        self._sockets[clientId] && self._sockets[clientId].destroy()
      })

      self._tunnel = null
      self._sockets = {}
      return null
    }
  , function delegate() {
      if (self._server._handle) {
        self._server.close(this.next)
      }
    }
  ], callback)
}

NoxyServer.prototype._onConnection = _onConnection
function _onConnection(socket) {
  if (this._tunnel) {
    return this._publicSocketConnection(socket)
  }

  // TODO: Check tunnel:host or somesuch.
  return this._privateSocketConnection(socket)
}

NoxyServer.prototype._privateSocketConnection = _privateSocketConnection
function _privateSocketConnection(socket) {
  var self = this

  if (self._tunnel) {
    socket.destroy()
    return
  }

  self._sockets[Math.random().toString().slice(2)] = socket

  console.log('New private connection attempt.')

  // TODO: Handle multiple pending tunnels.
  socket.once('data', function checkPasscode(data) {
    if (self.passcode !== msgpack.unpack(data).passcode) {
      socket.destroy()
      self._tunnel = null
      return
    }

    console.log('Tunnel established.')

    self._tunnel = socket

    self._tunnel.on('data', function (data) {
      var unpacked = msgpack.unpack(data)
        , event = unpacked.event
        , clientId = unpacked.clientId
        , data = unpacked.data || null
        , socket = self._sockets[clientId]

      switch(event) {
        case 'ready':
          socket.resume()
          break;
        case 'data':
          if (!socket) {
            console.error('Never connected to', clientId)
            // TODO: Tell client?
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
      self._tunnel = null
    })

    self._tunnel.write(msgpack.pack({
      event: 'ready'
    }))
  })
}

NoxyServer.prototype._publicSocketConnection = _publicSocketConnection
function _publicSocketConnection(socket) {
  var self = this
    , clientId

  if (!self._tunnel) {
    socket.destroy()
    return
  }

  clientId = Math.random().toString().slice(2)

  console.log('New public connection:', clientId)

  self._sockets[clientId] = socket
  self._tunnel.write(msgpack.pack({
    event: 'connection'
  , clientId: clientId
  }))

  socket.pause()

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
}

module.exports = NoxyServer
