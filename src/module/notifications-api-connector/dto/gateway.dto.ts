import {NotificationTypeOptions} from '../notification-api-connector.service';
import {NotificationDto} from './notification.dto';

export class GatewayDto {
    recipients: {
        emailRecipients: string[];
        notificationCenterRecipients: string[];
    };
    emitEvent: NotificationTypeOptions;
    streamUpdate: boolean;
    notification: NotificationDto;
}
export class UnreadNotificationsGatewayDto {
    recipients: string[];
    emitEvent: NotificationTypeOptions;
    streamUpdate: boolean;
    notification: number;
}
