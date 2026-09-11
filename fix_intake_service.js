const fs = require('fs');
let code = fs.readFileSync('src/lib/services/intake.service.ts', 'utf8');

code = code.replace(
  /dob: patientInput\.dob,/g,
  "dob: patientInput.dob || null,\n              age_years: patientInput.age_years || null,"
);

fs.writeFileSync('src/lib/services/intake.service.ts', code);
