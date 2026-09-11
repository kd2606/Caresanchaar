const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /dob: string;\n    phone: string;/,
  "dob: string;\n    age_years: string;\n    phone: string;"
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
