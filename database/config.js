const mongoose = require("mongoose");
const dns = require("dns");
const logger = require("../helpers/logger");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const dbConnection = async () => {
  try {
    // autoIndex apaga la sincronizacion automatica de indices en produccion:
    // asi, si alguien vuelve a declarar un `expires` mal puesto en un schema,
    // no se aplica solo con reiniciar el servidor. Los indices se manejan
    // manualmente (ej. mongoose.connection.syncIndexes() corrido a mano y revisado).
    await mongoose.connect(process.env.MONGODB_CNN, {
      autoIndex: process.env.NODE_ENV !== "production",
    });
    logger.info("Base de datos online");
  } catch (error) {
    logger.error("Error a la hora de iniciar la base de datos", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Error a la hora de iniciar la base de datos");
  }
};

const dbDisconnection = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  logger.info("Base de datos desconectada");
};

module.exports = {
  dbConnection,
  dbDisconnection,
};
