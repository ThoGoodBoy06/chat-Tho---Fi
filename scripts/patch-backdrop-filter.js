const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Search for the backdrop filter application logic:
  // s=$.cZ()
  // if(s===B.ck){A.z(h,"background-color","#000")
  // A.z(h,"opacity","0.2")}else{if(s===B.al){s=g.cy
  // s.toString
  // A.ea(s,"-webkit-backdrop-filter",f.gCR())}s=g.cy
  // s.toString
  // A.ea(s,"backdrop-filter",f.gCR())}
  const pattern = /s=\$\.cZ\(\)\r?\n\s*if\(s===B\.ck\)\{A\.z\(h,"background-color","#000"\)\r?\n\s*A\.z\(h,"opacity","0.2"\)\}else\{if\(s===B\.al\)\{s=g\.cy\r?\n\s*s\.toString\r?\n\s*A\.ea\(s,"-webkit-backdrop-filter",f\.gCR\(\)\)\}s=g\.cy\r?\n\s*s\.toString\r?\n\s*A\.ea\(s,"backdrop-filter",f\.gCR\(\)\)\}/g;

  if (pattern.test(content)) {
    content = content.replace(pattern, `A.z(h,"background-color","rgba(0,0,0,0.22)")
A.z(h,"-webkit-backdrop-filter",f.gCR()||"blur(14px)")
A.z(h,"backdrop-filter",f.gCR()||"blur(14px)")
try{if(g.cy){A.ea(g.cy,"-webkit-backdrop-filter",f.gCR()||"blur(14px)");A.ea(g.cy,"backdrop-filter",f.gCR()||"blur(14px)")}}catch(e){}`);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Successfully patched backdrop-filter in ${path.basename(file)}`);
  } else {
    console.log(`ℹ️ Pattern not matched in ${path.basename(file)}`);
  }
});
