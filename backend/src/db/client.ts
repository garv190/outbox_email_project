import mysql from 'mysql2/promise';
import { config } from '../config';

// Parse DATABASE_URL or use individual config
function getConnectionConfig() {
  if (config.database.url) {
    // Parse connection string: mysql://user:password@host:port/database
    const url = new URL(config.database.url);
    return {
      host: url.hostname,
      port: parseInt(url.port || '3306', 10),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading '/'
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3307', 10), // Default to 3307 (Docker mapped port)
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'reachinbox_email',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

// Create connection pool
const pool = mysql.createPool(getConnectionConfig());

// Test connection
pool
  .getConnection()
  .then((connection) => {
    console.log('MySQL connected successfully');
    connection.release();
  })
  .catch((err) => {
    console.error('MySQL connection error:', err);
  });

export default pool;
