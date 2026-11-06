import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDps1Lm1QYMe_BN_VU0DrZlvkqNlnokafs",
  authDomain: "oksana-school.firebaseapp.com",
  projectId: "oksana-school",
  storageBucket: "oksana-school.firebasestorage.app",
  messagingSenderId: "78341870659",
  appId: "1:78341870659:web:b82e581112a16302ff30f6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);