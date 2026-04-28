require("dotenv").config();

const createApp = require("./app");
const { dbConnection, dbDisconnection } = require("./database/config");
const logger = require("./helpers/logger");
const { validateEnv } = require("./helpers/validate-env");

const PORT = process.env.PORT || 3000;

let server;
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn(`Apagado ordenado iniciado por ${signal}`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          return resolve();
        });
      });
    }

    await dbDisconnection();
    logger.info("Proceso finalizado correctamente");
    process.exit(0);
  } catch (error) {
    logger.error("Error durante el apagado ordenado", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

const start = async () => {
  validateEnv();
  await dbConnection();
  const app = createApp();
  server = app.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto: ${PORT}`);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { error: reason?.message || String(reason) });
  void shutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  void shutdown("uncaughtException");
});

start().catch((error) => {
  logger.error("No se pudo iniciar la aplicación", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
