import { Global, Module } from '@nestjs/common';
import { ArchivosService } from './archivos.service';
import { CorreoService } from './correo.service';
import { ExcelService } from './excel.service';
import { PdfService } from './pdf.service';
import { PlantillasService } from './plantillas.service';

const SERVICIOS = [
  ArchivosService,
  CorreoService,
  ExcelService,
  PdfService,
  PlantillasService,
];

@Global()
@Module({ providers: SERVICIOS, exports: SERVICIOS })
export class DocumentosModule {}
