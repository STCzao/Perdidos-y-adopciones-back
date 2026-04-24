require("dotenv").config();

const createApp = require("./app");
const { dbConnection } = require("./database/config");
const logger = require("./helpers/logger");

const PORT = process.env.PORT || 3000;

const start = async () => {
  await dbConnection();
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto: ${PORT}`);
  });
};

start();
