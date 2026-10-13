import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outgoing email. The initial version has no SMTP provider: in development and test the
 * message is written to the server console so flows like password reset can be exercised
 * locally. In production it only logs that delivery is not configured (never the content,
 * which may contain a reset token). Plug a real transport into `deliver()` to send mail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  readonly outbox: MailMessage[] = [];

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async send(message: MailMessage): Promise<void> {
    const env = this.config.get('NODE_ENV', { infer: true });
    if (env === 'test') {
      this.outbox.push(message);
      return;
    }
    if (env === 'development') {
      this.logger.log(
        `\n--- DEV EMAIL (not sent) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n----------------------------`,
      );
      return;
    }
    await this.deliver(message);
  }

  private async deliver(message: MailMessage): Promise<void> {
    this.logger.warn(`Email delivery is not configured; dropped message "${message.subject}"`);
  }
}
