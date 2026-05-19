import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly prefix = 'enc:v1:';

  private get secretKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) return '';
    if (key.length !== 32) {
      return crypto.createHash('sha256').update(String(key)).digest('base64').substring(0, 32);
    }
    return key;
  }

  encrypt(text: string | null | undefined): string | null {
    if (!text) return text as any;
    if (text.startsWith(this.prefix)) return text;
    
    const key = this.secretKey;
    if (!key) {
      this.logger.warn('ENCRYPTION_KEY no encontrada. Almacenando dato confidencial en TEXTO PLANO.');
      return text;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(key, 'utf8'), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${this.prefix}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      this.logger.error('Error al cifrar el texto', error);
      return text;
    }
  }

  decrypt(text: string | null | undefined): string | null {
    if (!text) return text as any;
    if (!text.startsWith(this.prefix)) return text;
    
    const key = this.secretKey;
    if (!key) return text;

    try {
      const parts = text.split(':');
      const iv = Buffer.from(parts[2], 'hex');
      const authTag = Buffer.from(parts[3], 'hex');
      const encryptedText = parts[4];

      const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(key, 'utf8'), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Error al descifrar el texto', error);
      return text;
    }
  }
}
