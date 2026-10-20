import nodemailer, { type Transporter } from "nodemailer";

/** Thrown when SMTP settings are missing, so the API can explain what to fix. */
export class MailerNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`SMTP is not configured. Missing: ${missing.join(", ")}`);
    this.name = "MailerNotConfiguredError";
  }
}

// Reused between sends, but rebuilt if the SMTP settings change (e.g. .env.local
// edited while `next dev` is running).
let cached: { settings: string; transporter: Transporter } | null = null;

function smtpConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  const missing = Object.entries({ SMTP_HOST, MAIL_FROM })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) throw new MailerNotConfiguredError(missing);

  return {
    from: MAIL_FROM as string,
    transport: {
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE === "true",
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    },
  };
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

/** Sends through the SMTP server in .env.local. Credentials never leave the server. */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const { from, transport } = smtpConfig();
  const settings = JSON.stringify(transport);
  if (cached?.settings !== settings) {
    cached = { settings, transporter: nodemailer.createTransport(transport) };
  }
  await cached.transporter.sendMail({ from, ...email });
}
