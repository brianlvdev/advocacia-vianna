// Preencha estas duas variáveis somente com a URL e a chave publicável (anon).
// Nunca coloque a service_role key no navegador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.102.0';

const url = 'https://tqhannrxpdubfmhcclyo.supabase.co';
const anonKey = 'sb_publishable_UiFJpD8r3EbmSZgDp7y0TQ_h0yaxKBO';
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export function exigirSupabaseConfigurado() {
  if (!supabase) throw new Error('Supabase ainda não configurado para este ambiente.');
  return supabase;
}
