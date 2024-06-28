import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';

export class WorkflowPolicies extends GenericCrudPolicies<EntityTypeOptions.Workflow> {
    constructor() {
        super(EntityTypeOptions.Workflow);
    }
}
