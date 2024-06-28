import {winstonAlignedWithColorsAndTime} from '@lib/base-library';
import {INestApplication} from '@nestjs/common';
import {Test, TestingModule, TestingModuleBuilder} from '@nestjs/testing';
import {WinstonModule} from 'nest-winston';
import {DecoratedSuites} from 'nestjs-jest-decorators';
import {initializeTransactionalContext} from 'typeorm-transactional';
import * as winston from 'winston';
import {TaskManagementModule} from '../src/task-management.module';
import {TestModule} from './modules/test.module';
import {NewBaseTest} from './test/base-test';
import {FakePasAuthenticationService} from '@test-lib/test-base-library';

const TESTTORUN = process.env.TESTTORUN;
const SUITETORUN = process.env.SUITETORUN;

const initNest = async (): Promise<INestApplication> => {
    initializeTransactionalContext();
    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule({
        imports: [
            TaskManagementModule, // The app to test
            TestModule, // Your test suite
        ],
    })
        .overrideProvider('PAS_AUTHENTICATION_SERVICE')
        .useClass(FakePasAuthenticationService);

    const testingModule: TestingModule = await testingModuleBuilder.compile();
    const logger = WinstonModule.createLogger({
        level: process.env.LOGGER_LEVEL,
        transports: [new winston.transports.Console()],
        format: winstonAlignedWithColorsAndTime,
    });
    logger.log('HOAAAAAAAAAAAA');
    const app = testingModule.createNestApplication({logger, bufferLogs: false});
    await app.init();
    await app.getHttpServer().listen(0);
    return app;
};

let app: INestApplication;
beforeAll(async () => {
    app = await initNest();
});

describe('Tast Management Test Suite', () => {
    /* eslint-disable  @typescript-eslint/no-empty-function */
    /* eslint-disable  @typescript-eslint/explicit-function-return-type */
    test('', () => {});
    /* eslint-enable  @typescript-eslint/explicit-function-return-type */
    /* eslint-enable  @typescript-eslint/no-empty-function */

    const isSelectedToRun = (actualName, selectedName): boolean => {
        return !selectedName || selectedName === actualName;
    };

    for (const appTestClass of Object.keys(DecoratedSuites)) {
        const testSuite = DecoratedSuites[appTestClass];
        if (isSelectedToRun(testSuite.title, SUITETORUN)) {
            describe(testSuite.title, () => {
                for (const testMethod of testSuite.tests) {
                    if (isSelectedToRun(testMethod.description, TESTTORUN)) {
                        it.concurrent(testMethod.description, async () => {
                            const c = app.get<NewBaseTest>(testSuite.target);
                            c.setApp(app);
                            await testMethod.method.apply(c);
                        });
                    }
                }
            });
        }
    }
});

afterAll(async (): Promise<void> => {
    await app.close();
});
