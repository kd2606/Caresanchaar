const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /return \(\s*<main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">/,
  "return (\n    <main className=\"min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8\">\n      <AIAssistantFAB onDataParsed={handleDataParsed} />"
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
