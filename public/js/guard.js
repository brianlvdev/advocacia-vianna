import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// A navegação é apenas uma proteção da interface. As permissões efetivas
// são determinadas pelas regras do Firestore e do Storage.
export function exigirPapel(papeisPermitidos) {
  if (!Array.isArray(papeisPermitidos) || !papeisPermitidos.length) {
    return Promise.reject(new Error('Nenhum perfil permitido foi informado.'));
  }

  return new Promise((resolve, reject) => {
    let encerrado = false;
    let cancelarObservador = () => {};
    const encerrar = (erro, resultado) => {
      if (encerrado) return;
      encerrado = true;
      cancelarObservador();
      if (erro) reject(erro);
      else resolve(resultado);
    };
    cancelarObservador = onAuthStateChanged(auth, async usuario => {
      if (encerrado) return;
      if (!usuario) {
        encerrar(new Error('É necessário entrar com sua conta.'));
        window.location.replace('index.html');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', usuario.uid));
        const papel = snap.exists() ? snap.data().role : null;
        if (!papeisPermitidos.includes(papel)) {
          encerrar(new Error('Seu perfil não está autorizado a acessar esta página.'));
          window.location.replace('index.html');
          return;
        }
        encerrar(null, { usuario, papel });
      } catch (erro) {
        encerrar(erro);
        window.location.replace('index.html');
      }
    }, erro => {
      encerrar(erro);
      window.location.replace('index.html');
    });
  });
}
