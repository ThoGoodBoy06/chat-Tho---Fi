const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js')
];

const replacements = [
  // 1. CheckAuth in main.dart
  {
    target: 's=t.P.b(k)&&J.Z(k,"id")!=null?10:12',
    replace: 's=k!=null&&J.Z(k,"id")!=null?10:12',
    desc: 'CheckAuth null-check'
  },
  // 2. Conversations fetch user
  {
    target: 'if(t.P.b(l))n.a=A.aqH(l)',
    replace: 'if(l!=null)n.a=A.aqH(l)',
    desc: 'Conversations user null-check'
  },
  // 3. Register in login_screen.dart
  {
    target: 's=t.P.b(j)?17:18',
    replace: 's=j!=null?17:18',
    desc: 'Register data null-check'
  },
  // 4. Login in login_screen.dart
  {
    target: 's=t.P.b(f)?28:29',
    replace: 's=f!=null?28:29',
    desc: 'Login data null-check'
  },
  // 5. Create conversation response
  {
    target: 's=t.P.b(m)?7:8',
    replace: 's=m!=null?7:8',
    desc: 'Create conversation data null-check'
  },
  // 6. Conversation success
  {
    target: 'if(t.P.b(j)){i=A.wf(j)',
    replace: 'if(j!=null){i=A.wf(j)',
    desc: 'Conversation success null-check'
  }
];

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.log('Skipping missing file:', filePath);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let totalChanged = 0;
  for (const item of replacements) {
    if (content.includes(item.target)) {
      content = content.replace(item.target, item.replace);
      totalChanged++;
      console.log(`[${path.basename(filePath)}] Replaced: ${item.desc}`);
    } else {
      console.warn(`[${path.basename(filePath)}] Target NOT found: ${item.desc}`);
    }
  }
  if (totalChanged > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Successfully updated ${filePath} (${totalChanged} replacements)`);
  }
}
