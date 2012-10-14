if (require.main === module) {
  require('./bin/noxy')
} else {
  module.exports = require('./lib/noxy')
}
