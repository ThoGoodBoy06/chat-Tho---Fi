const assert = require('node:assert/strict');
const { buildIceConfig } = require('../services/webrtc-config');
const crypto = require('node:crypto');

const config = buildIceConfig({ TURN_URLS: 'turn:relay.example:3478,turns:relay.example:5349', TURN_SHARED_SECRET: 'test-secret' }, 'user', 1000000);
assert.equal(config.relayConfigured, true);
const relay = config.iceServers.at(-1);
assert.equal(relay.username, '4600:user');
assert.equal(relay.credential, crypto.createHmac('sha1','test-secret').update('4600:user').digest('base64'));
assert.equal(JSON.stringify(config).includes('test-secret'), false);
assert.equal(buildIceConfig({TURN_URLS:'turn:relay.example'}).relayConfigured, false);
assert.equal(buildIceConfig({TURN_URLS:'https://invalid',TURN_USERNAME:'u',TURN_CREDENTIAL:'p'}).relayConfigured, false);
assert.equal(buildIceConfig({TURN_URLS:'turn:relay.example',TURN_USERNAME:'u',TURN_CREDENTIAL:'p'}).relayConfigured, true);
console.log('TURN credentials, expiry, secret isolation and invalid configuration: passed.');
