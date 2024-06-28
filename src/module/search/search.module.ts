import {Module} from '@nestjs/common';
import {SearchApiProxyModule, SearchEnqueuerModule} from '@plexxis/eureka-api';
import {SearchServiceRedisConfig} from '../../config/search-enqueue.config';
import {SEARCH_SERVICE_API_URL} from '../../const/env.const';
import {SearchService} from './search.service';

@Module({
    imports: [SearchEnqueuerModule.register(SearchServiceRedisConfig), SearchApiProxyModule.register(SEARCH_SERVICE_API_URL)],
    providers: [SearchService],
    exports: [SearchService],
})
export class SearchModule {}
