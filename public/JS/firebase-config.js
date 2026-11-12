
import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

  const firebaseConfig = {
    apiKey: "AIzaSyARXlLaeKJHg48sqrcpiZFEXlIYBIAPNaA",
    authDomain: "advvianna-79689.firebaseapp.com",
    projectId: "advvianna-79689",
    storageBucket: "advvianna-79689.firebasestorage.app",
    messagingSenderId: "226433914433",
    appId: "1:226433914433:web:0b36c8f9269534c89dd8c0",
    measurementId: "G-P8VYSC99ZE"
  };

  const app = initializeApp(firebaseConfig);

  export const auth = getAuth(app);
  export const db = getFirestore(app);
  export const storage = getStorage(app);

