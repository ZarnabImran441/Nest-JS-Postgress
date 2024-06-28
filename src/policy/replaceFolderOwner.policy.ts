import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {Request} from 'express';

export class ReplaceFolderOwner extends GenericCrudPolicies<EntityTypeOptions.replaceFolderOwner> {
    constructor() {
        super(EntityTypeOptions.replaceFolderOwner);
    }

    SuperAdminOwner(path: string): PolicyHandlerType {
        return async (can: IsUserAuthorizedToDoType, request: Request) => {
            return (
                (await can(PermissionOptions.UPDATE, this.entityType, null)) ||
                (await can(PermissionOptions.OWNER_READ_UPDATE_DELETE, EntityTypeOptions.Folder, this.getEntityValue(request, path)))
            );
        };
    }
}
