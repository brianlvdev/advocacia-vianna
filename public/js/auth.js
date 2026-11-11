import { auth, db } from '.js/firebase-config.js';
import {
    GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

const botao = document.getElementById('btn-login');
const provedor = new GoogleAuthProvider();

botao.addEventListener('click', async () => {
    if (auth.currentUser) {
        await signOut(auth);
        return;
    }
    try {
        await signInWithPopup(auth, provedor);
    } catch (erro) {
        console.error(erro);
        alert('Não foi possível entrar. Tente novamente.');
    }
});

onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
        botao.textContent = 'Entrar com Google';
        return;
    }

    botao.textContent = 'Sair (' + usuario.displayName.split(' ')[0] + ')';

    const ref = doc(db, 'users', usuario.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        await setDoc(ref, {
            nome: usuario.displayName,
            email: usuario.email,
            role: 'cliente',
            criadoEm: serverTimestamp()
        });
    }
});