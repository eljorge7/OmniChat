import { IsString, IsNotEmpty, Matches, Length, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CaptureWebLeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) => value.replace(/\D/g, ''))
  @IsString()
  @Matches(/^[0-9]+$/, { message: 'El teléfono debe ser solo números' })
  @Length(10, 12, { message: 'Teléfono inválido, debe tener de 10 a 12 dígitos' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  interest: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
