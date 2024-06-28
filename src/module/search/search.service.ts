import {Inject, Injectable} from '@nestjs/common';
import {
    SearchApiDto,
    SearchApiProxyService,
    SearchEnqueuerService,
    SearchResponseInterface,
    UpdateSearchIndexInterface,
} from '@plexxis/eureka-api';
import {Job} from 'bull';

/**
 * Search service class
 */
@Injectable()
export class SearchService {
    @Inject()
    private readonly proxy: SearchApiProxyService;

    @Inject()
    private readonly enqueuer: SearchEnqueuerService;

    async search(dto: SearchApiDto): Promise<SearchResponseInterface> {
        return await this.proxy.search(dto);
    }

    async sendMessage(message: UpdateSearchIndexInterface): Promise<Job<UpdateSearchIndexInterface> | null> {
        return await this.enqueuer.sendMessage(message);
    }
}
