const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /if \(f\.dob === ''\) \{\s*errs\.dob = t\('validation\.dobRequired'\);\s*\} else \{([\s\S]*?)\}/,
  `if (f.dob !== '') {$1}

    if (f.age_years !== '') {
      const parsedAge = Number(f.age_years);
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) {
        errs.age_years = 'Invalid age (0-130)';
      }
    }`
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
