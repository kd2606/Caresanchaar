const fs = require('fs');
const file = 'src/app/[locale]/dashboard/district/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const fetchLiveReferrals[\s\S]*?unsubPromise\.then[^\}]+\}\);\s*\};/g, '// Fetch replaced by hook');
fs.writeFileSync(file, code);
console.log('Removed fetchLiveReferrals via regex');
