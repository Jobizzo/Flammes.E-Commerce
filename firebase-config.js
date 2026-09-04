// ==============================================
// 🔥 FLAMMES E-COMMERCE — FIREBASE CONFIG
// ==============================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDG_03R6hJ66N4RuZep3bZZDSatGlXvlog",
  authDomain: "flammes-e-commerce.firebaseapp.com",
  projectId: "flammes-e-commerce",
  storageBucket: "flammes-e-commerce.firebasestorage.app",
  messagingSenderId: "1081339702019",
  appId: "1:1081339702019:web:2f48489ec17785be7b9736"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(FIREBASE_CONFIG);
  console.log("✅ Firebase connected — Flammes Cloud Active!");
}
