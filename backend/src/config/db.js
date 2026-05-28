const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_SERVER || process.env.MSSQL_SERVER,
  port: parseInt(process.env.DB_PORT || process.env.MSSQL_PORT) || 54321,
  database: process.env.DB_NAME || process.env.MSSQL_DB || 'WMS',
  user: process.env.DB_USER || process.env.MSSQL_USER,
  password: process.env.DB_PASSWORD || process.env.MSSQL_PASS,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  },
  pool: {
    max: 30,
    min: 2,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 15000
  }
};

let pool = null;

const connectDB = async () => {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to MSSQL database:', process.env.DB_NAME || 'WMS');
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
};

const getPool = () => {
  if (!pool) throw new Error('Database not connected. Call connectDB() first.');
  return pool;
};

const closeDB = async () => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};

module.exports = { sql, connectDB, getPool, closeDB };
