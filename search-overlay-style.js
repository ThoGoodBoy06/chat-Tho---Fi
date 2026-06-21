const fs = require('fs');
const content = fs.readFileSync('public/style.css', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('custom-modal-overlay')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
