const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('adminDb()') || line.includes('adminAuth()')) {
      // Check if it's inside a function or class
      // Rough heuristic: if it has zero indentation or is top level export
      if (line.startsWith('export const adminDb =') || line.startsWith('export const adminAuth =')) continue;
      if (line.trim() === line && !line.startsWith('}')) {
        console.log(`POTENTIAL TOP-LEVEL: ${file}:${i+1}: ${line}`);
      }
    }
  }
}
