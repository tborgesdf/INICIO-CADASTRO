// Executa o arquivo sql/schema.sql no MySQL remoto usando mysql2
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const sqlPath = path.resolve(__dirname, '..', 'sql', 'schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Arquivo SQL não encontrado:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { DB_HOST, DB_USER, DB_PASSWORD } = process.env;
  // Não passamos database aqui para permitir CREATE DATABASE
  if (!DB_HOST || !DB_USER || !DB_PASSWORD) {
    console.error('Defina DB_HOST, DB_USER e DB_PASSWORD no .env');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    console.log('Conectado. Executando schema.sql...');
    await connection.query(sql);
    console.log('Schema aplicado com sucesso.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Erro ao executar SQL:', err && err.message ? err.message : err);
  process.exit(1);
});

