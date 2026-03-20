// Variables de entorno para el entorno de test
// Este archivo se ejecuta antes de cada test suite (setupFiles en jest.config.js)
process.env.NODE_ENV = "test";
process.env.SECRETORPRIVATEKEY = "test-access-secret-key-for-jest-do-not-use-in-prod";
process.env.REFRESH_SECRET = "test-refresh-secret-key-for-jest-do-not-use-in-prod";
process.env.PORT = "4001";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_FROM = "test@example.com";
