const WHATSAPP = '5531993871781';
const mensagem = encodeURIComponent('Olá, Dra. Ludmila Vianna ');

document.getElementById('link-whats').href = 'https://api.whatsapp.com/send?phone=5531993871781&text=Ol%C3%A1%2C+Dra.Ludmila+Vianna' + WHATSAPP + '?text=' + mensagem;