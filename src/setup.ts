import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppConfig } from './config/config';

export function setupApplication(app: INestApplication, config: AppConfig) {
  app.use(helmet());
  app.use(json({ limit: '32kb' }));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
  }));
  if (config.docsEnabled) {
    const options = new DocumentBuilder().setTitle('DevSecOps task API').setVersion('0.1.0')
      .setDescription('Authenticated demonstration API; use synthetic lab accounts.').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, options));
  }
}
