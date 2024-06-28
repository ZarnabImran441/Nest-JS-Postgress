// import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
// import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
// import {Request} from 'express';
// import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
//
// export class TaskPolicies extends GenericCrudPolicies<EntityTypeOptions.Task> {
//     constructor() {
//         super(EntityTypeOptions.Task);
//     }
//
//     //Todo : Do it validation in one call
//     UpdateManyTasks(path: string): PolicyHandlerType {
//         return async (can: IsUserAuthorizedToDoType, request: Request) => {
//             const taskIds = this.getEntityValue(request, path);
//
//             // const resp = await can(PermissionOptions.OWNER_UPDATE, this.entityType, taskIds);
//
//             const response = [];
//             for (const id of taskIds) {
//                 const resp = await can(PermissionOptions.OWNER_UPDATE, this.entityType, id);
//                 response.push(resp);
//             }
//             if (response.includes(false)) {
//                 return false;
//             }
//             return true;
//         };
//     }
//
//     //Anyone with READ|OWNER|EDITOR|FULL (FOLDER) && READ|OWNER|ASSIGNEE (TASK)
//     OwnerAssigneeRead(path: string): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, request: Request) => {
//             return can(PermissionOptions.OWNER_ASSIGNEE_READ, this.entityType, this.getEntityValue(request, path));
//         };
//     }
//
//     //Owner will only have update permissions
//     OwnerUpdate(path: string): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, request: Request) => {
//             return can(PermissionOptions.OWNER_UPDATE, this.entityType, this.getEntityValue(request, path));
//         };
//     }
//
//     OwnerDelete(path: string): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, request: Request) => {
//             return can(PermissionOptions.OWNER_DELETE, this.entityType, this.getEntityValue(request, path));
//         };
//     }
//
//     // folder owner | folder full | owner task 1 & owner of task 2
//     CreateTaskDependency(): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, request: Request) => {
//             return (
//                 can(PermissionOptions.OWNER_FULL, EntityTypeOptions.Folder, request.body.folderId) ||
//                 (can(PermissionOptions.OWNER, this.entityType, this.getEntityValue(request, request.body.predecessorId)) &&
//                     can(PermissionOptions.OWNER, this.entityType, this.getEntityValue(request, request.body.successorId)))
//             );
//         };
//     }
//
//     OwnerAssignee(path: string): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, request: Request) => {
//             return can(PermissionOptions.OWNER_ASSIGNEE, this.entityType, this.getEntityValue(request, path));
//         };
//     }
//
//     DeleteTaskDependency(): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, request: Request) => {
//             return (
//                 can(PermissionOptions.OWNER, this.entityType, request.params.predecessor_id) &&
//                 can(PermissionOptions.OWNER, this.entityType, request.params.successor_id)
//             );
//         };
//     }
// }
