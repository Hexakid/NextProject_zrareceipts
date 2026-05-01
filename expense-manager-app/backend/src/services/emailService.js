import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter || !to) return { skipped: true };

  await transporter.sendMail({
    from: process.env.SENDER_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });

  return { sent: true };
}
