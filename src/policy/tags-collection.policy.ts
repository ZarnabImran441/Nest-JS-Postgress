import {GenericCrudPolicies} from '../module/authorization-impl/generic-crud-policies.service';
import {EntityTypeOptions} from '../module/authorization-impl/authorization.enum';

export class TagsCollectionPolicies extends GenericCrudPolicies<EntityTypeOptions.TagsCollection> {
    constructor() {
        super(EntityTypeOptions.TagsCollection);
    }
}
