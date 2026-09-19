const a0n = function(a, b) {
  var s, r = a.length - 1;
  if (r < 0) return -1;
  for (s = r; s >= 0; --s) {
    if (b.$1(a[s])) return s;
  }
  return -1;
};

const messages = [
  { a: 'msg1', b: 'conv1', c: 'user1', d: 'text', e: 'hello' },
  { a: 'msg2', b: 'conv1', c: 'user1', d: 'image', e: 'url2' },
  { a: 'optimistic-1', b: 'conv1', c: 'user1', d: 'image', e: 'data:image', status: 'sending', clientTempId: 'optimistic-1' }
];
const incoming = { a: 'msg3_real', b: 'conv1', c: 'user1', d: 'image', e: 'url3', clientTempId: 'optimistic-1' };

const a7Q = { a: incoming, $1(m) { return m.a === this.a.a; } };
const a7R = {
  a: incoming,
  $1(a) {
    var s = this.a;
    if (s.clientTempId && a.clientTempId && s.clientTempId === a.clientTempId) return true;
    if (a.c != s.c) return false;
    if (a.b != s.b) return false;
    if (a.e === s.e) return true;
    if (a.d === s.d && (a.status === 'sending' || (typeof a.a === 'string' && a.a.indexOf('optimistic-') === 0))) return true;
    return false;
  }
};

let r = a0n(messages, a7Q);
console.log('r:', r);
let q = a0n(messages, a7R);
console.log('q:', q);
if (q !== -1) messages[q] = incoming;
console.log('messages after:', messages.length, messages.map(m => m.a));
