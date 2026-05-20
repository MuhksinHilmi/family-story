type EmailProvider = 'mock' | 'smtp' | 'sendgrid' | 'resend';

export const emailConfig = {
  provider: (process.env.SMTP_HOST ? 'smtp' : 'mock') as EmailProvider,
  from: process.env.SMTP_USER || 'noreply@ceritakeluarga.com',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
};

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (emailConfig.provider === 'mock' || !process.env.SMTP_HOST) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
    console.log(html);
    return true;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: emailConfig.smtp.auth,
    });

    await transporter.sendMail({
      from: `"Cerita Keluarga" <${emailConfig.from}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}

export async function sendOTP(to: string, otp: string): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2>Kode OTP Anda</h2>
      <p>Kode OTP: <strong style="font-size: 24px; letter-spacing: 5px;">${otp}</strong></p>
      <p>Kode ini berlaku selama 5 menit.</p>
    </div>
  `;
  return sendEmail(to, 'Kode OTP - Cerita Keluarga', html);
}

export async function sendActivationLink(to: string, token: string): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2>Aktivasi Akun Anda</h2>
      <p>Klik link berikut untuk mengaktifkan akun:</p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/activate?token=${token}" 
         style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
        Aktifkan Akun
      </a>
      <p>Link ini berlaku selama 24 jam.</p>
    </div>
  `;
  return sendEmail(to, 'Aktivasi Akun - Cerita Keluarga', html);
}

export async function sendInvitationLink(to: string, token: string): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2>Anda diundang untuk bergabung</h2>
      <p>Klik link berikut untuk melihat undangan dan bergabung ke pohon keluarga:</p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/invitations/${token}" 
         style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
        Lihat Undangan
      </a>
      <p>Link ini berlaku selama 7 hari.</p>
    </div>
  `;
  return sendEmail(to, 'Undangan - Cerita Keluarga', html);
}
