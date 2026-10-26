// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Firebase Auth 추가

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPpkCFKHdbkjeQQnJ4vQ6X1RWwy30Mch4",
  authDomain: "spark-and-park-7662d.firebaseapp.com",
  projectId: "spark-and-park-7662d",
  storageBucket: "spark-and-park-7662d.firebasestorage.app",
  messagingSenderId: "148195628868",
  appId: "1:148195628868:web:b04dcab42d3a8fe17e6911"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();