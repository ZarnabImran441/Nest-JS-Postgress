import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class DisplacementGroupPolicies extends GenericCrudPolicies<EntityTypeOptions.DisplacementGroup> {
    constructor() {
        super(EntityTypeOptions.DisplacementGroup);
    }
}
