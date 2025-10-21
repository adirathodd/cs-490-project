// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAATKgBgW_-rFOhtkQrZaG6OHW4uBlyvuI",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "ats-candidate-system.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "ats-candidate-system",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "ats-candidate-system.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abc123"
};

export default firebaseConfig;
