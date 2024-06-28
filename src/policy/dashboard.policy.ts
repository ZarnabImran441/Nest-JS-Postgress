import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {Request} from 'express';

export class DashboardPolicy extends GenericCrudPolicies<EntityTypeOptions.Dashboard> {
    constructor() {
        super(EntityTypeOptions.Dashboard);
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
}
