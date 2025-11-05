import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  GithubAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from 'firebase/auth';
import firebaseConfig from '../config/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
// Request email scope for GitHub
try {
  if (githubProvider && typeof githubProvider.addScope === 'function') {
    githubProvider.addScope('user:email');
  }
} catch (e) {
  // In non-browser/test environments some provider methods may be missing; ignore.
}

window.auth = auth;

export {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  googleProvider,
  githubProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
};
