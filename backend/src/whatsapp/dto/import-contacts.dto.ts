import { IsString, IsNotEmpty, IsArray, ValidateNested, Matches, Length, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ContactItemDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  name: string;

  @Transform(({ value }) => typeof value === 'string' ? value.replace(/\D/g, '') : value)
  @IsString({ message: 'El teléfono debe ser texto' })
  @Matches(/^[0-9]+$/, { message: 'El teléfono solo debe contener números' })
  @Length(10, 12, { message: 'El teléfono debe tener entre 10 y 12 dígitos' })
  phone: string;
}

export class ImportContactsDto {
  @IsArray({ message: 'Contacts debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => ContactItemDto)
  contacts: ContactItemDto[];

  @IsString()
  @IsNotEmpty()
  companyId: string;
}
