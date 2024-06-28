import {Module} from '@nestjs/common';
import {JestTestModule} from 'nestjs-jest-decorators';
import {FactoriesModule} from '../factory/factories.module';
import * as allTests from '../test';

@Module({
    imports: [JestTestModule.registerTests([...Object.values(allTests)], [FactoriesModule])],
})
export class TestModule {}
