import { auth, db } from './firebase-config.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const botao = document.getElementById('btn-login');
const link = document.getElementById('link-painel');
const provedor = new GoogleAuthProvider();
botao.addEventListener('click', async () => {
  botao.disabled = true;
  try {
    if (auth.currentUser) await signOut(auth);
    else await signInWithPopup(auth, provedor);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível concluir a autenticação. Tente novamente.');
  } finally {
    botao.disabled = false;
  }
});

onAuthStateChanged(auth, async (usuario) => {
  link.hidden = true;
  if (!usuario) {
    botao.textContent = 'Entrar com Google';
    return;
  }
  botao.textContent = 'Sair (' + (usuario.displayName || 'Minha conta').split(' ')[0] + ')';
  try {
    const ref = doc(db, 'users', usuario.uid);
    let snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        nome: usuario.displayName || 'Cliente',
        email: usuario.email,
        role: 'cliente',
        criadoEm: serverTimestamp()
      });
      snap = await getDoc(ref);
    }
    const paginas = {
      admin: 'advogado.html', estagiario: 'estagiario.html', cliente: 'cliente.html'
    };
    const destino = paginas[snap.data()?.role];
    if (destino) {
      link.href = destino;
      link.hidden = false;
    }
  } catch (erro) {
    console.error('Não foi possível carregar o perfil.', erro);
  }
});
