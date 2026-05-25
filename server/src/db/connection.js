// แทน MigrationDB.gs: _getConn(), _withConn(), _sqlQuery(), _sqlExecute()
const sql = require('mssql');
const { getTunnelPort } = require('./tunnel');

function _buildConfig() {
  const tunnelPort = getTunnelPort();
  return {
    server:   tunnelPort ? '127.0.0.1' : process.env.MSSQL_SERVER,
    port:     tunnelPort ?? parseInt(process.env.MSSQL_PORT || '1433'),
    database: process.env.MSSQL_DB,
    user:     process.env.MSSQL_USER,
    password: process.env.MSSQL_PASS,
    options:  { encrypt: false, trustServerCertificate: true },
    pool:     { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout:    30000,
  };
}

let _pool = null;

async function getPool() {
  if (!_pool) _pool = await sql.connect(_buildConfig());
  return _pool;
}

// SELECT → [{ col: val, ... }, ...]
async function query(sqlStr, inputs = {}) {
  const pool = await getPool();
  const req  = pool.request();
  for (const [k, v] of Object.entries(inputs)) req.input(k, v);
  const res = await req.query(sqlStr);
  return res.recordset;
}

// INSERT / UPDATE / DELETE → rowsAffected
async function execute(sqlStr, inputs = {}) {
  const pool = await getPool();
  const req  = pool.request();
  for (const [k, v] of Object.entries(inputs)) req.input(k, v);
  const res = await req.query(sqlStr);
  return res.rowsAffected[0] || 0;
}

// Multi-step ops sharing one transaction — แทน _withConn(fn)
async function withTx(fn) {
  const pool = await getPool();
  const tx   = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    try { await tx.rollback(); } catch (_) {}
    throw e;
  }
}

// ใช้ req จาก transaction (แทน _sqlQueryConn / _sqlExecuteConn)
async function txQuery(tx, sqlStr, inputs = {}) {
  const req = new sql.Request(tx);
  for (const [k, v] of Object.entries(inputs)) req.input(k, v);
  const res = await req.query(sqlStr);
  return res.recordset;
}

async function txExecute(tx, sqlStr, inputs = {}) {
  const req = new sql.Request(tx);
  for (const [k, v] of Object.entries(inputs)) req.input(k, v);
  const res = await req.query(sqlStr);
  return res.rowsAffected[0] || 0;
}

module.exports = { sql, getPool, query, execute, withTx, txQuery, txExecute };
