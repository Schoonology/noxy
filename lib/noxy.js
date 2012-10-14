var net = require('net')
  , nconf = require('nconf')
  , stepdown = require('stepdown')

function NoxyServer(options) {
  if (!(this instanceof NoxyServer)) {
    return new NoxyServer
  }

  var self = this

  self._private = net.createServer(function (socket) {
    self._privateSocketConnection(socket)
  })
  self._public = net.createServer(function (socket) {
    selc._publicSocketConnection(socket)
  })
}
NoxyServer.createServer = NoxyServer

NoxyServer.prototype.listen = listen
function listen(port, callback) {
}

NoxyServer.prototype.close = close
function close(callback) {
}

NoxyServer.prototype._privateSocketConnection = _privateSocketConnection
function _privateSocketConnection(socket) {
}

NoxyServer.prototype._publicSocketConnection = _publicSocketConnection
function _publicSocketConnection(socket) {
}

module.exports = NoxyServer
