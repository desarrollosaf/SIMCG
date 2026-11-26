import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface AdjuntoCorreo {
  filename: string;
  /** Contenido o ruta del archivo. */
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  /** Si se indica, la imagen se embebe y se referencia con `cid:<cid>`. */
  cid?: string;
}

export interface MensajeCorreo {
  para: string | string[];
  asunto: string;
  html: string;
  adjuntos?: AdjuntoCorreo[];
}

@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporte: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private obtenerTransporte(): Transporter {
    const host = this.config.get<string>('MAIL_HOST');
    if (!host) {
      throw new ServiceUnavailableException('El correo no está configurado');
    }
    if (!this.transporte) {
      const puerto = Number(this.config.get<string>('MAIL_PORT') || 587);
      const usuario = this.config.get<string>('MAIL_USER');
      const secure =
        (this.config.get<string>('MAIL_SECURE') ?? '').toLowerCase() === 'true';
      this.transporte = nodemailer.createTransport({
        host,
        port: puerto,
        secure,
        auth: usuario
          ? { user: usuario, pass: this.config.get<string>('MAIL_PASSWORD') }
          : undefined,
      });
    }
    return this.transporte;
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    const transporte = this.obtenerTransporte();
    const info = (await transporte.sendMail({
      from: this.config.get<string>('MAIL_FROM') || undefined,
      to: mensaje.para,
      subject: mensaje.asunto,
      html: mensaje.html,
      attachments: mensaje.adjuntos,
    })) as { messageId?: string };
    this.logger.log(`Correo enviado (${info.messageId ?? 's/id'})`);
  }
}
