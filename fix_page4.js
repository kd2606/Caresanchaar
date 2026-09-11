const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /interface PatientPayload \{[\s\S]*?\}/,
  `interface PatientPayload {
  name: string;
  abha_id?: string;
  gender: Gender;
  dob?: string | null;
  age_years?: number | null;
  phone?: string;
}`
);

code = code.replace(
  /const patientData: PatientPayload = \{[\s\S]*?dob: form\.dob,[\s\S]*?\};/,
  `const patientData: PatientPayload = {
      name: form.name.trim().replace(/\\s+/g, ' '),
      gender: form.gender as Gender,
      dob: form.dob || null,
      age_years: form.age_years ? Number(form.age_years) : null,
      ...(abha !== '' ? { abha_id: abha } : {}),
      ...(phone !== '' ? { phone } : {}),
    };`
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
