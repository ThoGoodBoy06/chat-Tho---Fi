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
    }
    return { iceServers, iceCandidatePoolSize: 0, relayConfigured: iceServers.some(server => !!server.credential) };

}

// Credentials are fetched server-side; the provider API key never reaches clients.
function createIceConfigResolver({env = process.env, fetchImpl = global.fetch, now = Date.now} = {}) {
    let cached, expires = 0, pending;
    return async function resolve(userId) {
        const local = buildIceConfig(env, userId, now());
        if (local.relayConfigured || !env.METERED_TURN_API_KEY || !env.METERED_TURN_DOMAIN) return local;
        const domain = env.METERED_TURN_DOMAIN.trim();
        if (!/^[a-z0-9-]+\.metered\.(live|ca)$/i.test(domain)) return local;
        if (cached && now() < expires) return {...local, iceServers:[...local.iceServers,...cached], relayConfigured:true};
        if (!pending) pending = (async () => {
            const url = new URL(`https://${domain}/api/v1/turn/credentials`);
            url.searchParams.set('apiKey',env.METERED_TURN_API_KEY);
            const response = await fetchImpl(url, {signal:AbortSignal.timeout(4000),redirect:'error'});
            if (!response.ok) throw Error('TURN provider unavailable');
            const data = await response.json();
            if (!Array.isArray(data)) throw Error('Invalid TURN response');
            const servers = data.filter(s => s && typeof s.username === 'string' && s.username &&
                typeof s.credential === 'string' && s.credential &&
                (Array.isArray(s.urls) ? s.urls : [s.urls]).every(u => typeof u === 'string' && /^turns?:[^\s]+$/i.test(u)))
                .map(s => ({urls:s.urls,username:s.username,credential:s.credential}));
            if (!servers.length) throw Error('No TURN credentials');
            cached = servers; expires = now() + 60000; return servers;
        })().finally(() => {pending = null;});
        try {return {...local,iceServers:[...local.iceServers,...await pending],relayConfigured:true};}
        catch (_) {return local;}
    };
}
module.exports = { buildIceConfig, createIceConfigResolver };
