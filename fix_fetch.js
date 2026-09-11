const fs = require('fs');
const file = 'src/app/[locale]/dashboard/district/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const startIdx = code.indexOf('const fetchLiveReferrals = async () => {');
const endStr = 'unsubPromise.then(unsub => { if (unsub) unsub(); });\n    };';
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + '// Fetch replaced by hook\n    ' + code.substring(endIdx + endStr.length);
    fs.writeFileSync(file, code);
    console.log('Removed fetchLiveReferrals');
} else {
    console.log('Could not find bounds');
}
