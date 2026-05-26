require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, getPool, sql } = require('./src/config/db');

(async () => {
  await connectDB();
  const pool = getPool();

  const users = await pool.request().query('SELECT UserID, Username, FullName, IsActive FROM WMS_Users');
  console.log('Users in DB:', JSON.stringify(users.recordset, null, 2));

  const hashed = await bcrypt.hash('Admin@1234', 10);

  if (users.recordset.length === 0) {
    // No users at all — create admin from scratch
    const roles = await pool.request().query("SELECT RoleID FROM WMS_Roles WHERE RoleName='Admin'");
    const roleId = roles.recordset[0]?.RoleID || 1;
    await pool.request()
      .input('Username', sql.NVarChar, 'admin')
      .input('Password', sql.NVarChar, hashed)
      .input('FullName', sql.NVarChar, 'System Administrator')
      .input('RoleID', sql.Int, roleId)
      .query('INSERT INTO WMS_Users (Username, Password, FullName, RoleID, IsActive) VALUES (@Username, @Password, @FullName, @RoleID, 1)');
    console.log('Created admin user');
  } else {
    // Reset admin password
    await pool.request()
      .input('Password', sql.NVarChar, hashed)
      .query("UPDATE WMS_Users SET Password=@Password, IsActive=1 WHERE Username='admin'");
    console.log('Reset admin password to Admin@1234');
  }

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
