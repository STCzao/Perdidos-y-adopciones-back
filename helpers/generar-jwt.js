const jwt = require("jsonwebtoken");
const logger = require("./logger");
const {
  buildAccessTokenSignOptions,
  buildRefreshTokenSignOptions,
} = require("./jwt-config");

const generarAccessToken = (uid = "") =>
  new Promise((resolve, reject) => {
    jwt.sign(
      { uid, type: "access" },
      process.env.SECRETORPRIVATEKEY,
      buildAccessTokenSignOptions(),
      (err, token) => {
        if (err) {
          logger.error("Error al generar access token", {
            error: err.message,
            stack: err.stack,
            uid,
          });
          reject(new Error("No se pudo generar el access token"));
          return;
        }

        resolve(token);
      },
    );
  });

const generarRefreshToken = (uid = "") =>
  new Promise((resolve, reject) => {
    jwt.sign(
      { uid, type: "refresh" },
      process.env.REFRESH_SECRET,
      buildRefreshTokenSignOptions(),
      (err, token) => {
        if (err) {
          logger.error("Error al generar refresh token", {
            error: err.message,
            stack: err.stack,
            uid,
          });
          reject(new Error("No se pudo generar el refresh token"));
          return;
        }

        resolve(token);
      },
    );
  });

module.exports = {
  generarAccessToken,
  generarRefreshToken,
};
