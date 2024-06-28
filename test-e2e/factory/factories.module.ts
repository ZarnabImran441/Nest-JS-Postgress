import {Global, Module} from '@nestjs/common';
import * as allFactories from './';
import {AuthorizationImplModule} from '../../src/module/authorization-impl/authorization-impl.module';

@Global()
@Module({
    imports: [AuthorizationImplModule],
    providers: [...Object.values(allFactories)],
    exports: [...Object.values(allFactories)],
})
export class FactoriesModule {}
