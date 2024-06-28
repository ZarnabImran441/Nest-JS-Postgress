import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class FolderFilterPolicies extends GenericCrudPolicies<EntityTypeOptions.FolderFilter> {
    constructor() {
        super(EntityTypeOptions.FolderFilter);
    }
}
