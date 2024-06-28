import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';

export class TreeViewPolicies extends GenericCrudPolicies<EntityTypeOptions.TreeView> {
    constructor() {
        super(EntityTypeOptions.TreeView);
    }
}
