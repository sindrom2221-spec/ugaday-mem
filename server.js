// Точка входа, совместимая с текущей командой Render: node server.js
// При наличии DATABASE_URL используем Neon PostgreSQL, иначе старый SQLite.
require("dotenv").config();

if (process.env.DATABASE_URL) {
  console.log("Используется внешняя база PostgreSQL.");
  require("./server-postgres");
} else {
  console.log("DATABASE_URL не задан — используется прежняя SQLite-база.");
  require("./server-sqlite");
}
