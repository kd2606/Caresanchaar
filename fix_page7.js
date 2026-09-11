const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

const interfaceStart = code.indexOf('interface IntakeFormState {');
const dobIndex = code.indexOf('dob: string;', interfaceStart);
code = code.substring(0, dobIndex) + 'dob: string;\n  age_years: string;' + code.substring(dobIndex + 'dob: string;'.length);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
