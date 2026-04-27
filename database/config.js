const mongoose = require("mongoose");
const dns = require("dns");
const logger = require("../helpers/logger");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const dbConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CNN);
    logger.info("Base de datos online");
  } catch (error) {
    logger.error("Error a la hora de iniciar la base de datos", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Error a la hora de iniciar la base de datos");
  }
};

module.exports = {
  dbConnection,
};
