# Migração Supabase — testes de API concluídos em 17/11/2026

Branch: codex/migracao-supabase.
Projeto: tqhannrxpdubfmhcclyo (Advocacia Vianna, São Paulo, Free).

## Implementado
- Todos os módulos ativos dos painéis usam backend.js, que acessa Supabase Auth, Postgres e Storage.
- HTML, CSS, logo, endereço e links estáticos permanecem intactos.
- Agenda lista horários de Brasília, reserva, confirma e cancela; restrição de exclusão no banco bloqueia intervalos sobrepostos.
- Casos, documentos privados com links de 60 segundos, tarefas, equipe, fotos e conteúdo institucional.
- RLS nas sete tabelas. Clientes não podem promover seu papel; estagiários veem somente os casos liberados e atribuídos a eles.
- Admin automático exclusivamente para e-mails confirmados brianlucasvianna@gmail.com e advocaciaviannamg@gmail.com.
- As contas não foram criadas antecipadamente: o perfil nasce no primeiro login.
- Cinco migrações aplicadas, inclusive correção dos privilégios das funções.
- Chave publicável no navegador; nenhuma service_role.

## Verificado
- Corrigido guard.js vazio: faltava a exportação exigirPapel, impedindo a execução dos três painéis. O guard agora consulta usuário autenticado e papel no Supabase diretamente.
- node --experimental-vm-modules tests/modules.cjs: verifica as exportações/importações de todos os módulos ativos, incluindo o guard.
- node --experimental-vm-modules tests/panels.cjs: executa os módulos reais com DOM/transporte simulados; verifica adicionar área, salvar conteúdo/horários/tarefa, enviar caso/documento, concluir tarefa e bloquear perfis indevidos.
- Esses testes não substituem a conferência visual manual no Live Server. Os testes de API real abaixo validaram as permissões e a persistência no projeto Supabase.
- node tests/validate.cjs: passou.
- git diff --check: passou.
- supabase/tests.sql executado no projeto com rollback: admins confirmados, bloqueio por metadata, isolamento entre clientes, criação/finalização de caso, conflito de reservas, sobreposição, atribuição/revogação de estagiário e limites de edição de tarefas.
- Testes não deixaram usuários nem registros persistidos.
- Advisor: nenhuma função privilegiada acessível a anon. Avisos de funções SECURITY DEFINER acessíveis a authenticated são esperados para as RPCs; elas conferem identidade/papel/dono internamente.
- Login Google confirmado pelo usuário em sua prévia local.
- tests/supabase-api.cjs passou com quatro sessões reais temporárias: conteúdo institucional salvo e relido; cliente impedido de alterá-lo; foto salva/lida e edição restrita; upload de documento, metadados e download íntegro por proprietário/admin; bloqueio de visitante/outro cliente/estagiário não atribuído; atribuição e revogação; duas reservas concorrentes com exatamente uma vencedora.
- Quatro áreas, endereço e links originais inicializados em perfil_publico, sem sobrescrever registros existentes.
- Corrigida exibição de listas vazias (remoção de todas as áreas/estatísticas), cache da foto e abertura dos documentos antes da espera pela URL.
- A abertura de abas foi verificada estaticamente; não houve automação de navegador nesta rodada.
- Limpeza confirmada: zero contas, arquivos, casos, reservas ou políticas QA restantes; duas contas reais preservadas.

## Google
O provedor está ativado; login validado pelo usuário.
Callback autorizado no Google:
https://tqhannrxpdubfmhcclyo.supabase.co/auth/v1/callback

Manter URL Configuration no Supabase para a origem da prévia local (por exemplo http://localhost:5500/index.html) e os domínios publicados. Para o novo endereço: Site URL https://advocacia-vianna.web.app; Redirect URLs https://advocacia-vianna.web.app/index.html e https://advocacia-vianna.web.app/. Preservar as URLs anteriores.
Não enviar segredo OAuth pelo chat nem adicioná-lo ao repositório.
As URLs assinadas já emitidas podem continuar válidas por até 60 segundos após revogar a atribuição; a geração de novos links é bloqueada imediatamente.

## Repetição dos testes
tests/supabase-api.cjs depende de quatro usuários QA descartáveis com IDs a1712026-0000-4000-8000-000000000001 a 004 e e-mails qa-171-1@example.invalid a qa-171-4@example.invalid. Papéis: cliente, cliente, estagiario, admin. A senha é recebida por QA_PASSWORD, não fica no código. Preparar somente em ambiente de teste e remover os usuários/registros depois.
Para limpar arquivos via API, foi usada uma política temporária de DELETE limitada ao usuário QA 004 e aos nomes casos/<QA001>/<caso>/qa-api-171.txt. A política foi removida ao final. Não foi concedida permissão permanente de excluir documentos reais.
supabase/tests.sql é uma suíte transacional para banco vazio/isolado, não para um banco com as contas reais já cadastradas.

## Limites desta etapa
- O código Firebase antigo permanece versionado para referência, mas não é importado pelos módulos ativos. Não executar deploy de Cloud Functions ou regras Firebase para esta migração.
- Migração integrada à main no PR #4 e publicada após autorização do usuário. Login Google em produção confirmado pelo usuário.
- Abrir a pasta desta branch no Live Server. Uma outra cópia local (por exemplo D:\ADVianna) não recebe as alterações automaticamente: é necessário buscar e selecionar a branch nela, preservando alterações locais.

## Ajustes de casos, agenda e endereços — 17/11/2026
- Diagnóstico: a alteração de status estava persistindo no banco; faltava confirmação junto do caso e a lista era recriada a cada ação. O cartão agora usa a linha retornada pelo Supabase, exibe sucesso/erro e desabilita a ação correspondente ao estado atual, sem recarregar.
- Encaminhamento sempre visível, com escolha explícita do responsável e instruções quando não há estagiários. Recusar remove a atribuição e revoga o acesso.
- Botão de agendamento no início; visitante passa pelo Google e retorna à agenda usando o callback já configurado em index.html.
- Horários ordenados no fuso de Brasília, em listas por dia, duas colunas no computador e uma no celular.
- Logo PNG existente usada como favicon em todas as páginas. Nenhum pixel da logo foi alterado.
- Firebase Hosting com cleanUrls e redirecionamento de index.html para /. Domínio gratuito advocacia-vianna.web.app criado no mesmo projeto; endereço antigo mantido.
- tests/panels.cjs ampliado para aceitar/recusar/atribuir, falha de escrita, equipe vazia, agenda, conflito e retorno do login.
- supabase/tests-casos.sql passou no projeto real: registros fictícios em transação com ROLLBACK, sem modificar casos reais nem políticas.
- tests/navigation.cjs protege o fragmento OAuth e verifica navegação entre seções sem hash. Sem automação de navegador nesta rodada.
