import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config/config';
import { setupApplication } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  setupApplication(app, config);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
}

bootstrap().catch(() => {
  console.error('Application startup failed. Check configuration and dependencies.');
  process.exitCode = 1;
});
