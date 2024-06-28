import {DynamicModule, Global, Logger, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {NotificationsApiModule} from '@plexxis/notification-api';
import {UserEntity} from '../../model/user.entity';
import {NotificationApiConnectorService} from './notification-api-connector.service';

export interface NotificationApiConnectorInterface {
    host: string;
    port: number;
    password: string;
    enabled: boolean;
    queueName: string;
    tlsEnabled: boolean;
}

@Global()
@Module({})
export class NotificationApiConnectorModule {
    static register(options: NotificationApiConnectorInterface): DynamicModule {
        return {
            module: NotificationApiConnectorModule,
            imports: [
                NotificationsApiModule.register({
                    host: options.host,
                    port: options.port,
                    password: options.password,
                    enabled: options.enabled,
                    retries: 1,
                    tlsEnabled: options.tlsEnabled,
                    queueName: options.queueName,
                    logger: new Logger(NotificationApiConnectorModule.name),
                }),
                TypeOrmModule.forFeature([UserEntity]),
            ],
            providers: [NotificationApiConnectorService],
            exports: [NotificationApiConnectorService],
        };
    }
}
