const { Resend } = require("resend");
const logger = require("./logger");

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarEmail = async (to, subject, html) => {
  logger.debug("Intentando enviar correo", {
    destinatario: to,
    asunto: subject,
    from: process.env.RESEND_FROM,
  });

  try {
    const data = await resend.emails.send({
      from: process.env.RESEND_FROM, 
      to: to,
      subject: subject,
      html: html,
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
