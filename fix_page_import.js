const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /import \{ Select, SelectContent, SelectItem, SelectTrigger, SelectValue \} from "@\/components\/ui\/select";/,
  `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";\nimport { AIAssistantFAB, type ParsedIntakeData } from '@/components/worker/AIAssistantFAB';`
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);
