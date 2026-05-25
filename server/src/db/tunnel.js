const TUNNEL_LOCAL_PORT = 13433;
let _server = null;

async function startSSHTunnel() {
  if (!process.env.SSH_TUNNEL_HOST) return null;
  const { createTunnel } = require('tunnel-ssh');

  const sshOpts = {
    host:     process.env.SSH_TUNNEL_HOST,
    port:     parseInt(process.env.SSH_TUNNEL_PORT || '22'),
    username: process.env.SSH_TUNNEL_USER,
    password: process.env.SSH_TUNNEL_PASS,
    keepaliveInterval: 10000,
    readyTimeout:      20000,
  };

  const forwardOpts = {
    srcAddr: '127.0.0.1',
    srcPort: TUNNEL_LOCAL_PORT,
    dstAddr: process.env.MSSQL_SERVER,
    dstPort: parseInt(process.env.MSSQL_PORT || '1433'),
  };

  const [server] = await createTunnel(
    { autoClose: false },
    { host: '127.0.0.1', port: TUNNEL_LOCAL_PORT },
    sshOpts,
    forwardOpts,
  );

  _server = server;
  console.log(`[tunnel] 127.0.0.1:${TUNNEL_LOCAL_PORT} → ${process.env.MSSQL_SERVER}:${process.env.MSSQL_PORT}`);
  return TUNNEL_LOCAL_PORT;
}

function isTunnelActive() { return _server !== null; }
function getTunnelPort()   { return _server ? TUNNEL_LOCAL_PORT : null; }

module.exports = { startSSHTunnel, isTunnelActive, getTunnelPort };
