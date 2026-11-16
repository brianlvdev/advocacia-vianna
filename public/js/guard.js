import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function exigirPapel(papeisPermitidos) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (usuario) => {
      if (!usuario) {
        window.location.href = 'index.html';
        return;
      }
      const snap = await getDoc(doc(db, 'users', usuario.uid));
      const papel = snap.exists() ? snap.data().role : null;

      if (!papeisPermitidos.includes(papel)) {
        window.location.href = 'index.html';
        return;
      }
      resolve({ usuario, papel });
    });
  });
}