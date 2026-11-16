# Advocacia Vianna

Site institucional e área de gestão com Firebase Authentication, Firestore, Storage e Cloud Functions.

## Alterações desta revisão

- Reformulação responsiva da página inicial e dos painéis.
- Correção de falhas de sintaxe e importação nos painéis do advogado e do estagiário.
- Verificação de perfil antes de inicializar painéis e regras Firestore mais restritivas.
- Criação de casos antes do envio de arquivos; controle de tipo, tamanho e associação entre caso e proprietário nas Storage Rules.
- Reservas transacionais via Cloud Functions, incluindo confirmação, cancelamento e limite de solicitações por usuário.
- Página preliminar de informações sobre privacidade (ainda não é uma política completa).

## Instalação e implantação

Atenção: o código no GitHub **não é uma implantação**. É necessário configurar Cloud Functions (plano de faturamento compatível), Firestore, Storage e Authentication no projeto Firebase. O primeiro papel `admin` deve ser concedido exclusivamente por um responsável com autorização no Firebase; o registro público só cria `cliente`.

Instale as dependências de `functions` usando `npm install`, execute `npm run lint` e teste com o Firebase Emulator Suite. Depois de validar em homologação, implante conjuntamente Cloud Functions, regras Firestore, regras Storage e Hosting:

    cd functions
    npm install
    npm run lint
    cd ..
    firebase deploy --only functions,firestore:rules,storage,hosting

O calendário do cliente depende da callable `criarAgendamento`; o painel administrativo depende de `atualizarAgendamento`. Nunca publique só o front-end sem as funções.

## Verificações obrigatórias antes da produção

1. Testar acesso de cliente, estagiário e administrador, inclusive usuários com papéis indevidos.
2. Testar regras do Firestore e Storage no Emulator Suite, incluindo consulta de casos atribuídos e não atribuídos.
3. Testar duas reservas simultâneas, cancelamento, reagendamento e limites de solicitações.
4. Testar upload de arquivos e recuperação de uploads interrompidos; prever limpeza de registros incompletos.
5. Avaliar App Check, monitoramento, alertas de custo, backups e retenção documental.
6. Substituir o texto preliminar de `privacidade.html` por política formal revista, com identificação do controlador, bases legais, compartilhamentos, direitos dos titulares e retenção.
7. Revisar publicidade institucional conforme a regulamentação atual da OAB e confirmar dados profissionais, canais de contato e conteúdo publicado.

Os downloads atuais usam URLs com tokens do Firebase Storage, que podem continuar acessíveis a quem as possuir. Para documentos confidenciais, considere download intermediado por servidor e credenciais temporárias, com revogação. Não compartilhe URLs de arquivos.

**Limitação da revisão:** as alterações foram realizadas por leitura e edição do repositório; não houve execução do Firebase Emulator Suite, testes de integração, deploy nem auditoria de produção. Não considere o ambiente validado para dados jurídicos reais até concluir esses passos.

## Funcionalidades adicionadas à área administrativa e do cliente

- Gestão da disponibilidade e confirmação/cancelamento de reuniões com Google Meet opcional.
- Consulta de horários livres calculada pelo servidor no fuso `America/Sao_Paulo` via callable `listarHorarios`.
- Cliente pode cancelar solicitações de reunião ainda pendentes por `cancelarMeuAgendamento`. Solicitações confirmadas só podem ser canceladas pelo escritório.
- Gestão de solicitações jurídicas: aceitar, recusar, atribuir a estagiário e revogar acesso.
- Gestão da equipe: promoção manual de cliente para papel `estagiario`, mediante confirmação; não há autoatribuição de privilégios.
- Gestão de tarefas: criar e excluir pelo administrador; concluir/reabrir tarefas pelo estagiário designado.
- Estagiário pode abrir documentos exclusivamente de casos atribuídos e liberados.
- Índice composto para consulta de casos atribuídos à equipe.

### Matriz de permissões esperadas

| Recurso | Cliente | Estagiário designado | Administrador |
| --- | --- | --- | --- |
| Ver solicitações de casos | Apenas próprios | Apenas atribuídos e liberados | Todos |
| Anexar documentos no envio inicial | Sim, até finalizar | Não | Foto institucional apenas |
| Abrir documentos jurídicos | Apenas próprios | Somente atribuídos e liberados | Todos |
| Reservar horário disponível | Sim, mediante callable | Não | Não |
| Cancelar solicitação pendente própria | Sim, mediante callable | Não | Administra todas via callable |
| Criar/excluir tarefas | Não | Não | Sim |
| Marcar própria tarefa concluída | Não | Sim | Sim |
| Editar papel de usuário | Não | Não | Sim |

### Pendências de validação

1. Executar o Firebase Emulator Suite e testar efetivamente as regras, principalmente uploads e consultas compostas.
2. Rodar testes de concorrência do agendamento e conferir faturamento/habilitação de Functions.
3. Definir política de exclusão/retomada de envios incompletos (`status: uploading`).
4. Substituir links duradouros do Firebase Storage por estratégia de download temporário para documentação confidencial.
5. Integrar App Check com implementação web e só então ativar enforcement nas callables.
6. Completar política de privacidade, retenção documental, backups, auditoria de acesso e identificação formal do escritório.

**Nota:** as alterações estão exclusivamente na branch de revisão. Não foi feito deploy nem foram testadas contra o projeto Firebase real.
