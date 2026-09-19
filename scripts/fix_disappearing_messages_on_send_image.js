const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] File not found: ${filePath}`);
    return;
  }
  console.log(`\n===> Patching: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let patchCount = 0;

  function replaceBoth(targetCRLF, replacementCRLF, label) {
    const targetLF = targetCRLF.replace(/\r\n/g, '\n');
    const replacementLF = replacementCRLF.replace(/\r\n/g, '\n');

    if (content.includes(targetCRLF)) {
      content = content.split(targetCRLF).join(replacementCRLF);
      patchCount++;
      console.log(`  [+] Patched ${label} (CRLF)`);
    } else if (content.includes(targetLF)) {
      content = content.split(targetLF).join(replacementLF);
      patchCount++;
      console.log(`  [+] Patched ${label} (LF)`);
    } else {
      console.log(`  [-] Pattern not found for ${label}`);
    }
  }

  // ===================================================================
  // FIX 1: Exclude "sending" / optimistic messages from album clustering
  // ===================================================================
  // The _checkImg function determines if a message is an image.
  // When an optimistic image (status="sending", id starts with "optimistic-")
  // is added to the messages list, the clustering code tries to group it
  // with previous images into a photo album grid. This causes:
  //   1. Previous images to return B.au (0x0 invisible widget)
  //   2. The album grid builder to crash on the optimistic message's
  //      incomplete data (missing .Q reactions, .as timestamp issues, etc.)
  //   3. The entire SliverList to fail rendering → ALL messages disappear
  //
  // Solution: Add a check at the top of _checkImg to EXCLUDE messages
  // that are still "sending" (optimistic). They will be rendered as
  // individual image bubbles with the spinner overlay instead.

  const oldCheckImg = 'function _checkImg(m){if(!m)return!1;';
  const newCheckImg = 'function _checkImg(m){if(!m)return!1;if(m.status==="sending"||(m.a&&(typeof m.a==="string")&&(m.a.indexOf("optimistic-")===0||m.a.indexOf("uploading-")===0||m.a.indexOf("temp_")===0)))return!1;';
  
  replaceBoth(oldCheckImg, newCheckImg, 'exclude sending messages from album clustering');

  // Also handle if _checkImg has a slightly different variant (with m.z check):
  const oldCheckImgAlt = 'function _checkImg(m){if(!m||m.z)return!1;';
  const newCheckImgAlt = 'function _checkImg(m){if(!m||m.z)return!1;if(m.status==="sending"||(m.a&&(typeof m.a==="string")&&(m.a.indexOf("optimistic-")===0||m.a.indexOf("uploading-")===0||m.a.indexOf("temp_")===0)))return!1;';
  
  replaceBoth(oldCheckImgAlt, newCheckImgAlt, 'exclude sending messages from album clustering (alt)');

  // ===================================================================
  // FIX 2: Wrap entire aaY _isSending overlay in try/catch (safety net)
  // ===================================================================
  // This was already done in the previous patch. Verify it's present.
  if (content.includes('if(_isSending){\r\ntry{\r\nvar _spinProgress=new A.cv(')) {
    console.log('  [OK] aaY try/catch spinner already applied');
  } else if (content.includes('if(_isSending){\ntry{\nvar _spinProgress=new A.cv(')) {
    console.log('  [OK] aaY try/catch spinner already applied (LF)');
  } else {
    console.log('  [!] aaY try/catch spinner NOT found - may need separate patch');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[SAVED] ${filePath} with ${patchCount} replacements.`);

  // Verify syntax with Node VM
  try {
    new vm.Script(content);
    console.log(`[PASS] Syntax check passed`);
  } catch (err) {
    console.error(`[FAIL] Syntax error:`, err.message);
    process.exit(1);
  }
}

targetFiles.forEach(patchFile);
console.log('\nAll files processed!');
