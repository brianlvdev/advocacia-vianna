// Regras compartilhadas entre o painel e a apresentação pública.
// Valores são declarados manualmente pelo escritório; não representam
// estatísticas consultadas automaticamente no Jusbrasil.
export const ENDERECO_ESCRITORIO =
  'Alameda Montevideo, 293 - Sala 206 - Nossa Senhora das Dores, Santa Maria - RS, 97050-030';

export function ehTextoTeste(valor) {
  const texto = String(valor ?? '').trim();
  return /^(?:teste|test|rua\s+do\s+doce)(?:[.!?]*)$/i.test(texto);
}
export function enderecoSeguro(valor) {
  const texto = String(valor ?? '').trim();
  return !texto || /rua\s+do\s+doce/i.test(texto) || ehTextoTeste(texto)
    ? ENDERECO_ESCRITORIO : texto;
}
export function limparBioTeste(valor) {
  return String(valor ?? '')
    .replace(/\bteste\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}
// Converte valores numéricos legados como "12%" para 12.
// Retorna null para entradas vazias ou inválidas; nunca inventa percentuais.
export function lerPercentual(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const texto = String(valor).trim().replace(',', '.');
  if (!/^(?:\d{1,3})(?:\.\d{1,2})?\s*%?$/.test(texto)) return null;
  const numero = Number(texto.replace(/\s*%$/, ''));
  return Number.isFinite(numero) && numero >= 0 && numero <= 100 ? numero : null;
}
export function registroTeste(registro) {
  if (!registro || typeof registro !== 'object') return false;
  return ehTextoTeste(registro.rotulo) || ehTextoTeste(registro.titulo);
}
