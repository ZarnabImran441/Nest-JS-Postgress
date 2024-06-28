import {NestFactory, Reflector} from '@nestjs/core';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import * as compression from 'compression';
import {NestExpressApplication} from '@nestjs/platform-express';
import helmet from 'helmet';
import {initializeTransactionalContext} from 'typeorm-transactional';
import {WINSTON_MODULE_NEST_PROVIDER, WinstonModule} from 'nest-winston';
import {ClassSerializerInterceptor} from '@nestjs/common';
import {TaskManagementModule} from './task-management.module';
import {LoggerConfig} from './config/logger.config';
import {ForceCheckPolicyGuard} from '@lib/base-library';
import {SERVICE_PORT} from './const/env.const';
import * as swaggerStats from 'swagger-stats';
import {Request, Response} from 'express';

async function bootstrap(): Promise<void> {
    initializeTransactionalContext(); // Initialize cls-hooked

    const app = await NestFactory.create<NestExpressApplication>(TaskManagementModule, {
        logger: WinstonModule.createLogger(LoggerConfig),
        bodyParser: false,
        abortOnError: false,
        bufferLogs: false,
    });
    const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    app.useGlobalGuards(new ForceCheckPolicyGuard(app.get(Reflector)));
    app.use(compression());
    app.use(helmet({crossOriginResourcePolicy: false, contentSecurityPolicy: false, crossOriginEmbedderPolicy: false}));
    app.enableCors();
    app.useBodyParser('json', {limit: '50mb'});
    app.useBodyParser('urlencoded', {limit: '50mb', extended: true});

    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    // Starts listening for shutdown hooks
    app.enableShutdownHooks();
    const options = new DocumentBuilder()
        .setTitle('Task Management - API')
        .setDescription('Task Management API documentation')
        .setVersion('0.0.1')
        .addBearerAuth()
        .setContact('Plexxis Software', 'https://plexxis.com/', 'connect@plexxis.com')
        .setExternalDoc('swagger.json', '/swagger.json')
        .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api-docs', app, document, {
        swaggerOptions: {
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
            docExpansion: 'none',
            syntaxHighlight: false,
            tryItOutEnabled: true,
        },
    });
    app.use(`/swagger.json`, (_req: Request, res: Response) => res.send(document));

    app.use(swaggerStats.getMiddleware({swaggerSpec: document}));

    process.setUncaughtExceptionCaptureCallback((err: Error) => {
        logger.error(`UncaughtException`);
        logger.error(err);
    });

    await app.listen(SERVICE_PORT).then(async () => {
        const res = await app.getUrl();
        logger.log(`Task Management API is running on: ${res}`, 'Main');
    });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
// eslint-enable-next-line @typescript-eslint/no-floating-promises
