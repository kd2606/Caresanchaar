const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /dob: string;/,
  "dob: string;\n  age_years: string;"
);

code = code.replace(
  /dob: '',/,
  "dob: '',\n    age_years: '',"
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
