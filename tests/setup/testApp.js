// App express para E2E — replica el pipeline de models/server.js
// sin llamar a dbConnection() ya que el test setup gestiona la conexión.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(compression());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: "*", credentials: true }));

  // NoSQL sanitization (mismo algoritmo que models/server.js)
  const sanitize = (obj) => {
    if (typeof obj !== "object" || obj === null) return obj;
    Object.keys(obj).forEach((key) => {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key];
      } else if (typeof obj[key] === "object") {
        sanitize(obj[key]);
      }
    });
    return obj;
  };

  app.use((req, res, next) => {
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    next();
  });

  // Rate limiter muy permisivo para tests
  app.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
  app.use(express.json());

  // Rutas
  app.use("/api/auth", require("../../routes/auth"));
  app.use("/api/usuarios", require("../../routes/usuarios"));
  app.use("/api/publicaciones", require("../../routes/publicaciones"));
  app.use("/api/comunidad", require("../../routes/comunidad"));

  // Error handlers
  const { notFound, errorHandler } = require("../../middlewares/error-handler");
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
