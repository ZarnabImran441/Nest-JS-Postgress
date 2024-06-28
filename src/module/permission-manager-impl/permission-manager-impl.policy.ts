import {GenericCrudPolicies} from '../authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../authorization-impl/authorization.enum';

export class PermissionManagerImplPolicy extends GenericCrudPolicies<EntityTypeOptions.PermissionManager> {
    constructor() {
        super(EntityTypeOptions.PermissionManager);
    }
}
