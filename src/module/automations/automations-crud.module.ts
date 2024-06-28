import {DynamicModule} from '@nestjs/common';
import {contructorLogger} from '@lib/base-library';
import {AutomationsRedisSendService} from '@lib/automations-library';
import {AutomationsCrudController} from './automations-crud.controller';
import {AutomationsCrudService} from './automations-crud.service';

export interface AutomationsConfigInterface {
    entityType: string;
    queueName: string;
    serviceUrl: string;
    redisUrl: string;
}

export class AutomationsCrudModule {
    static register(options: AutomationsConfigInterface): DynamicModule {
        // const queue = new Queue<AutomationNotificationDto>(options.queueName, {
        //     redis: options.redisUrl,
        //     defaultJobOptions: {removeOnComplete: 1000, removeOnFail: 1000},
        // });
        return {
            global: true,
            module: AutomationsCrudModule,
            controllers: [AutomationsCrudController],
            providers: [
                {
                    provide: 'AUTOMATIONS-CONFIG',
                    useValue: options,
                },
                // {
                //     provide: AUTOMATIONSQUEUE,
                //     useValue: queue,
                // },
                AutomationsCrudService,
                AutomationsRedisSendService,
            ],
            exports: [AutomationsRedisSendService, AutomationsCrudService],
        };
    }

    constructor() {
        contructorLogger(this);
    }
}
