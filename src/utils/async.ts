import {Logger} from '@nestjs/common';

export class AsyncUtil {
    private static readonly logger = new Logger(AsyncUtil.name);
    static async dummyAwait(param?: unknown): Promise<void> {
        this.logger.warn('WARNING: Dummy Await placeholder still set. ', param);
        return await new Promise<void>((resolve) => resolve());
    }
}
