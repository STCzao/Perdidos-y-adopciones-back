const jwt = require("jsonwebtoken");
const logger = require("./logger");

/**
 * Genera Access Token (corta duración - 30 minutos)
 * Se usa para autenticar peticiones normales
 */
const generarAccessToken = (uid = "") => {
  return new Promise((resolve, reject) => {
    const payload = { uid };

    jwt.sign(
      payload,
      process.env.SECRETORPRIVATEKEY,
      {
        expiresIn: "30m", // 30 minutos
      },
      (err, token) => {
        if (err) {
          logger.error("Error al generar access token", {
            error: err.message,
            stack: err.stack,
            uid,
          });
          reject("No se pudo generar el access token");
        } else {
          resolve(token);
        }
      }
    );
  });
};

/**
 * Genera Refresh Token (larga duración - 30 días)
 * Se usa SOLO para renovar el access token
 */
const generarRefreshToken = (uid = "") => {
  return new Promise((resolve, reject) => {
    const payload = { uid, type: "refresh" };

    jwt.sign(
      payload,
      process.env.REFRESH_SECRET, // Secret diferente por seguridad
      {
        expiresIn: "30d", // 30 días
      },
      (err, token) => {
        if (err) {
          logger.error("Error al generar refresh token", {
            error: err.message,
            stack: err.stack,
            uid,
          });
          reject("No se pudo generar el refresh token");
        } else {
          resolve(token);
        }
      }
    );
  });
};

/**
 * Función legacy para compatibilidad
 * Ahora genera access token
 */
const generarJWT = (uid = "") => {
  return generarAccessToken(uid);
};

module.exports = {
  generarJWT,
  generarAccessToken,
  generarRefreshToken,
};
