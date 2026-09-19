const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log('Skipping non-existent file:', filePath);
    return;
  }
  console.log('\n--- Processing:', filePath, '---');
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. FIX A.auR.prototype.$0
  const auROld = '$0(){if(this.a&&(this.a.status==="sending"||(this.a.a&&this.a.a.indexOf("optimistic-")===0)))return;';
  const auRNew = `$0(){try{if(this.a){var _st=this.a.status||(this.a.msg&&this.a.msg.status);var _id=this.a.msgId||(this.a.msg&&this.a.msg.a)||(typeof this.a.a==="string"?this.a.a:null);if(_st==="sending"||(_id&&typeof _id==="string"&&(_id.indexOf("optimistic-")===0||_id.indexOf("uploading-")===0||_id.indexOf("temp_")===0)))return;}var _u=(this.a&&(this.a.url||this.a.u))||null;if(_u&&window.openImageModal){window.openImageModal(_u);return;}var s=this.b,r=s.c;r.toString;A.pW(new A.auO(this.a,s),r,t.z);}catch(e){console.warn("auR tap handled:",e);}},`;

  if (content.includes(auROld)) {
    const auRBlockRegex = /\$0\(\)\{if\(this\.a&&\(this\.a\.status==="sending"\|\|\(this\.a\.a&&this\.a\.a\.indexOf\("optimistic-"\)===0\)\)\)return;[\s\S]*?A\.pW\(new A\.auO\(this\.a,s\),r,t\.z\)\},/;
    if (auRBlockRegex.test(content)) {
      content = content.replace(auRBlockRegex, auRNew);
      console.log('✓ Replaced A.auR.prototype.$0 with safe try-catch & string type check');
      modified = true;
    } else {
      console.log('auRBlockRegex did not match, trying direct auROld replacement');
      content = content.replace(auROld, '$0(){if(this.a&&(this.a.status==="sending"||(typeof this.a.a==="string"&&this.a.a.indexOf("optimistic-")===0)))return;');
      modified = true;
    }
  } else {
    console.log('• auROld not found (might already be patched)');
  }

  // 1b. ENRICH c in aaY with c.msg = a, c.status = a.status, c.msgId = a.a
  const cInitTarget = 'c.a=null\r\nif(r!=null){c.url=s;o=c.a=new A.mD';
  const cInitTargetLf = 'c.a=null\nif(r!=null){c.url=s;o=c.a=new A.mD';
  const cInitReplacement = 'c.a=null\r\nc.msg=a;c.msgId=a.a;c.status=a.status;\r\nif(r!=null){c.url=s;o=c.a=new A.mD';
  const cInitReplacementLf = 'c.a=null\nc.msg=a;c.msgId=a.a;c.status=a.status;\nif(r!=null){c.url=s;o=c.a=new A.mD';

  if (content.includes(cInitTarget)) {
    content = content.replace(cInitTarget, cInitReplacement);
    console.log('✓ Attached msg/msgId/status to c in aaY (CRLF)');
    modified = true;
  } else if (content.includes(cInitTargetLf)) {
    content = content.replace(cInitTargetLf, cInitReplacementLf);
    console.log('✓ Attached msg/msgId/status to c in aaY (LF)');
    modified = true;
  }

  // 2. FIX GestureDetector clashes in $.buildPhotoDeckWidget
  // Replace card taps in count === 2:
  const deckTap1Regex = /var tap1 = A\.dr\(null, clip1, B\.M, !1, null, null, null, null, null, null, null, null, secTap1, null, null, null, null, null, null, null, null, null, null, lngPress1, null, new A\.aAlbumDeckTap\(cluster, 0\), null, null, null, null, null, null, !1, B\.ao\);/;
  const deckTap2Regex = /var tap2 = A\.dr\(null, clip2, B\.M, !1, null, null, null, null, null, null, null, null, secTap2, null, null, null, null, null, null, null, null, null, null, lngPress2, null, new A\.aAlbumDeckTap\(cluster, 1\), null, null, null, null, null, null, !1, B\.ao\);/;

  if (deckTap1Regex.test(content)) {
    content = content.replace(deckTap1Regex, 'var tap1 = A.dr(null, clip1, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);');
    console.log('✓ Cleaned tap1 in buildPhotoDeckWidget (removed secTap1 & lngPress1)');
    modified = true;
  }
  if (deckTap2Regex.test(content)) {
    content = content.replace(deckTap2Regex, 'var tap2 = A.dr(null, clip2, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 1), null, null, null, null, null, null, !1, B.ao);');
    console.log('✓ Cleaned tap2 in buildPhotoDeckWidget (removed secTap2 & lngPress2)');
    modified = true;
  }

  // Replace card taps in count === 3:
  const deckTap1_3Regex = /var tap1_3 = A\.dr\(null, clip1_3, B\.M, !1, null, null, null, null, null, null, null, null, secTap1_3, null, null, null, null, null, null, null, null, null, null, lngPress1_3, null, new A\.aAlbumDeckTap\(cluster, 0\), null, null, null, null, null, null, !1, B\.ao\);/;
  const deckTap2_3Regex = /var tap2_3 = A\.dr\(null, clip2_3, B\.M, !1, null, null, null, null, null, null, null, null, secTap2_3, null, null, null, null, null, null, null, null, null, null, lngPress2_3, null, new A\.aAlbumDeckTap\(cluster, 1\), null, null, null, null, null, null, !1, B\.ao\);/;
  const deckTap3_3Regex = /var tap3_3 = A\.dr\(null, clip3_3, B\.M, !1, null, null, null, null, null, null, null, null, secTap3_3, null, null, null, null, null, null, null, null, null, null, lngPress3_3, null, new A\.aAlbumDeckTap\(cluster, 2\), null, null, null, null, null, null, !1, B\.ao\);/;

  if (deckTap1_3Regex.test(content)) {
    content = content.replace(deckTap1_3Regex, 'var tap1_3 = A.dr(null, clip1_3, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);');
    console.log('✓ Cleaned tap1_3 in buildPhotoDeckWidget');
    modified = true;
  }
  if (deckTap2_3Regex.test(content)) {
    content = content.replace(deckTap2_3Regex, 'var tap2_3 = A.dr(null, clip2_3, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 1), null, null, null, null, null, null, !1, B.ao);');
    console.log('✓ Cleaned tap2_3 in buildPhotoDeckWidget');
    modified = true;
  }
  if (deckTap3_3Regex.test(content)) {
    content = content.replace(deckTap3_3Regex, 'var tap3_3 = A.dr(null, clip3_3, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 2), null, null, null, null, null, null, !1, B.ao);');
    console.log('✓ Cleaned tap3_3 in buildPhotoDeckWidget');
    modified = true;
  }

  // 3. REMOVE CAMERA SNACKBAR IN A.av4
  const av4OldRegex = /r=p\.a\.c\.Y\(t\.q\)\s*r\.toString\s*r\.f\.bA\(B\.Dz\)\s*/g;
  if (av4OldRegex.test(content)) {
    content = content.replace(av4OldRegex, '');
    console.log('✓ Removed modal blocking SnackBar r.f.bA(B.Dz) from A.av4');
    modified = true;
  }

  // 4. ELIMINATE SYNCHRONOUS BTOA LOOP IN a2L & a2K
  const btoaLoopRegex = /var _dUrl=\(window\.URL&&window\.URL\.createObjectURL&&_fileObj instanceof Blob\)\?window\.URL\.createObjectURL\(_fileObj\):"";\s*if\(!_dUrl\)\{\s*try\{var _b=new Blob\(\[n\],\{type:l\|\|"image\/jpeg"\}\);_dUrl=window\.URL\.createObjectURL\(_b\);\}catch\(_\)\{\s*var _b64="",_chunk=0x8000;\s*for\(var _ci=0;_ci<n\.length;_ci\+=_chunk\)\{\s*_b64\+=String\.fromCharCode\.apply\(null,n\.subarray\(_ci,Math\.min\(_ci\+_chunk,n\.length\)\)\);\s*\}\s*_dUrl="data:"\+\(l\|\|"image\/jpeg"\)\+";base64,"\+btoa\(_b64\);\s*\}\s*\}/g;

  const safeBlobReplacement = `var _dUrl="";try{if(window.URL&&window.URL.createObjectURL){if(_fileObj instanceof Blob){_dUrl=window.URL.createObjectURL(_fileObj);}else if(n&&n.length){_dUrl=window.URL.createObjectURL(new Blob([n],{type:l||"image/jpeg"}));}}}catch(_e){console.warn("blobUrl err:",_e);}`;

  const btoaMatches = content.match(btoaLoopRegex);
  if (btoaMatches) {
    console.log(`✓ Found ${btoaMatches.length} synchronous btoa loop(s). Replacing with zero-cost Blob URL.`);
    content = content.replace(btoaLoopRegex, safeBlobReplacement);
    modified = true;
  }

  // 5. SAFETY CHECK: Ensure makeCardImg in buildPhotoDeckWidget also checks typeof msg.a === "string"
  const deckSendingOld = 'msg.status === "sending" || (msg.a && (msg.a.indexOf("optimistic-") === 0';
  const deckSendingNew = 'msg.status === "sending" || (msg.a && (typeof msg.a === "string" && msg.a.indexOf("optimistic-") === 0';
  if (content.includes(deckSendingOld)) {
    content = content.replace(deckSendingOld, deckSendingNew);
    console.log('✓ Added string type check in buildPhotoDeckWidget makeCardImg');
    modified = true;
  }

  // 6. SAFETY CHECK: Ensure single bubble video _isSending also checks typeof
  const vidSendingOld = 'var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);';
  const vidSendingNew = 'var _isSending=a.a&&(typeof a.a==="string"&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0));';
  if (content.includes(vidSendingOld)) {
    content = content.replace(vidSendingOld, vidSendingNew);
    console.log('✓ Added string type check in video message bubble');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('>>> Successfully updated and wrote:', filePath);
  } else {
    console.log('>>> No changes needed for:', filePath);
  }
});

console.log('\nAll done patching!');
