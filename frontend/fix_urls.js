const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    let filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('./src');
let modifiedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let before = content;
  content = content.replace(/\$\{process\.env\.NEXT_PUBLIC_API_URL \|\| "\$\{process\.env\.NEXT_PUBLIC_API_URL \|\| "http:\/\/localhost:3002"\}"\}/g, '${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}');
  if (content !== before) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
  }
});
console.log('Fixed', modifiedCount, 'files.');
