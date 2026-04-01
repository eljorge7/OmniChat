import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
const pdfParse = require('pdf-parse');

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private prisma: PrismaService) {}

  async processAndStoreDocument(file: Express.Multer.File, companyId: string) {
    try {
      this.logger.log(`Procesando documento: ${file.originalname} para Company: ${companyId}`);
      
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company || !company.openAiKey) {
        throw new HttpException('La compañía no tiene configurada una OpenAI API Key', HttpStatus.BAD_REQUEST);
      }

      const openai = new OpenAI({ apiKey: company.openAiKey });

      // 1. Extraer texto del PDF
      const pdfData = await pdfParse(file.buffer);
      const text = pdfData.text.replace(/\n/g, ' '); // Limpiar saltos de línea crudos

      if (!text || text.trim().length === 0) {
        throw new HttpException('El PDF está vacío o no contiene texto extraíble', HttpStatus.BAD_REQUEST);
      }

      // 2. Fragmentar (Chunking) simple por caracteres o palabras
      const CHUNK_SIZE = 1000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }

      this.logger.log(`Documento dividido en ${chunks.length} fragmentos.`);

      // 3. Crear el Document principal
      const document = await this.prisma.document.create({
        data: {
          fileName: file.originalname,
          companyId: companyId,
          status: 'PROCESSED'
        }
      });

      // 4. Generar Embeddings y guardar en Prisma (Vector Float Array)
      let processedChunks = 0;
      for (const chunkText of chunks) {
        if (chunkText.trim().length < 10) continue; // Skip chunks muy pequeños
        
        try {
          const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: chunkText,
          });
          
          const vector = response.data[0].embedding;

          await this.prisma.documentChunk.create({
            data: {
              documentId: document.id,
              text: chunkText,
              embedding: vector
            }
          });
          processedChunks++;
        } catch (embErr: any) {
           this.logger.error(`Error generando embedding para chunk: ${embErr.message}`);
           // Podemos decidir continuar o fallar
        }
      }

      this.logger.log(`Documento ${document.id} procesado exitosamente con ${processedChunks} vectores.`);
      return { success: true, documentId: document.id, chunks: processedChunks };

    } catch (error: any) {
      this.logger.error(`Error en processAndStoreDocument: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getDocuments(companyId: string) {
    return this.prisma.document.findMany({
      where: { companyId },
      include: {
         _count: { select: { chunks: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteDocument(id: string, companyId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId }
    });
    
    if (!document) {
      throw new HttpException('Documento no encontrado', HttpStatus.NOT_FOUND);
    }

    await this.prisma.document.delete({ where: { id } });
    return { success: true };
  }
}
