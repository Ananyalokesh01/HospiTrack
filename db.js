// db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'hospitaldb',
    password: 'ananya',
    port: 5432,
});

module.exports = pool;
