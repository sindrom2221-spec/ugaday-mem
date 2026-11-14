// Выбор хранилища. Пока DATABASE_URL не задан, сохраняется текущий SQLite-запуск.
require("dotenv").config();
if (process.env.DATABASE_URL) {
  console.log("Используется внешняя база PostgreSQL.");
  require("./server-postgres");
} else {
  console.log("DATABASE_URL не задан — используется прежняя SQLite-база.");
  require("./server");
}
