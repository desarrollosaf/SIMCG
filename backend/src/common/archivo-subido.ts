// Archivo recibido con FileInterceptor (multer en memoria). Se tipa aquí para
// no depender de @types/multer.
export interface ArchivoSubido {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
