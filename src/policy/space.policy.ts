import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
import {Request} from 'express';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class SpacePolicies extends GenericCrudPolicies<EntityTypeOptions.Space> {
    constructor() {
        super(EntityTypeOptions.Space);
    }

    OwnerFull(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.OWNER_FULL, this.entityType, this.getEntityValue(request, path));
        };
    }

    OwnerFullEditor(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.OWNER_FULL_EDITOR, this.entityType, this.getEntityValue(request, path));
        };
    }

    OwnerFullEditorReadonly(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.OWNER_FULL_EDITOR_READ, this.entityType, this.getEntityValue(request, path));
        };
    }

    OwnerFullNullable(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            const value = this.getEntityValueNullable(request, path);
            if (value === null) {
                return true;
            } else {
                return can(PermissionOptions.OWNER_FULL, this.entityType, value);
            }
        };
    }
}
