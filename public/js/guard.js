import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Não substitui Security Rules: impede apenas exibição indevida do painel.
export function exigirPapel(papeisPermitidos) {
  return new Promise((resolve, reject) => {
    const cancelar = onAuthStateChanged(auth, async (usuario) => {
      cancelar();
      if (!usuario) {
        window.location.replace('index.html');
        reject(new Error('Autenticação necessária.'));
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', usuario.uid));
        const papel = snap.exists() ? snap.data().role : null;
        if (!papeisPermitidos.includes(papel)) {
          window.location.replace('index.html');
          reject(new Error('Acesso não autorizado.'));
          return;
        }
        resolve({ usuario, papel });
      } catch (erro) {
        window.location.replace('index.html');
        reject(erro);
      }
    }, (erro) => {
      window.location.replace('index.html');
      reject(erro);
    });
  });
}
