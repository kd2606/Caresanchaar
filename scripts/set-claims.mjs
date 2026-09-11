import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const auth = getAuth(app);
const db = getFirestore(app);

const TARGETS = [
  {
    email: 'alimazaarihamza@gmail.com',
    claims: { role: 'worker', worker: true, district: 'Gadchiroli' },
    profile: { role: 'worker', district: 'Gadchiroli', state: 'Maharashtra' },
  },
  {
    email: 'singhrangijaskeerat@gmail.com',
    claims: { role: 'mo', mo: true, admin: true, district: 'Gadchiroli', facilityId: 'fac_gadchiroli_dh' },
    profile: { role: 'mo', district: 'Gadchiroli', jurisdiction: 'Gadchiroli', facilityId: 'fac_gadchiroli_dh' },
  },
];

for (const t of TARGETS) {
  const user = await auth.getUserByEmail(t.email);
  await auth.setCustomUserClaims(user.uid, t.claims);
  await db.collection('users').doc(user.uid).set(t.profile, { merge: true });
  console.log('OK', t.email, user.uid, JSON.stringify(t.claims));
}
process.exit(0);
