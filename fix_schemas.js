const fs = require('fs');
let code = fs.readFileSync('src/lib/validation/schemas.ts', 'utf8');

code = code.replace(
  /dob: z[\s\S]*?'dob cannot be in the future'\),/m,
  "dob: z\n    .string()\n    .regex(ISO_DATE, 'dob must be YYYY-MM-DD')\n    .refine((value) => {\n      if (!value) return true;\n      const parsed = Date.parse(`${value}T00:00:00Z`);\n      return Number.isFinite(parsed) && parsed <= Date.now();\n    }, 'dob cannot be in the future')\n    .nullable()\n    .default(null),\n  age_years: z.number().int().min(0).max(130).nullable().default(null),"
);

fs.writeFileSync('src/lib/validation/schemas.ts', code);
