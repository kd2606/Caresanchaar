import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, GeoPoint } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

const MO_UID = 'PASTE_MO_UID_FROM_STEP_0';

const facilities = [
  {
    id: 'fac_gadchiroli_dh',
    data: {
      name: 'Gadchiroli District Hospital',
      type: 'district_hospital',
      level: 3,
      district: 'Gadchiroli',
      block: 'Gadchiroli',
      state: 'Maharashtra',
      address: 'Complex Road, Gadchiroli, Maharashtra 442605',
      pincode: '442605',
      contactPhone: '+911234567890',
      geo: new GeoPoint(20.1809, 80.0035),
      services: ['general_opd', 'anc', 'immunization', 'laboratory', 'emergency', 'inpatient', 'surgery'],
      specialities: ['general_medicine', 'obstetrics', 'paediatrics'],
      beds: { total: 200, available: 24 },
      acceptsReferrals: true,
      isActive: true,
      adminUids: [MO_UID],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  },
  {
    id: 'fac_gadchiroli_chc_armori',
    data: {
      name: 'CHC Armori',
      type: 'chc',
      level: 2,
      district: 'Gadchiroli',
      block: 'Armori',
      state: 'Maharashtra',
      address: 'Main Road, Armori, Gadchiroli, Maharashtra 441208',
      pincode: '441208',
      contactPhone: '+911234567891',
      geo: new GeoPoint(20.4667, 79.9833),
      services: ['general_opd', 'anc', 'immunization', 'laboratory', 'inpatient'],
      specialities: ['general_medicine', 'obstetrics'],
      beds: { total: 30, available: 8 },
      acceptsReferrals: true,
      isActive: true,
      adminUids: [MO_UID],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  },
  {
    id: 'fac_gadchiroli_phc_dhanora',
    data: {
      name: 'PHC Dhanora',
      type: 'phc',
      level: 1,
      district: 'Gadchiroli',
      block: 'Dhanora',
      state: 'Maharashtra',
      address: 'Dhanora, Gadchiroli, Maharashtra 442606',
      pincode: '442606',
      contactPhone: '+911234567892',
      geo: new GeoPoint(20.4500, 80.1667),
      services: ['general_opd', 'anc', 'immunization'],
      specialities: ['general_medicine'],
      beds: { total: 6, available: 3 },
      acceptsReferrals: true,
      isActive: true,
      adminUids: [MO_UID],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  },
];

for (const f of facilities) {
  await db.collection('facilities').doc(f.id).set(f.data, { merge: true });
  console.log('seeded', f.id);
}
process.exit(0);
