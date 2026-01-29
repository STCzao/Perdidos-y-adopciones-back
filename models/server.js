const express = require("express");
const cors = require("cors");
const { dbConnection } = require("../database/config");

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT;

    this.paths = {
      auth: "/api/auth",
      usuarios: "/api/usuarios",
      publicaciones: "/api/publicaciones",
      comunidad: "/api/comunidad",
    };

    // Conectar a base de datos
    this.conectarDB();

    // Middlewares
    this.middlewares();

    // Rutas de mi aplicación
    this.routes();

    // Error handlers (DEBEN IR AL FINAL)
    this.errorHandlers();
  }

  async conectarDB() {
    await dbConnection();
  }

  middlewares() {
    const helmet = require("helmet");
    const mongoSanitize = require("express-mongo-sanitize");
    const rateLimit = require("express-rate-limit");
    const compression = require("compression");

    // ========== COMPRESSION - Reducir bandwidth 60-70% ==========
    this.app.use(compression());

    // ========== HELMET - Headers de Seguridad ==========
    this.app.use(
      helmet({
        contentSecurityPolicy: {
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

    // ========== CORS ==========
    this.app.use(
      cors({
        origin: [
          "http://localhost:5173",
          "http://localhost:3000",
          "https://perdidosyadopciones.com.ar", // dominio de vercel
          "https://www.perdidosyadopciones.com.ar", // dominio original
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "x-token", "Authorization"],
      }),
    );

    // ========== SANITIZACIÓN NoSQL - Previene inyección ==========
    const logger = require("../helpers/logger");
    
    this.app.use(
      mongoSanitize({
        replaceWith: "_",
        onSanitize: ({ req, key }) => {
          logger.warn("Intento de inyección NoSQL detectado", {
            campo: key,
            ip: req.ip,
            url: req.originalUrl,
          });
        },
      }),
    );

    // ========== RATE LIMITING ==========

    //Limitir estricto para login (evita fuerza bruta)
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // Limitar a 5 solicitudes por ventana
      message: {
        success: false,
        msg: "Demasiados intentos de inicio de sesión. Por favor, intente nuevamente después de 15 minutos.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Limiter para forgot-password (evita spam de emails)
    const forgotPasswordLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 3, // Limitar a 3 solicitudes por ventana
      message: {
        success: false,
        msg: "Demasiadas solicitudes de restablecimiento de contraseña. Por favor, intente nuevamente después de 15 minutos.",
      },
    });

    // Limiter para refresh token (evita abuso de renovación)
    const refreshLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 10, // Máximo 10 renovaciones por ventana
      message: {
        success: false,
        msg: "Demasiados intentos de renovación de token. Por favor, intente nuevamente después de 15 minutos.",
      },
    });

    //Limiter general para toda la API
    const generalLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minuto
      max: 100, // Limitar a 100 solicitudes por ventana
      message: {
        success: false,
        msg: "Demasiadas solicitudes. Por favor, intente nuevamente más tarde.",
      },
    });

    //Aplicar limiters a rutas especificas
    this.app.use("/api/auth/login", loginLimiter);
    this.app.use("/api/auth/forgot-password", forgotPasswordLimiter);
    this.app.use("/api/auth/refresh", refreshLimiter);
    this.app.use("/api/usuarios", generalLimiter);
    this.app.use("/api/", generalLimiter);

    // Lectura y parseo del body
    this.app.use(express.json());

    // Directorio público
    this.app.use(express.static("public"));
  }

  routes() {
    this.app.use(this.paths.comunidad, require("../routes/comunidad"));
    this.app.use(this.paths.auth, require("../routes/auth"));
    this.app.use(this.paths.usuarios, require("../routes/usuarios"));
    this.app.use(this.paths.publicaciones, require("../routes/publicaciones"));
  }

  errorHandlers() {
    const { notFound, errorHandler } = require("../middlewares/error-handler");

    // Capturar rutas no encontradas (404)
    this.app.use(notFound);

    // Manejador centralizado de errores (debe ir al final)
    this.app.use(errorHandler);
  }

  listen() {
    const logger = require("../helpers/logger");
    
    this.app.listen(this.port, () => {
      logger.info(`Servidor corriendo en puerto: ${this.port}`);
    });
  }
}

module.exports = Server;
