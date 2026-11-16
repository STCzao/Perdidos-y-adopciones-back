// Levanta un MongoDB local para desarrollo usando el binario que ya descarga
// mongodb-memory-server (no hace falta instalar MongoDB ni Docker).
// Los datos persisten en ./.mongo-data entre reinicios.
const fs = require("fs");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const PORT = Number(process.env.DEV_DB_PORT || 27017);
const dbPath = path.join(__dirname, "..", ".mongo-data");

(async () => {
  fs.mkdirSync(dbPath, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    instance: { port: PORT, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
  });

  console.log(`MongoDB de desarrollo corriendo en ${mongod.getUri()}`);
  console.log(`Datos en ${dbPath} — Ctrl+C para detener`);

  const stop = async () => {
    await mongod.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})().catch((error) => {
  console.error("No se pudo iniciar MongoDB de desarrollo:", error.message);
  process.exit(1);
});
