import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CorreoService } from './correo.service';

jest.mock('nodemailer');

const configCon = (valores: Record<string, string>) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

describe('CorreoService', () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    sendMail.mockResolvedValue({ messageId: 'abc' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('sin MAIL_HOST lanza error claro', async () => {
    const servicio = new CorreoService(configCon({}));
    const mensaje = { para: 'a@b.mx', asunto: 'x', html: '<p>x</p>' };
    await expect(servicio.enviar(mensaje)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(servicio.enviar(mensaje)).rejects.toThrow(
      'El correo no está configurado',
    );
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('envía con la configuración y adjuntos por cid', async () => {
    const servicio = new CorreoService(
      configCon({
        MAIL_HOST: 'smtp.local',
        MAIL_PORT: '465',
        MAIL_USER: 'u',
        MAIL_PASSWORD: 'p',
        MAIL_FROM: 'Contraloría <c@local>',
        MAIL_SECURE: 'true',
      }),
    );
    const adjuntos = [
      { filename: 'i.png', content: Buffer.from('x'), cid: 'i' },
    ];
    await servicio.enviar({
      para: 'a@b.mx',
      asunto: 'Asunto',
      html: '<img src="cid:i">',
      adjuntos,
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.local',
      port: 465,
      secure: true,
      auth: { user: 'u', pass: 'p' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Contraloría <c@local>',
      to: 'a@b.mx',
      subject: 'Asunto',
      html: '<img src="cid:i">',
      attachments: adjuntos,
    });
  });
});
