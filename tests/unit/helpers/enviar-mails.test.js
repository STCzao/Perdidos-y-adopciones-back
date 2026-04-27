const mockSend = jest.fn();
const mockResendCtor = jest.fn(() => ({
  emails: {
    send: mockSend,
  },
}));

jest.mock("resend", () => ({
  Resend: mockResendCtor,
}));

jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { enviarEmail } = require("../../../helpers/enviar-mails");

describe("helpers/enviar-mails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "no-reply@test.com";
  });

  test("lanza error si Resend devuelve error sin lanzar excepcion", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        message: "Invalid from address",
        statusCode: 422,
      },
    });

    await expect(
      enviarEmail("user@test.com", "Reset password", "<p>Hola</p>")
    ).rejects.toMatchObject({
      name: "validation_error",
      message: "Invalid from address",
      statusCode: 422,
    });
  });

  test("considera exitoso el envio cuando Resend devuelve un id", async () => {
    mockSend.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    await expect(
      enviarEmail("user@test.com", "Reset password", "<p>Hola</p>")
    ).resolves.toBeUndefined();
  });
});
