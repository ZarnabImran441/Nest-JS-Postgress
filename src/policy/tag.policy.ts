import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';

//** User should have create,update,delete permissions of the entity or can be the owner. */
//** we will validate task and folders with id's only not other  */
//** we will validate tags with roles */
//** Owership will on tasks and folders */
//** Remove owner from tags */

export class CommonTagPolicies extends GenericCrudPolicies<EntityTypeOptions.CommonTag> {
    constructor() {
        super(EntityTypeOptions.CommonTag);
    }
}

// Example usage in a subclass:
export class UserTagPolicies extends GenericCrudPolicies<EntityTypeOptions.UserTag> {
    constructor() {
        super(EntityTypeOptions.UserTag);
    }
}
