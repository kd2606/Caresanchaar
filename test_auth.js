const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const app = initializeApp({ projectId: 'demo-project' });
try {
  getAuth(app);
  console.log('getAuth succeeded');
} catch (e) {
  console.log('getAuth failed:', e.message);
}
