const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Tiago-silva29',
    database: 'spyke'
});

module.exports = pool.promise();