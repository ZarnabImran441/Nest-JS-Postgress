import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {Request} from 'express';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';

export class UserPolicies extends GenericCrudPolicies<EntityTypeOptions.User> {
    constructor() {
        super(EntityTypeOptions.User);
    }

    UserLogin(): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, _request: Request) => {
            return can(PermissionOptions.LOGIN, this.entityType);
        };
    }
}
