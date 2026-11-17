import { supabase } from './supabase-config.js';

// O banco aplica RLS; esta verificação controla a entrada nos painéis.
export async function exigirPapel(papeisPermitidos) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) {
      window.location.replace('index.html');
      throw new Error('Entre na sua conta para acessar o painel.');
    }
    const { data: perfil, error: perfilErro } = await supabase.from('perfis')
      .select('nome,papel').eq('id', data.user.id).single();
    if (perfilErro) throw perfilErro;
    if (!perfil || !papeisPermitidos.includes(perfil.papel)) {
      window.location.replace('index.html');
      throw new Error('Sua conta não tem permissão para acessar este painel.');
    }
    return {
      usuario: { ...data.user, uid: data.user.id, displayName: perfil.nome || 'Minha conta' },
      papel: perfil.papel
    };
  } catch (erro) {
    const aviso = document.getElementById('aviso');
    if (aviso) aviso.textContent = 'Não foi possível abrir o painel. Entre novamente ou tente atualizar a página.';
    throw erro;
  }
}
