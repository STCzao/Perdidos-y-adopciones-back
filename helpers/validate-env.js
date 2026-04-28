const REQUIRED_ENV_VARS = [
  "MONGODB_CNN",
  "SECRETORPRIVATEKEY",
  "REFRESH_SECRET",
  "FRONTEND_URL",
];

const REQUIRED_NON_TEST_ENV_VARS = ["RESEND_API_KEY", "RESEND_FROM"];

const INVALID_PLACEHOLDERS = {
  SECRETORPRIVATEKEY: ["your_access_token_secret"],
  REFRESH_SECRET: ["your_refresh_token_secret"],
};

const validateEnv = () => {
  const requiredVars = [
    ...REQUIRED_ENV_VARS,
    ...(process.env.NODE_ENV === "test" ? [] : REQUIRED_NON_TEST_ENV_VARS),
  ];

  const missingVars = requiredVars.filter((key) => !process.env[key] || !process.env[key].trim());
  const placeholderVars = requiredVars.filter((key) =>
    (INVALID_PLACEHOLDERS[key] || []).includes(process.env[key]),
  );

  if (missingVars.length === 0 && placeholderVars.length === 0) {
    return;
  }

  const errores = [];

  if (missingVars.length > 0) {
    errores.push(`faltan variables requeridas: ${missingVars.join(", ")}`);
  }

  if (placeholderVars.length > 0) {
    errores.push(`hay placeholders inseguros en: ${placeholderVars.join(", ")}`);
  }

  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (origins.length === 0) {
      errores.push("ALLOWED_ORIGINS está configurada pero no contiene orígenes válidos");
    }
  }

  throw new Error(`Configuración de entorno inválida: ${errores.join(". ")}`);
};

module.exports = { validateEnv };
