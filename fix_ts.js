const fs = require('fs');
const p = require('path');
function walk(d){
  let r=[];
  fs.readdirSync(d).forEach(f=>{
    f=p.join(d,f);
    if(fs.statSync(f).isDirectory()) r=r.concat(walk(f));
    else if (f.endsWith('.ts') || f.endsWith('.tsx')) r.push(f);
  });
  return r;
}

const files = walk('src');
for (const file of files) {
  if (file.includes('admin.ts')) continue;
  if (file.includes('district/referrals')) continue;
  if (file.includes('analytics/district')) continue;
  if (file.includes('facility/list')) continue;

  let code = fs.readFileSync(file, 'utf8');
  let changed = false;
  if (code.includes('adminDb()')) {
    code = code.replace(/adminDb\(\)(?!\!|\.)/g, 'adminDb()!');
    code = code.replace(/adminDb\(\)\./g, 'adminDb()!.');
    changed = true;
  }
  if (code.includes('adminAuth()')) {
    code = code.replace(/adminAuth\(\)(?!\!|\.)/g, 'adminAuth()!');
    code = code.replace(/adminAuth\(\)\./g, 'adminAuth()!.');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(file, code);
  }
}
