const fs = require('fs');

console.log('=== TIẾN HÀNH PATCH b42 VÀ A.avY VỚI CRLF HANDLING ===');

const mainJsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainJsFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // 1. Hook b42
  const idxB42 = js.indexOf('b42(a){var s=new window.RTCPeerConnection(new A.Ko([],[]).lh(a))');
  if (idxB42 !== -1) {
    const endB42 = js.indexOf('return s},', idxB42);
    if (endB42 !== -1) {
      const oldSnippet = js.slice(idxB42, endB42 + 10);
      const newSnippet = `b42(a){var s=new window.RTCPeerConnection(new A.Ko([],[]).lh(a));
try{
  window._activePeerConnection=s;
  s.addEventListener("icecandidate",function(e){
    if(e&&e.candidate&&e.candidate.candidate){
      var pid=window._currentCallPartnerId||"";
      console.log("⚡ [Native P2P ICE] Gửi candidate tới:",pid,e.candidate.candidate);
      if(typeof $!=="undefined"&&$.bj&&pid){
        try{
          var r=(typeof t!=="undefined"&&t.N)?t.N:null;
          if(typeof A!=="undefined"&&A.V&&r&&t.X&&t.K){
            $.bj.cn("webrtc_signal",A.V(["connectedUserId",pid,"signal",A.V(["type","candidate","candidate",e.candidate.candidate,"sdpMid",e.candidate.sdpMid,"sdpMLineIndex",e.candidate.sdpMLineIndex],r,t.X)],r,t.K));
          }
        }catch(err){console.warn("Lỗi emit candidate:",err);}
      }
    }
  });
  s.addEventListener("track",function(e){
    console.log("🔊 [Native P2P Track]:",e.track?e.track.kind:"unknown",e.streams);
    var stm=(e.streams&&e.streams[0])?e.streams[0]:(e.track?new MediaStream([e.track]):null);
    if(stm&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){
      window._callAudioEngine.playRemoteStream(stm);
    }
  });
  s.addEventListener("addstream",function(e){
    console.log("🔊 [Native P2P AddStream]:",e.stream?e.stream.id:"null");
    if(e.stream&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){
      window._callAudioEngine.playRemoteStream(e.stream);
    }
  });
}catch(hkErr){console.warn("Lỗi hook RTCPeerConnection:",hkErr);}
return s},`;
      js = js.replace(oldSnippet, newSnippet);
      console.log(`✅ [main.dart.js] Đã gắn Native Hook đồng bộ cho b42() trong: ${fp}`);
    }
  }

  // 2. Hook A.avY
  const idxAvY = js.indexOf('A.avY.prototype={');
  if (idxAvY !== -1) {
    const endAvY = js.indexOf('$S:610}', idxAvY);
    if (endAvY !== -1) {
      const oldAvYSnippet = js.slice(idxAvY, endAvY + 7);
      const newAvYSnippet = `A.avY.prototype={
$1(a){try{var s,r,q=a?a.candidate:null,tgt=this.a||window._currentCallPartnerId||"";
if(q!=null&&q.candidate!=null&&tgt){s=$.bj;
if(s!=null){r=t.N;
s.cn("webrtc_signal",A.V(["connectedUserId",tgt,"signal",A.V(["type","candidate","candidate",q.candidate,"sdpMid",q.sdpMid,"sdpMLineIndex",q.sdpMLineIndex],r,t.X)],r,t.K))}}}catch(_){}},
$S:610}`;
      js = js.replace(oldAvYSnippet, newAvYSnippet);
      console.log(`✅ [main.dart.js] Đã vá A.avY an toàn trong: ${fp}`);
    }
  }

  fs.writeFileSync(fp, js, 'utf8');
}

console.log('=== HOÀN TẤT PATCH b42 VÀ A.avY ===');
