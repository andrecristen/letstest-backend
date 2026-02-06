import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    APP_URL,
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

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    if (!isEmailEnabled || !transporter) {
        console.log(`[Email] SMTP not configured. Would send to ${to}: ${subject}`);
        return { skipped: true, reason: "SMTP not configured" };
    }

    const from = SMTP_FROM as string;
    await transporter.sendMail({ from, to, subject, text, html });
    return { skipped: false };
};

// Template directory - can be customized
const templatesDir = path.join(__dirname, "../templates/email");

// Load template from file or use default
const loadTemplate = (templateName: string, defaultTemplate: string): string => {
    const templatePath = path.join(templatesDir, `${templateName}.html`);
    try {
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, "utf-8");
        }
    } catch (error) {
        console.log(`[Email] Template ${templateName} not found, using default`);
    }
    return defaultTemplate;
};

// Replace variables in template: {{variableName}}
const renderTemplate = (template: string, variables: Record<string, string>): string => {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), value);
    }
    return rendered;
};

// Default invite template
const DEFAULT_INVITE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Convite para {{organizationName}}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo img { max-width: 150px; }
        h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
        p { color: #666; margin-bottom: 15px; }
        .highlight { color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #333; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        .role-badge { display: inline-block; background: #e5e5e5; padding: 4px 12px; border-radius: 20px; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo">
                <h2 style="color: #1a1a1a; margin: 0;">Letstest</h2>
            </div>
            <h1>Você foi convidado!</h1>
            <p>Olá,</p>
            <p>Você recebeu um convite para se juntar à organização <span class="highlight">{{organizationName}}</span> no Letstest.</p>
            <p>Função: <span class="role-badge">{{role}}</span></p>
            <p>Para aceitar o convite, clique no botão abaixo:</p>
            <div style="text-align: center;">
                <a href="{{acceptUrl}}" class="button">Aceitar Convite</a>
            </div>
            <p style="font-size: 14px; color: #999;">Este convite expira em {{expiresIn}}.</p>
            <p style="font-size: 14px; color: #999;">Se você não esperava este convite, pode ignorar este email.</p>
        </div>
        <div class="footer">
            <p>© {{year}} Letstest. Todos os direitos reservados.</p>
            <p>Este é um email automático, não responda.</p>
        </div>
    </div>
</body>
</html>
`;

// Plain text version of invite
const DEFAULT_INVITE_TEXT = `
Você foi convidado para {{organizationName}}!

Olá,

Você recebeu um convite para se juntar à organização {{organizationName}} no Letstest.

Função: {{role}}

Para aceitar o convite, acesse o link abaixo:
{{acceptUrl}}

Este convite expira em {{expiresIn}}.

Se você não esperava este convite, pode ignorar este email.

---
© {{year}} Letstest
`;

export type InviteEmailData = {
    to: string;
    organizationName: string;
    role: string;
    token: string;
    expiresAt: Date;
};

const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
        owner: "Proprietário",
        admin: "Administrador",
        member: "Membro",
    };
    return labels[role] || role;
};

export const sendInviteEmail = async (data: InviteEmailData) => {
    const appUrl = APP_URL || "http://localhost:3000";
    const acceptUrl = `${appUrl}/invite/accept?token=${data.token}`;

    const daysUntilExpiry = Math.ceil((data.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expiresIn = daysUntilExpiry === 1 ? "1 dia" : `${daysUntilExpiry} dias`;

    const variables = {
        organizationName: data.organizationName,
        role: getRoleLabel(data.role),
        acceptUrl,
        expiresIn,
        year: new Date().getFullYear().toString(),
    };

    const htmlTemplate = loadTemplate("invite", DEFAULT_INVITE_TEMPLATE);
    const textTemplate = loadTemplate("invite-text", DEFAULT_INVITE_TEXT);

    const html = renderTemplate(htmlTemplate, variables);
    const text = renderTemplate(textTemplate, variables);

    const subject = `Convite para ${data.organizationName} - Letstest`;

    return sendEmail(data.to, subject, text, html);
};

// =============================================================================
// Password reset email
// =============================================================================

const DEFAULT_RESET_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinir senha</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
        p { color: #666; margin-bottom: 15px; }
        .button { display: inline-block; background: #1a1a1a; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #333; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>Redefinição de senha</h1>
            <p>Recebemos uma solicitação para redefinir sua senha no Letstest.</p>
            <p>Para continuar, clique no botão abaixo:</p>
            <div style="text-align: center;">
                <a href="{{resetUrl}}" class="button">Redefinir senha</a>
            </div>
            <p style="font-size: 14px; color: #999;">Se você não solicitou esta mudança, pode ignorar este email.</p>
        </div>
        <div class="footer">
            <p>© {{year}} Letstest. Todos os direitos reservados.</p>
            <p>Este é um email automático, não responda.</p>
        </div>
    </div>
</body>
</html>
`;

const DEFAULT_RESET_TEXT = `
Redefinição de senha - Letstest

Recebemos uma solicitação para redefinir sua senha no Letstest.

Para continuar, acesse o link abaixo:
{{resetUrl}}

Se você não solicitou esta mudança, pode ignorar este email.

---
© {{year}} Letstest
`;

export type PasswordResetEmailData = {
    to: string;
    token: string;
};

export const sendPasswordResetEmail = async (data: PasswordResetEmailData) => {
    const appUrl = APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${data.token}`;

    const variables = {
        resetUrl,
        year: new Date().getFullYear().toString(),
    };

    const htmlTemplate = loadTemplate("reset-password", DEFAULT_RESET_TEMPLATE);
    const textTemplate = loadTemplate("reset-password-text", DEFAULT_RESET_TEXT);

    const html = renderTemplate(htmlTemplate, variables);
    const text = renderTemplate(textTemplate, variables);

    const subject = "Redefinição de senha - Letstest";

    return sendEmail(data.to, subject, text, html);
};
