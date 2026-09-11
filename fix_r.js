const fs = require('fs');
const file = 'src/app/[locale]/dashboard/district/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/r\.status !== 'CLOSED'/g, "r.status !== 'completed'");
code = code.replace(/r\.isBreached/g, "r.slaBreached");
code = code.replace(/r\.fbId === scheduleRef/g, "r.id === scheduleRef");
code = code.replace(/r\.fbId === outcomeRef/g, "r.id === outcomeRef");

fs.writeFileSync(file, code);
console.log('Fixed r. properties');
