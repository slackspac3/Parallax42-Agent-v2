'use strict';

const { backendRelayHandler } = require('./_backendRelay');

module.exports = backendRelayHandler;
module.exports.config = {
  api: {
    bodyParser: false,
    responseLimit: false
  },
  maxDuration: 120
};
