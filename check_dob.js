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
walk('src').forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('.dob')) console.log(f);
});
