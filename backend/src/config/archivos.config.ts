import { registerAs } from '@nestjs/config';

// Carpeta raíz de los archivos subidos (actas y soportes). En Docker es el
// volumen ./backend/uploads montado en /app/uploads.
export default registerAs('archivos', () => ({
  dir: process.env.ARCHIVOS_DIR || '/app/uploads',
}));
