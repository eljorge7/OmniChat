const fs = require('fs');
const content = fs.readFileSync('C:/Users/jorge/.gemini/antigravity/brain/e98df17d-4813-4d56-b848-89f8eebc511a/.system_generated/steps/487/content.md', 'utf8');
const urls = content.match(/\/api\/[\w\/-]+/g);
if (urls) {
  console.log(Array.from(new Set(urls)).filter(u => u.includes('pago') || u.includes('factura')));
} else {
  console.log("No urls found");
}
