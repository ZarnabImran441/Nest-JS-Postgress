import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
import {Request} from 'express';

export class CustomFieldValuePolicies extends GenericCrudPolicies<EntityTypeOptions.CustomFieldsValue> {
    constructor() {
        super(EntityTypeOptions.CustomFieldsValue);
    }

    ReadCustomFieldValue(): PolicyHandlerType {
        return async (can: IsUserAuthorizedToDoType, _request: Request) => {
            return (
                (await can(PermissionOptions.READ, EntityTypeOptions.UserCustomFieldsDefinition)) ||
                (await can(PermissionOptions.READ, EntityTypeOptions.CommonCustomFieldsDefinition))
            );
        };
    }
}
