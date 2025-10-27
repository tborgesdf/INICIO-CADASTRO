CI/CD Automatizado (GitHub → MySQL → Vercel)

Visão geral
- Ao fazer push na branch `main`, o GitHub Actions aplica migrações no MySQL remoto e depois dispara um deploy da Vercel via Deploy Hook (opcional).

Como configurar
1) Secrets no GitHub (Settings → Secrets and variables → Actions)
- `DB_HOST=50.116.112.154`
- `DB_USER=deltafox_visto`
- `DB_PASSWORD=<senha>`
- `DB_NAME=deltafox_visto`
- `VERCEL_DEPLOY_HOOK=<URL do Deploy Hook do projeto>` (opcional se você usa auto‑deploy do Vercel)

2) Estrutura de migrações
- Coloque novos arquivos em `repo/sql/migrations/` com nome incremental, ex.: `0002_add_columns.sql`.
- O runner registra execuções em `_migrations` e só aplica arquivos ainda não executados.

3) Comandos locais úteis
- `npm run db:migrate` — aplica migrações no DB configurado no `.env`.
- `npm run db:init` — aplica `sql/schema.sql` (útil para bootstrap, não usado pelo CI).

Fluxo recomendado
- Criar/alterar schema → adicionar arquivo em `sql/migrations/` → commit/push em `main` → GitHub Actions aplica migrações → Vercel deploy automático (ou pelo Deploy Hook).

