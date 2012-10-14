var net = require('net')
  , stepdown = require('stepdown')

function NoxyServer(options) {
  if (!(this instanceof NoxyServer)) {
    return new NoxyServer(options)
  }

  var self = this

  self.passcode = options.passcode
  self.private = options.private
  self.public = options.public

  self._private = net.createServer(function (socket) {
    self._privateSocketConnection(socket)
  })
  self._public = net.createServer(function (socket) {
    self._publicSocketConnection(socket)
  })

  self._tunnel = null
  self._sockets = []
}
NoxyServer.createServer = NoxyServer

NoxyServer.prototype.listen = listen
function listen(pub, priv, callback) {
  if (typeof pub === 'function') {
    callback = pub
    pub = this.public
    priv = this.private
  } else if (typeof priv === 'function') {
    callback = priv
    priv = this.private
  }

  var self = this

  stepdown([
    function delegate() {
      if (typeof pub === 'number') {
        self._public.listen(pub, this.addResult())
      } else {
        self._public.listen(pub.port, pub.host, this.addResult())
      }

      if (typeof priv === 'number') {
        self._private.listen(priv, this.addResult())
      } else {
        self._private.listen(priv.port, priv.host, this.addResult())
      }
    }
  ], callback)
}

NoxyServer.prototype.close = close
function close(callback) {
  var self = this

  stepdown([
    function cleanUp() {
      self._sockets.forEach(function (socket) {
        socket.destroy()
      })

      self._tunnel = null
      self._sockets = []
      return null
    }
  , function delegate() {
      var priv = this.addResult()
        , pub = this.addResult()

      if (self._private._handle) {
        self._private.close(priv)
      } else {
        priv()
      }

      if (self._public._handle) {
        self._public.close(pub)
      } else {
        pub()
      }
    }
  ], callback)
}

NoxyServer.prototype._privateSocketConnection = _privateSocketConnection
function _privateSocketConnection(socket) {
  var self = this

  if (self._tunnel) {
    socket.destroy()
    return
  }

  self._sockets.push(socket)

  // TODO: Handle multiple pending tunnels.
  socket.once('data', function checkPasscode(passcode) {
    if (self.passcode !== passcode.toString()) {
      socket.destroy()
      self._tunnel = null
      return
    }

    self._tunnel = socket
  })
}

NoxyServer.prototype._publicSocketConnection = _publicSocketConnection
function _publicSocketConnection(socket) {
  var self = this

  self._sockets.push(socket)
}

module.exports = NoxyServer
