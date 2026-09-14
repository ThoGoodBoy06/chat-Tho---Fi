const fs = require('fs');
const path = require('path');

const callAudioEngineScript = `
<!-- Thẻ audio chuyên biệt cho WebRTC và chuông cuộc gọi -->
<audio id="remoteAudioPlayer" autoplay playsinline style="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;"></audio>
<audio id="callRingtoneAudio" loop preload="auto" src="/ringtone.mp3" style="display:none;"></audio>
<audio id="callTutTutAudio" loop preload="auto" src="/tuttut.mp3" style="display:none;"></audio>
<audio id="callEndAudio" preload="auto" src="/amthanhtat.mp3" style="display:none;"></audio>

<script id="call-audio-engine-script">
(function() {
  var audioCtx = null;
  var remoteSourceNode = null;

  function getAudioCtx() {
    if (!audioCtx || audioCtx.state === 'closed') {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function() {});
    }
    return audioCtx;
  }

  function unlockAudio() {
    var ctx = getAudioCtx();
    ['remoteAudioPlayer', 'callRingtoneAudio', 'callTutTutAudio', 'callEndAudio'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.muted = false;
        var p = el.play();
        if (p && p.then) {
          p.then(function() {
            if (id !== 'remoteAudioPlayer') el.pause();
          }).catch(function() {});
        }
      }
    });
  }
  ['click', 'touchstart', 'keydown'].forEach(function(evt) {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });

  window._callAudioEngine = {
    playIncomingRingtone: function() {
      this.stopAllCallSounds();
      var el = document.getElementById('callRingtoneAudio');
      if (el) {
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1.0;
        var p = el.play();
        if (p && p.catch) p.catch(function(e) {});
      }
    },
    playWaitingTutTut: function() {
      this.stopAllCallSounds();
      var el = document.getElementById('callTutTutAudio');
      if (el) {
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1.0;
        var p = el.play();
        if (p && p.catch) p.catch(function(e) {});
      }
    },
    playCallEndSound: function() {
      this.stopAllCallSounds();
      var el = document.getElementById('callEndAudio');
      if (el) {
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1.0;
        var p = el.play();
        if (p && p.catch) p.catch(function(e) {});
      }
    },
    stopAllCallSounds: function() {
      var ring = document.getElementById('callRingtoneAudio');
      if (ring) { ring.pause(); ring.currentTime = 0; }
      var tut = document.getElementById('callTutTutAudio');
      if (tut) { tut.pause(); tut.currentTime = 0; }
    },
    playRemoteStream: function(stream) {
      if (!stream) return;
      try {
        var audioEl = document.getElementById('remoteAudioPlayer');
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = 'remoteAudioPlayer';
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1.0;
        var p = audioEl.play();
        if (p && p.catch) p.catch(function() {});
      } catch(e) {}

      try {
        var ctx = getAudioCtx();
        if (ctx) {
          if (remoteSourceNode) {
            try { remoteSourceNode.disconnect(); } catch(_) {}
          }
          remoteSourceNode = ctx.createMediaStreamSource(stream);
          remoteSourceNode.connect(ctx.destination);
        }
      } catch(ctxErr) {}
    }
  };
})();
</script>
`;

const targets = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html')
];

for (const f of targets) {
  if (!fs.existsSync(f)) continue;
  let html = fs.readFileSync(f, 'utf8');
  if (!html.includes('id="call-audio-engine-script"')) {
    html = html.replace('</body>', `${callAudioEngineScript}\n</body>`);
    fs.writeFileSync(f, html, 'utf8');
    console.log(f, '✅ Successfully injected! Line count:', html.split('\n').length);
  } else {
    console.log(f, 'Already contains engine script');
  }
}
