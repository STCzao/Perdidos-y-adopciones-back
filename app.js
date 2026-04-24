const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const logger = require("./helpers/logger");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/usuarios");
const publicationRoutes = require("./routes/publicaciones");
const communityRoutes = require("./routes/comunidad");
const { notFound, errorHandler } = require("./middlewares/error-handler");

const sanitize = (obj, req) => {
  if (typeof obj !== "object" || obj === null) return obj;

  Object.keys(obj).forEach((key) => {
    if (key.startsWith("$") || key.includes(".")) {
      logger.warn("Intento de inyeccion NoSQL detectado", {
        campo: key,
        ip: req.ip,
        url: req.originalUrl,
      });
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      sanitize(obj[key], req);
    }
  });

  return obj;
};

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.split("=");
    if (!rawKey) return acc;
    const key = rawKey.trim();
    const value = rawValue.join("=").trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value || "");
    return acc;
  }, {});

const createApp = ({ testMode = false } = {}) => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: testMode
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
              fontSrc: ["'self'", "fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            },
          },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: testMode
        ? "*"
        : [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://perdidosyadopciones.com.ar",
            "https://www.perdidosyadopciones.com.ar",
          ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-token", "Authorization"],
    }),
  );

  app.use((req, res, next) => {
    if (req.body) sanitize(req.body, req);
    if (req.query) sanitize(req.query, req);
    if (req.params) sanitize(req.params, req);
    next();
  });

  if (testMode) {
    app.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
  } else {
    app.use(
      "/api/auth/login",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: {
          success: false,
          msg: "Demasiados intentos de inicio de sesion. Por favor, intente nuevamente despues de 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );

    app.use(
      "/api/auth/forgot-password",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 3,
        message: {
          success: false,
          msg: "Demasiadas solicitudes de restablecimiento de contrasena. Por favor, intente nuevamente despues de 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );

    app.use(
      "/api/auth/refresh",
      rateLimit({
        windowMs: 5 * 60 * 1000,
        max: 30,
        message: {
          success: false,
          msg: "Demasiados intentos de renovacion de token. Por favor, intente nuevamente despues de 5 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
      }),
    );

    app.use(
      "/api/usuarios/mi-perfil",
      rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 60,
        message: {
          success: false,
          msg: "Demasiadas solicitudes de perfil. Por favor, intente nuevamente mas tarde.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
      }),
    );

    app.use(
      "/api/",
      rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 100,
        message: {
          success: false,
          msg: "Demasiadas solicitudes. Por favor, intente nuevamente mas tarde.",
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
  }

  app.use(express.json());
  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  });

  if (!testMode) {
    app.use("/api/auth", (req, res, next) => {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      });
      next();
    });

    app.use(express.static("public"));
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/usuarios", userRoutes);
  app.use("/api/publicaciones", publicationRoutes);
  app.use("/api/comunidad", communityRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
