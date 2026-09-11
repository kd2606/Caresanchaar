const fs = require('fs');
let code = fs.readFileSync('src/app/api/analytics/district/route.ts', 'utf8');

code = code.replace(
  /const decoded = await adminAuth\(\)\.verifyIdToken\(token\);/g,
  `const auth = adminAuth();\n        if (!auth) throw new Error('admin_auth_failed');\n        const decoded = await auth.verifyIdToken(token);`
);

code = code.replace(
  /const db: Firestore = adminDb\(\);/g,
  `const db = adminDb();\n    if (!db) return ok({ referrals: [], count: 0, error: 'admin_failed_silently' } as any, { ...baseMeta(), reason: 'admin_failed_silently' });`
);

fs.writeFileSync('src/app/api/analytics/district/route.ts', code);
