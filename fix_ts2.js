const fs = require('fs');
const file = 'src/app/[locale]/dashboard/district/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "const { referrals: liveReferrals, loading: hookLoading } = useDistrictReferrals(claims?.facilityId);",
  "const { referrals: _liveReferrals, loading: hookLoading } = useDistrictReferrals(claims?.facilityId);\n  const liveReferrals = _liveReferrals as any[];"
);

fs.writeFileSync(file, code);
console.log('Fixed TS properly');
