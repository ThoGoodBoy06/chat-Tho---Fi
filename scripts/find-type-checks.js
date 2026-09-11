const fs = require('fs');

const content = fs.readFileSync('flutter_frontend/build/web/main.dart.js', 'utf8');

// Search for /chat/conversations
const convIdx = content.indexOf('/chat/conversations');
console.log('=== CONVERSATIONS CODE ===');
console.log(content.slice(convIdx - 100, convIdx + 500));

// Search for "Conversations"
let idx = 0;
while ((idx = content.indexOf('"Conversations"', idx)) !== -1) {
  console.log('=== "Conversations" at', idx, '===');
  console.log(content.slice(idx - 60, idx + 140));
  idx += 15;
}

// Search for ConversationModel.fromJson
// In models.dart: final json = (rawJson['Conversations'] is Map<String, dynamic>)
