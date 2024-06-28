// import {INestApplication, ValidationPipe} from '@nestjs/common';
// import {initializeTransactionalContext} from 'typeorm-transactional';
// import {Test, TestingModule} from '@nestjs/testing';
// import {TypeOrmModule, TypeOrmModuleAsyncOptions} from '@nestjs/typeorm';
//
// export class BaseTest {
//     protected app: INestApplication;
//     private _url: string;
//
//     constructor(
//         url: string,
//         private readonly databaseConfig: TypeOrmModuleAsyncOptions,
//         private readonly imports: any[] = [],
//         private readonly controllers: any[] = [],
//         private readonly providers: any[] = []
//     ) {
//         this._url = url;
//     }
//
//     @BeforeAll()
//     async before_all(): Promise<void> {
//         console.log(4);
//         initializeTransactionalContext();
//         console.log(5);
//         const moduleRef: TestingModule = await Test.createTestingModule({
//             imports: [TypeOrmModule.forRootAsync(this.databaseConfig), ...this.imports],
//             providers: this.providers,
//             controllers: this.controllers,
//         }).compile();
//         console.log(6);
//         this.app = moduleRef.createNestApplication({logger: ['log', 'error', 'warn', 'debug', 'verbose']});
//         console.log(6);
//         console.log(8);
//         this.app.useGlobalPipes(
//             new ValidationPipe({
//                 transform: true,
//                 transformOptions: {enableImplicitConversion: true},
//                 whitelist: true,
//                 enableDebugMessages: true,
//             })
//         );
//         console.log(9);
//         await this.app.init();
//         console.log(10);
//     }
//
//     @AfterAll()
//     async after_all(): Promise<void> {
//         await this.app.close();
//     }
//
//     public get url(): string {
//         return this._url;
//     }
// }
