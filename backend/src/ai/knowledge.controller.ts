import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Query, HttpException, HttpStatus, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';

@Controller('api/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File, 
    @Body('companyId') companyId: string
  ) {
    if (!companyId) throw new HttpException('companyId is required', HttpStatus.BAD_REQUEST);
    if (!file) throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    
    if (file.mimetype !== 'application/pdf') {
      throw new HttpException('Only PDF files are supported', HttpStatus.BAD_REQUEST);
    }

    return this.knowledgeService.processAndStoreDocument(file, companyId);
  }

  @Get()
  async getDocuments(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId is required', HttpStatus.BAD_REQUEST);
    return this.knowledgeService.getDocuments(companyId);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId is required', HttpStatus.BAD_REQUEST);
    return this.knowledgeService.deleteDocument(id, companyId);
  }
}
