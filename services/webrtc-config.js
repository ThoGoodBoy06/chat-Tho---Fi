const crypto = require('crypto');

function buildIceConfig(env = process.env, userId = '', now = Date.now()) {
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
    ];
    const urls = (env.TURN_URLS || '').split(',').map(s => s.trim())
        .filter(s => /^turns?:[^\s]+$/i.test(s));
    if (urls.length && env.TURN_SHARED_SECRET) {
        const username = `${Math.floor(now / 1000) + 3600}:${userId}`;
        const credential = crypto.createHmac('sha1', env.TURN_SHARED_SECRET).update(username).digest('base64');
        iceServers.push({ urls, username, credential });
    } else if (urls.length && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
        iceServers.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
    } else {
        // Fallback to Metered OpenRelay TURN servers when no custom TURN server is set in env
        iceServers.push({
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        });
    }
    return { iceServers, iceCandidatePoolSize: 10, relayConfigured: true };
}

module.exports = { buildIceConfig };
