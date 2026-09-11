const fs = require('fs');
let code = fs.readFileSync('src/app/api/district/referrals/route.ts', 'utf8');

code = code.replace(
  /const decoded = await adminAuth\(\)\.verifyIdToken\(token\);/g,
  `const auth = adminAuth();\n      if (!auth) throw new Error('admin_auth_failed');\n      const decoded = await auth.verifyIdToken(token);`
);

code = code.replace(
  /const snap = await adminDb\(\)\.collection/g,
  `const db = adminDb();\n        if (!db) return NextResponse.json({ referrals: [], count: 0, error: 'admin_failed_silently' }, { status: 200 });\n        const snap = await db.collection`
);

fs.writeFileSync('src/app/api/district/referrals/route.ts', code);
