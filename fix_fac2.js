const fs = require('fs');
const file = 'src/app/[locale]/dashboard/district/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/target_facility/g, "facilityId");

fs.writeFileSync(file, code);
console.log('Fixed target_facility again');
