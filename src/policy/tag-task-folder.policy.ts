// import {IsUserAuthorizedToDoType, PolicyHandlerType} from '@lib/base-library';
// import {EntityTypeOptions, PermissionOptions} from '../module/authorization-impl/authorization.enum';
// import {Request} from 'express';
// import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
//
// export class TagsTasksFolderPolicies extends GenericCrudPolicies<EntityTypeOptions.TagsTasksFolder> {
//     constructor() {
//         super(EntityTypeOptions.TagsTasksFolder);
//     }
//
//     CreateFolderTaskTags(): PolicyHandlerType {
//         return (can: IsUserAuthorizedToDoType, _request: Request) => {
//             return (
//                 can(PermissionOptions.READ, EntityTypeOptions.CommonTag) ||
//                 (can(PermissionOptions.READ, EntityTypeOptions.UserTag) && can(PermissionOptions.CREATE, EntityTypeOptions.TagsTasksFolder))
//             );
//         };
//     }
// }
//
// // we can have multiple rules on a checkPolicies.
