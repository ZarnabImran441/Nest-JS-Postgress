import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';

export class TeamsPolicies extends GenericCrudPolicies<EntityTypeOptions.Teams> {
    constructor() {
        super(EntityTypeOptions.Teams);
    }
}
