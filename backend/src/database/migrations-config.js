require('dotenv').config();

// Las migraciones aplican solo a la conexión principal (cddiputados).
const base = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  dialect: 'mysql',
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
