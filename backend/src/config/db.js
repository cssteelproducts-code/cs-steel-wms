const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_SERVER || '180.183.246.215',
  port: parseInt(process.env.DB_PORT) || 54321,
  database: process.env.DB_NAME || 'WMS',
  user: process.env.DB_USER || 'css_transport',
  password: process.env.DB_PASSWORD || 'C$$_Tr0n$port',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
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
