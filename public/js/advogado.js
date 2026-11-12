import { exigirPapel } from "./guard.js";
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const { usuario } = await exigirPapel(['admin']);

document.getElementById('boas-vindas').textContent = 'Olá, ' + usuario.displayName;

document.getElementById('btn-sair').addEventListener('click', async() => {
    await signOut(auth);
    window.location.href ='index.html';
})