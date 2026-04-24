const { Resend } = require("resend");
const logger = require("./logger");

let resendClient;

const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no esta configurada");
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
};

const enviarEmail = async (to, subject, html) => {
  logger.debug("Intentando enviar correo", {
    destinatario: to,
    asunto: subject,
    from: process.env.RESEND_FROM,
  });

  try {
    if (!process.env.RESEND_FROM) {
      throw new Error("RESEND_FROM no esta configurado");
    }

    const resend = getResendClient();
    const data = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to,
      subject,
      html,
    });

    logger.info("Correo enviado exitosamente", {
      destinatario: to,
      asunto: subject,
      messageId: data.id,
    });
  } catch (error) {
    logger.error("Error al enviar correo", {
      error: error.message,
      stack: error.stack,
      destinatario: to,
      asunto: subject,
      response: error?.response,
    });

    throw error;
  }
};

module.exports = { enviarEmail };
