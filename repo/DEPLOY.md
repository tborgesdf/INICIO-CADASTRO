Guia de implantação (Vercel ou HostGator)

Visão geral
- O projeto é um app Vite (React + TS) com uma API serverless para salvar os dados em MySQL.
- A API está em `api/save-user.ts` e usa `mysql2` para conectar no MySQL remoto.
- O schema do banco está em `sql/schema.sql`.

1) Banco MySQL remoto
- Host: `50.116.112.154`
- Usuário: `deltafox_Federal_Express`
- Senha: `Ale290800-####$2`
- Banco novo: `detalfox_Federal_Express` (observação: há diferença entre "deltafox" vs "detalfox" no pedido; confirme o nome correto.)

Passos
1. Abra o MySQL Workbench (ou Adminer/phpMyAdmin) apontando para `50.116.112.154` com o usuário e senha informados.
2. Execute o conteúdo de `sql/schema.sql` para criar o banco e as tabelas.
   - Caso o banco já exista com outro nome, ajuste o `USE <nome_banco>;` e atualize `DB_NAME` no `.env`.

2) Variáveis de ambiente
Crie um arquivo `.env` local (baseado em `.env.example`):
- `DB_HOST=50.116.112.154`
- `DB_USER=deltafox_Federal_Express`
- `DB_PASSWORD=Ale290800-####$2`
- `DB_NAME=detalfox_Federal_Express`
- Para a API do Gemini (caso use):
  - `VITE_API_KEY=<sua_chave>` (exposta no client via Vite)
  - `API_KEY=<sua_chave>` (se quiser usar também no server)

Importante (Vite):
- No código client, variáveis precisam do prefixo `VITE_`. O projeto atual usa `process.env.API_KEY`. Se precisar, troque para `import.meta.env.VITE_API_KEY` nas chamadas do client.

3) Rodar localmente
- Requisitos: Node 18+.
- Instale dependências: `npm install`
- Rode em dev: `npm run dev`
- A API local fica em `http://localhost:5173/api/save-user` via Vercel? Não. Em dev, essa rota não existe por padrão. Para testar a API localmente, use `vercel dev` ou configure um proxy do Vite. Alternativas:
  - Instale o CLI da Vercel e rode `vercel dev` (recomendado para testar as serverless).

4) Deploy na Vercel (recomendado)
- Importe o repositório no painel da Vercel.
- Build Command: `vite build`
- Output Directory: `dist`
- Configure as variáveis no projeto (Settings > Environment Variables):
  - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `VITE_API_KEY` (se necessário no client)
- As rotas serverless ficarão disponíveis em `/api/save-user` no mesmo domínio do front.

5) Deploy na HostGator (alternativa)
- Frontend: faça o build local `npm run build` e publique o conteúdo da pasta `dist/` no diretório do seu domínio.
- Backend:
  - HostGator geralmente não executa funções serverless Node no mesmo host do estático.
  - Opção A: mantenha a API na Vercel e o front na HostGator. Nesse caso, ajuste o `fetch` em `services/databaseService.ts` para apontar para a URL pública da API (ex.: `https://seu-projeto.vercel.app/api/save-user`) e habilite CORS na função.
  - Opção B: criar um endpoint em PHP no HostGator que conecte ao MySQL e receba o POST. (Forneço o esqueleto se desejar.)

6) Teste de ponta a ponta
- Acesse o app, preencha CPF/Telefone/Email, redes sociais (opcional), tipo de visto e países.
- Ao finalizar, os dados devem ser gravados nas tabelas: `users`, `user_social_media`, `user_countries`.
- Valide via Workbench com: `SELECT * FROM users ORDER BY id DESC LIMIT 5;`

7) Segurança e notas
- Não faça commit de `.env` com segredos.
- Restrinja o usuário MySQL às permissões necessárias no banco específico.
- Se publicar o front na HostGator e a API na Vercel, configure CORS e HTTPS.

Dúvidas comuns
- Erro 500 ao salvar: verifique variáveis `DB_*` no ambiente da Vercel e se as tabelas foram criadas.
- API_KEY do Gemini no client: use `import.meta.env.VITE_API_KEY` e defina `VITE_API_KEY` no painel da Vercel.

