const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/ilan-ver-form.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// We want to delete lines 42 to 1154 (1-based).
// In 0-based index: 41 to 1153.
// Number of lines to delete: 1154 - 42 + 1 = 1113.

const startLine = 42;
const endLine = 1154;
const startIndex = startLine - 1;
const count = endLine - startLine + 1;

console.log(`Deleting lines ${startLine} to ${endLine} (${count} lines)...`);
console.log(`Line ${startLine} content: "${lines[startIndex]}"`);
console.log(`Line ${endLine} content: "${lines[endLine - 1]}"`);
console.log(`Line ${endLine + 1} content (should be State management): "${lines[endLine]}"`);

lines.splice(startIndex, count);

fs.writeFileSync(filePath, lines.join('\r\n')); // Preserve Windows line endings if possible, or usually just \n is fine but user is on Windows.
console.log('Done.');
