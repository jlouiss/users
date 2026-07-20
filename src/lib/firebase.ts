import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCx57_he63aLJPmYhHr0JguVCY9DqUDng8',
  authDomain: 'users-d64d9.firebaseapp.com',
  projectId: 'users-d64d9',
  storageBucket: 'users-d64d9.firebasestorage.app',
  messagingSenderId: '1088531605722',
  appId: '1:1088531605722:web:500af2ec911cfbceb3dde3',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
