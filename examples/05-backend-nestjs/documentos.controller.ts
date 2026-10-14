/**
 * Ejemplo 5 — Backend NestJS para guardar documentos del editor.
 * (Este archivo no se compila con el proyecto Next: cópialo a tu backend.)
 *
 * Tabla sugerida (PostgreSQL):
 *   CREATE TABLE documentos (
 *     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     titulo      text        NOT NULL,
 *     contenido   jsonb       NOT NULL,  -- WordDocument.json
 *     pagina      jsonb       NOT NULL,  -- WordDocument.settings (márgenes, encabezado, pie…)
 *     html        text,                  -- WordDocument.html (para vistas sin editor)
 *     actualizado timestamptz NOT NULL DEFAULT now()
 *   );
 */
import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Put } from '@nestjs/common';

interface WordDocumentDto {
  title: string;
  json: { type: 'doc'; content?: unknown[] };
  html?: string;
  settings: Record<string, unknown>;
}

// Reemplaza este Map por tu repositorio (TypeORM, Prisma…)
const store = new Map<string, WordDocumentDto>();

@Controller('documentos')
export class DocumentosController {
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    const doc = store.get(id);
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  @Put(':id')
  guardar(@Param('id', ParseUUIDPipe) id: string, @Body() body: WordDocumentDto) {
    if (body?.json?.type !== 'doc') throw new BadRequestException('Documento inválido');
    store.set(id, {
      title: String(body.title ?? 'Sin título').slice(0, 200),
      json: body.json,
      html: body.html ?? '',
      settings: body.settings ?? {},
    });
    return { ok: true, savedAt: new Date().toISOString() };
  }
}

/*
 * Si además recibes el .docx desde el formulario (ejemplo 2), usa multer:
 *
 *   @Post()
 *   @UseInterceptors(FileInterceptor('archivo'))
 *   crear(@UploadedFile() archivo: Express.Multer.File, @Body('documento') documento: string) {
 *     const doc = JSON.parse(documento) as WordDocumentDto;
 *     // guarda doc en la BD y archivo.buffer en tu almacenamiento (S3, disco…)
 *   }
 */
