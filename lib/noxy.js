var NoxyServer = require('./server')
  , NoxyClient = require('./client')

module.exports = {
  Client: NoxyClient
, Server: NoxyServer
, createClient: NoxyClient.createClient
, createServer: NoxyServer.createServer
}
