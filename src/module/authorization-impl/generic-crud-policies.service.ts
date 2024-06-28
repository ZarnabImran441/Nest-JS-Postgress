import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {Request} from 'express';
import {EntityTypeOptions, PermissionOptions} from './authorization.enum';

export class GenericCrudPolicies<TEntityType extends EntityTypeOptions> {
    entityType: EntityTypeOptions;

    constructor(entityType: TEntityType) {
        this.entityType = entityType;
    }

    //add path optional
    Create(path: string = null): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.CREATE, this.entityType, path ? this.getEntityValue(request, path) : null);
        };
    }

    // Update should always have a id.
    Update(path: string = null): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            const currentValue = path ? this.getEntityValue(request, path) : null;
            return can(PermissionOptions.UPDATE, this.entityType, currentValue);
        };
    }

    //path is mandatory
    Delete(path: string = null): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            const currentValue = path ? this.getEntityValue(request, path) : null;
            return can(PermissionOptions.DELETE, this.entityType, currentValue);
        };
    }

    //Note : The path can be optional here because for get many we don't have id's.
    Read(path: string = null): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            const currentValue = path ? this.getEntityValue(request, path) : null;
            return can(PermissionOptions.READ, this.entityType, currentValue);
        };
    }

    Owner(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.OWNER, this.entityType, this.getEntityValue(request, path));
        };
    }

    OwnerReadUpdateDelete(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.OWNER_READ_UPDATE_DELETE, this.entityType, this.getEntityValue(request, path));
        };
    }

    OwnerUpdate(path: string): PolicyHandlerType {
        return (can: IsUserAuthorizedToDoType, request: Request) => {
            return can(PermissionOptions.OWNER_UPDATE, this.entityType, this.getEntityValue(request, path));
        };
    }

    protected getEntityValue = (request: Request, path: string): string => {
        if (path !== null && path !== undefined) {
            const split = path.split('.');
            for (const str of split) {
                if (!request) {
                    break;
                }
                request = request[str];
            }
            if (request === null || request === undefined) {
                throw new Error(`Path "${path}"is invalid!`);
            }
            return request as unknown as string;
        }
        return null;
    };

    protected getEntityValueNullable = (request: Request, path: string): string => {
        if (path !== null && path !== undefined) {
            const split = path.split('.');
            for (const str of split) {
                if (!request) {
                    break;
                }
                request = request[str];
            }
            return request as unknown as string;
        }
        return null;
    };
}
