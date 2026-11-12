import { auth, db } from './firebase-config.js';
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
    const link = document.getElementById('link-painel');

    if (!usuario) {
        botao.textContent = 'Entrar com Google';
        link.hidden = true;
        return;
    }

    botao.textContent = 'Sair (' + usuario.displayName.split(' ')[0] + ')';

    // 1. Referência ao documento do usuário
    const ref = doc(db, 'users', usuario.uid);
    const snap = await getDoc(ref);

    // 2. Se for novo, cria o perfil
    if (!snap.exists()) {
        await setDoc(ref, {
            nome: usuario.displayName,
            email: usuario.email,
            role: 'cliente',
            criadoEm: serverTimestamp()
        });
    }

    // 3. Mostra o link do painel baseado na role
    const dados = (snap.exists() ? snap : await getDoc(ref)).data();
    const paginas = { admin: "advogado.html", estagiario: "estagiario.html", cliente: "cliente.html" };
    link.href = paginas[dados.role] || "cliente.html";
    link.hidden = false;
});