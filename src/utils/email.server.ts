import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

const isEmailEnabled = Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);

const transporter = isEmailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

export const sendEmail = async (to: string, subject: string, text: string) => {
  if (!isEmailEnabled || !transporter) {
    return { skipped: true, reason: "SMTP not configured" };
  }

  const from = SMTP_FROM as string;
  await transporter.sendMail({ from, to, subject, text });
  return { skipped: false };
};
