import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {Request} from 'express';

export class NotificationPolicies extends GenericCrudPolicies<EntityTypeOptions.Notification> {
    constructor() {
        super(EntityTypeOptions.Notification);
    }

    ReadAll(): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, _request: Request) => {
            return can(PermissionOptions.OWNER_READ_UPDATE_DELETE, this.entityType);
        };
    }
}
