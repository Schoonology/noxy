var net = require('net')
  , stepdown = require('stepdown')

function NoxyClient(options) {
  if (!(this instanceof NoxyClient)) {
    return new NoxyClient(options)
  }

  var self = this

  self.passcode = options.passcode
  self.private = options.private

  self._socket = null
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
      self._socket = net.createConnection(port, this.next)
    }
  , function auth() {
      return self
    }
  ], callback)
}

NoxyClient.prototype.destroy = destroy
function destroy() {
  if (this._socket) {
    this._socket.destroy()
    return
  }
}

module.exports = NoxyClient