const mariadb = require('mariadb');

const pool = mariadb.createPool({
host: "localhost",
user: "root",
password: "2609",
database: "nodeapp",
port: 3306
});

module.exports = pool;