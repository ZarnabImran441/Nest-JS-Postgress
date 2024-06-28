import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class PurgeFoldersAndTasks extends GenericCrudPolicies<EntityTypeOptions.PurgeFoldersAndTasks> {
    constructor() {
        super(EntityTypeOptions.PurgeFoldersAndTasks);
    }
}
