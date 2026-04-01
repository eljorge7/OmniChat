import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' }); // Allow Next.js fetching
  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
