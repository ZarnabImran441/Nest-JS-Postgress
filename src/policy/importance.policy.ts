import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class ImportancePolicies extends GenericCrudPolicies<EntityTypeOptions.Importance> {
    constructor() {
        super(EntityTypeOptions.Importance);
    }
}
