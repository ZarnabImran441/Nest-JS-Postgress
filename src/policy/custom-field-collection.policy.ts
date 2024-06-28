import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
export class CustomFieldCollection extends GenericCrudPolicies<EntityTypeOptions.customFieldCollection> {
    constructor() {
        super(EntityTypeOptions.customFieldCollection);
    }
}
