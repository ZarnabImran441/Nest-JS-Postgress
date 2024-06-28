import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';

//add type in migration enum
export class FolderWorkFlowPolicies extends GenericCrudPolicies<EntityTypeOptions.FolderWorkflow> {
    constructor() {
        super(EntityTypeOptions.FolderWorkflow);
    }
}
