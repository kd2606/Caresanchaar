const fs = require('fs');
let code = fs.readFileSync('src/app/api/facility/list/route.ts', 'utf8');

code = code.replace(
  /decoded = await adminAuth\(\)\.verifyIdToken\(token\);/g,
  `const auth = adminAuth();\n      if (!auth) throw new Error('admin_auth_failed');\n      decoded = await auth.verifyIdToken(token);`
);

code = code.replace(
  /const profile = await adminDb\(\)\.collection/g,
  `const db = adminDb();\n      if (!db) throw new Error('admin_db_failed');\n      const profile = await db.collection`
);

code = code.replace(
  /await adminAuth\(\)\.setCustomUserClaims/g,
  `const auth2 = adminAuth();\n        if (auth2) await auth2.setCustomUserClaims`
);

code = code.replace(
  /const col = adminDb\(\)\.collection/g,
  `const db = adminDb();\n    if (!db) return NextResponse.json({ ...EMPTY, error: 'admin_failed_silently' }, { status: 200 });\n    const col = db.collection`
);

fs.writeFileSync('src/app/api/facility/list/route.ts', code);
