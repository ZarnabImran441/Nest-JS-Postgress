import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
import {Request} from 'express';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class FolderPolicies extends GenericCrudPolicies<EntityTypeOptions.Folder> {
    constructor() {
        super(EntityTypeOptions.Folder);
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

    //** We don't have to use it now. Because parent can never be null for a folder after space implementations */
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

    OwnerFullOnSpaceOrFolder(path: string): PolicyHandlerType {
        return async (can: IsUserAuthorizedToDoType, request: Request) => {
            const value = this.getEntityValueNullable(request, path);
            if (value === null) {
                return true;
            } else {
                return (
                    (await can(PermissionOptions.OWNER_FULL, this.entityType, value)) ||
                    (await can(PermissionOptions.OWNER_FULL, EntityTypeOptions.Space, value))
                );
            }
        };
    }

    OwnerFullEditorReadOnlyFolderSpace(path: string): PolicyHandlerType {
        return async (can: IsUserAuthorizedToDoType, request: Request) => {
            return (
                (await can(PermissionOptions.OWNER_FULL_EDITOR_READ, EntityTypeOptions.Folder, this.getEntityValue(request, path))) ||
                (await can(PermissionOptions.OWNER_FULL_EDITOR_READ, EntityTypeOptions.Space, this.getEntityValue(request, path)))
            );
        };
    }
}
