import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly configured: boolean;
  private readonly isProduction: boolean;

  isConfigured(): boolean {
    return this.configured;
  }

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT') ?? 587;
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.from =
      config.get<string>('SMTP_FROM') ?? 'DocIndex <noreply@docindex.local>';
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.isProduction = config.get<string>('NODE_ENV') === 'production';

    this.configured = Boolean(host && user && pass);

    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      if (this.isProduction) {
        this.logger.warn(
          'SMTP is not configured: emails will not be sent. Create accounts from the admin page.',
        );
      } else {
        this.logger.warn(
          'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS missing). ' +
            'Emails will be logged to console only.',
        );
      }
    }
  }

  /**
   * Send email verification link to the newly registered user.
   */
  async sendVerificationEmail(email: string, rawToken: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${rawToken}`;
    const subject = 'Verify your DocIndex email address';
    const html = `
      <p>Hello,</p>
      <p>Thanks for registering with DocIndex. Click the link below to verify your email address:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link is valid for 24 hours.</p>
      <p>If you did not create this account, you can ignore this email.</p>
    `;
    await this.send(email, subject, html, 'verification');
  }

  /**
   * Notify all admins that a new user has registered and is awaiting approval.
   */
  async sendAdminApprovalNotification(
    newUserEmail: string,
    adminEmails: string[],
  ): Promise<void> {
    if (adminEmails.length === 0) return;

    const subject = 'New DocIndex registration pending approval';
    const html = `
      <p>Hello Admin,</p>
      <p>A new user has registered and is awaiting your approval:</p>
      <p><strong>${newUserEmail}</strong></p>
      <p>Log in to the admin console to review this request:</p>
      <p><a href="${this.frontendUrl}/admin/pending">${this.frontendUrl}/admin/pending</a></p>
    `;

    // Send to each admin individually so no admin sees other admins' addresses
    await Promise.allSettled(
      adminEmails.map((admin) =>
        this.send(admin, subject, html, 'admin-approval'),
      ),
    );
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    type: 'verification' | 'admin-approval',
  ): Promise<void> {
    const mail = { from: this.from, to, subject, html };

    if (!this.configured) {
      if (this.isProduction) {
        this.logger.log(
          `email not sent (SMTP not configured): ${type} to ${to}`,
        );
      } else {
        this.logger.log(
          `[EMAIL NOT SENT — SMTP unconfigured]\nTo: ${to}\nSubject: ${subject}\n${html}`,
        );
      }
      return;
    }

    try {
      await this.transporter.sendMail(mail);
    } catch (err) {
      // Log but don't throw — email failure should never crash a registration
      this.logger.error(`Failed to send email to ${to}: ${String(err)}`);
    }
  }
}
