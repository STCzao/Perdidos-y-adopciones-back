const mongoose = require("mongoose");
const logger = require("../helpers/logger");

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
