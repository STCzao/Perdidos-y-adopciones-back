const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const mongoose = require("mongoose");
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

const createLimiter = ({ development = {}, production = {}, ...baseConfig }) =>
  rateLimit({
    ...baseConfig,
    ...(process.env.NODE_ENV === "production" ? production : development),
  });

const getAllowedOrigins = (testMode) => {
  if (testMode) return "*";

  const origenesPorDefecto = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://perdidosyadopciones.com.ar",
    "https://www.perdidosyadopciones.com.ar",
  ];

  const origenesDesdeEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origenes = origenesDesdeEnv.length > 0 ? origenesDesdeEnv : origenesPorDefecto;
  return (origin, callback) => {
    if (!origin || origenes.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origen no permitido por CORS"));
  };
};

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
      origin: getAllowedOrigins(testMode),
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-token", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
    }),
  );

  if (testMode) {
    app.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
  } else {
    app.use(
      "/api/auth/login",
      createLimiter({
        windowMs: 15 * 60 * 1000,
        message: {
          success: false,
          msg: "Demasiados intentos de inicio de sesion. Por favor, intente nuevamente despues de 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        production: {
          max: 10,
        },
        development: {
          max: 100,
          skipFailedRequests: true,
        },
      }),
    );

    app.use(
      "/api/auth/forgot-password",
      createLimiter({
        windowMs: 15 * 60 * 1000,
        message: {
          success: false,
          msg: "Demasiadas solicitudes de restablecimiento de contrasena. Por favor, intente nuevamente despues de 15 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        production: {
          max: 3,
        },
        development: {
          max: 20,
          skipFailedRequests: true,
        },
      }),
    );

    app.use(
      "/api/auth/refresh",
      createLimiter({
        windowMs: 5 * 60 * 1000,
        message: {
          success: false,
          msg: "Demasiados intentos de renovacion de token. Por favor, intente nuevamente despues de 5 minutos.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        production: {
          max: 30,
          skipSuccessfulRequests: true,
        },
        development: {
          max: 120,
          skipFailedRequests: true,
        },
      }),
    );

    app.use(
      "/api/usuarios/mi-perfil",
      createLimiter({
        windowMs: 1 * 60 * 1000,
        message: {
          success: false,
          msg: "Demasiadas solicitudes de perfil. Por favor, intente nuevamente mas tarde.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        production: {
          max: 60,
          skipSuccessfulRequests: true,
        },
        development: {
          max: 300,
          skipFailedRequests: true,
        },
      }),
    );

    app.use(
      "/api/",
      createLimiter({
        windowMs: 1 * 60 * 1000,
        message: {
          success: false,
          msg: "Demasiadas solicitudes. Por favor, intente nuevamente mas tarde.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        production: {
          max: 100,
        },
        development: {
          max: 1000,
        },
      }),
    );
  }

  app.use(express.json());
  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  });
  app.use((req, res, next) => {
    req.requestId = req.header("X-Request-Id") || crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
  app.use((req, res, next) => {
    if (req.body) sanitize(req.body, req);
    if (req.query) sanitize(req.query, req);
    if (req.params) sanitize(req.params, req);
    next();
  });

  if (!testMode) {
    app.get("/health", (_req, res) => {
      const databaseOnline = mongoose.connection.readyState === 1;
      const status = databaseOnline ? 200 : 503;

      res.status(status).json({
        success: databaseOnline,
        status: databaseOnline ? "ok" : "degraded",
        database: databaseOnline ? "online" : "offline",
      });
    });

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
