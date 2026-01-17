/**
 * Script to promote a user to Admin role
 * Usage: npx tsx scripts/promote-admin.ts <email>
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2] || 'dustin.sitar@brite.co';

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyFile) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS not set');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId: process.env.GCP_PROJECT_ID,
});

const db = getFirestore();

async function promoteToAdmin() {
  console.log(`Looking for user: ${email}`);

  const snapshot = await db.collection('users').where('email', '==', email).get();

  if (snapshot.empty) {
    console.log('User not found');
    process.exit(1);
  }

  const doc = snapshot.docs[0];
  const userData = doc.data();
  console.log(`Found user: ${userData.name || userData.email} (current role: ${userData.role})`);

  await doc.ref.update({ role: 'Admin', updated_at: new Date().toISOString() });
  console.log(`Successfully updated ${email} to Admin role`);
}

promoteToAdmin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
