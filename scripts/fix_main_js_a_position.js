const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const imgGestureClasses = `A.aImgDoubleTap = function aImgDoubleTap(msgId) {
  this.msgId = msgId;
};
A.aImgDoubleTap.prototype = {
  $0: function() {
    var mid = this.msgId;
    if (window.reactToMessage) {
      window.reactToMessage(mid, "\\u2764\\ufe0f");
    } else {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (prov && typeof prov.a1l === 'function') prov.a1l(mid, "\\u2764\\ufe0f");
    }
  },
  $S: 0
};

A.aImgDoubleTapDown = function aImgDoubleTapDown(msgId) {
  this.msgId = msgId;
};
A.aImgDoubleTapDown.prototype = {
  $1: function(details) {
    try {
      if (details && details.a) {
        var px = details.a.a, py = details.a.b;
        var fly = document.createElement('div');
        fly.textContent = "\\u2764\\ufe0f";
        fly.style.cssText = 'position:fixed;left:' + px + 'px;top:' + py + 'px;transform:translate(-50%,-50%) scale(0.5);font-size:60px;z-index:999999;pointer-events:none;transition:all 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);opacity:1;';
        document.body.appendChild(fly);
        setTimeout(function() {
          fly.style.transform = 'translate(-50%,-100%) scale(1.3)';
          fly.style.opacity = '0';
        }, 20);
        setTimeout(function() { fly.remove(); }, 550);
      }
    } catch(e) {}
  },
  $S: 31
};

A.aImgLongPress = function aImgLongPress(state, msg, isMe) {
  this.state = state;
  this.msg = msg;
  this.isMe = isMe;
};
A.aImgLongPress.prototype = {
  $0: function() {
    try {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (this.state && typeof this.state.VK === 'function') {
        var ctx = this.state.d || this.state.cx || (window.$ && window.$._activeChatContext);
        this.state.VK(ctx, this.msg, prov, this.isMe);
      }
    } catch(e) { console.warn("aImgLongPress error:", e); }
  },
  $1: function(details) {
    this.$0();
  },
  $S: 31
};`;

jsFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  console.log(`Fixing position of A.aImgDoubleTap in ${fp}...`);
  let js = fs.readFileSync(fp, 'utf8');

  // Remove if present at top
  const topMarker = 'A.aImgDoubleTap = function aImgDoubleTap(msgId)';
  if (js.startsWith(topMarker) || js.indexOf(topMarker) < 100) {
    const endMarker = 'A.aImgLongPress.prototype = {\n  $0: function() {\n    try {\n      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);\n      if (this.state && typeof this.state.VK === \'function\') {\n        var ctx = this.state.d || this.state.cx || (window.$ && window.$._activeChatContext);\n        this.state.VK(ctx, this.msg, prov, this.isMe);\n      }\n    } catch(e) { console.warn("aImgLongPress error:", e); }\n  },\n  $1: function(details) {\n    this.$0();\n  },\n  $S: 31\n};';
    const cutIdx = js.indexOf(endMarker);
    if (cutIdx !== -1) {
      js = js.substring(cutIdx + endMarker.length).trimStart();
      console.log(`  Removed from top in ${fp}`);
    }
  }

  // Also remove any duplicate imgGestureClasses
  while (js.indexOf(topMarker) !== -1) {
    const idx = js.indexOf(topMarker);
    const endIdx = js.indexOf('$S: 31\n};', idx);
    if (endIdx !== -1) {
      js = js.substring(0, idx) + js.substring(endIdx + 9);
      console.log(`  Removed duplicate block at ${idx}`);
    } else {
      break;
    }
  }

  // Now insert right before A.auR.prototype
  const auRTarget = 'A.auR.prototype={';
  if (js.includes(auRTarget)) {
    js = js.replace(auRTarget, imgGestureClasses + '\n' + auRTarget);
    console.log(`  Inserted right before A.auR.prototype in ${fp}`);
  }

  fs.writeFileSync(fp, js, 'utf8');

  try {
    new vm.Script(js);
    console.log(`  [PASS] VM script check passed for ${fp}`);
  } catch (err) {
    console.error(`  [FAIL] VM script error in ${fp}:`, err);
  }
});
