import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class CommonCustomFieldPolicies extends GenericCrudPolicies<EntityTypeOptions.CommonCustomFieldsDefinition> {
    constructor() {
        super(EntityTypeOptions.CommonCustomFieldsDefinition);
    }
}

export class UserCustomFieldPolicies extends GenericCrudPolicies<EntityTypeOptions.UserCustomFieldsDefinition> {
    constructor() {
        super(EntityTypeOptions.UserCustomFieldsDefinition);
    }
}
