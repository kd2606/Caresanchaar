const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /const age = useMemo<number \| null>\(\(\) => {[\s\S]*?}, \[form\.dob\]\);/,
  `const age = useMemo<number | null>(() => {
    if (form.age_years !== '') {
      const parsedAge = Number(form.age_years);
      if (Number.isInteger(parsedAge) && parsedAge >= 0 && parsedAge <= 130) return parsedAge;
    }
    if (form.dob === '') return null;
    const dob = new Date(\`\${form.dob}T00:00:00\`);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let years = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
      years -= 1;
    }
    return years >= 0 && years <= 130 ? years : null;
  }, [form.dob, form.age_years]);`
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
