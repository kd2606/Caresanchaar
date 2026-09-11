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

const files = walk('src/app/api');
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes('adminDb') || content.includes('adminAuth')) {
    // We only replace usages that are property accesses or standalone assignments
    // adminDb. -> adminDb().
    // adminAuth. -> adminAuth().
    const newContent = content
      .replace(/adminDb\./g, 'adminDb().')
      .replace(/adminAuth\./g, 'adminAuth().')
      .replace(/const db: Firestore = adminDb;/g, 'const db: Firestore = adminDb();')
      .replace(/const db = adminDb;/g, 'const db = adminDb();');
      
    if (newContent !== content) {
      fs.writeFileSync(file, newContent);
      changed = true;
      count++;
    }
  }
}

console.log(`Updated ${count} files in src/app/api`);
