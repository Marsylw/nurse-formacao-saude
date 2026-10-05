# Nurse — implementação dos stages 0–9

Este documento resume a integração de código e o estado funcional das fases de evolução do portal. As alterações de esquema e políticas foram aplicadas ao projecto Supabase existente; **não constituem um conjunto de migrações SQL reexecutável**. Antes de replicar o ambiente ou aplicar alterações noutro projecto, deve ser criada e revista uma história de migrações a partir do esquema e das políticas actuais.

## Modelo e acesso a conteúdos

- Mantém-se o modelo existente (`cursos`, `inscricoes`, `modulos`, `progresso_modulos`, `perfis` e Supabase Auth); não foi criado um segundo modelo de cursos.
- O modelo de módulos foi estendido com descrição e foi adicionada a entidade de materiais para permitir vários conteúdos por módulo.
- Os ficheiros de curso usam o bucket privado `course-materials`; a interface só apresenta materiais publicados ao aluno com inscrição confirmada e cria URLs assinados de curta duração.
- O progresso é guardado por utilizador, curso e módulo. A interface permite concluir e reabrir módulos, e actualiza o resumo de progresso.
- Os testes de autorização da fase 8 foram executados com fixtures temporários e revertidos; não deixam contas nem materiais de teste.

## Registo, administração e operações

- A palavra-passe introduzida no formulário é enviada apenas para Supabase Auth; não é incluída no registo da tabela `inscricoes`. O estado pendente vem do default do servidor e o formulário só associa `user_id` quando existe uma sessão autenticada.
- A área `admin.html` usa `app_metadata.role=admin`, verificado tanto no cliente como pelas políticas RLS. O frontend não atribui privilégios nem usa chaves de serviço.
- A reordenação de módulos é feita pela RPC `admin_reorder_modules`, como operação atómica e `SECURITY INVOKER`.
- A atribuição de uma claim administrativa continua a ser uma operação de provisionamento separada; não é executada pela interface pública.

## Limite de reprodutibilidade

O código deste repositório depende das tabelas, grants, políticas RLS, triggers e RPC existentes no Supabase. Como o histórico foi alterado directamente no projecto Supabase e ainda não está representado numa pasta `supabase/migrations`, este resumo **não substitui** um dump de esquema nem autoriza a execução de DDL. Antes de promover uma nova instância, exportar o estado actual, reconstruir migrações idempotentes e rever permissões com uma role autorizada.
