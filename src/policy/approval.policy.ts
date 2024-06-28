import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';
import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';

export class ApprovalPolicies extends GenericCrudPolicies<EntityTypeOptions.Approval> {
    constructor() {
        super(EntityTypeOptions.Approval);
    }

    // Assignee(path: string): PolicyHandlerType {
    //     return (can: IsUserAuthorizedToDoType, request: Request) => {
    //         return can(PermissionOptions.ASSIGNEE, this.entityType, this.getEntityValue(request, path));
    //     };
    // }
    // OwnerOrAssignee(path: string): PolicyHandlerType {
    //     return (can: IsUserAuthorizedToDoType, request: Request) => {
    //         return can(PermissionOptions.OWNER_ASSIGNEE, this.entityType, this.getEntityValue(request, path));
    //     };
    // }
}
