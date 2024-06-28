import {WorkflowPolicies} from './workflow.policy';
import {CommonCustomFieldPolicies, UserCustomFieldPolicies} from './custom-field-definition.policy';
import {CustomFieldValuePolicies} from './cutom-field-value.policy';
import {FolderFilterPolicies} from './folder-filter.policy';
import {FolderWorkFlowPolicies} from './folder-workflow.policy';
import {FolderPolicies} from './folder.policy';
import {CommonTagPolicies, UserTagPolicies} from './tag.policy';
import {TreeViewPolicies} from './tree-view.policy';
import {UserPolicies} from './user.policy';
import {ImportancePolicies} from './importance.policy';
import {NotificationPolicies} from './notification.policy';
import {ApprovalPolicies} from './approval.policy';
import {DisplacementGroupPolicies} from './displacement-group.policy';
import {PurgeFoldersAndTasks} from './purgeFoldersAndTasks.policy';
import {ReplaceFolderOwner} from './replaceFolderOwner.policy';

import {DashboardPolicy} from './dashboard.policy';
import {CustomFieldCollection} from './custom-field-collection.policy';
import {TeamsPolicies} from './teams.policy';
import {WidgetPolicy} from './widget.policy';
import {SpacePolicies} from './space.policy';
import {TagsCollectionPolicies} from './tags-collection.policy';

export const workflowPolicies = new WorkflowPolicies(),
    commonCustomFieldPolicies = new CommonCustomFieldPolicies(),
    userCustomFieldPolicies = new UserCustomFieldPolicies(),
    customFieldValuePolicies = new CustomFieldValuePolicies(),
    folderFilterPolicies = new FolderFilterPolicies(),
    folderWorkFlowPolicies = new FolderWorkFlowPolicies(),
    folderPolicies = new FolderPolicies(),
    commonTagPolicies = new CommonTagPolicies(),
    userTagPolicies = new UserTagPolicies(),
    treeViewPolicies = new TreeViewPolicies(),
    userPolicies = new UserPolicies(),
    importancePolicies = new ImportancePolicies(),
    notificationPolicies = new NotificationPolicies(),
    approvalPolicies = new ApprovalPolicies(),
    displacementGroupPolicies = new DisplacementGroupPolicies(),
    purgeFoldersAndTasks = new PurgeFoldersAndTasks(),
    dashboardPolicy = new DashboardPolicy(),
    replaceFolderOwner = new ReplaceFolderOwner(),
    customFieldCollection = new CustomFieldCollection(),
    widgetPolicy = new WidgetPolicy(),
    teamsPolicies = new TeamsPolicies(),
    spacePolicies = new SpacePolicies(),
    tagsCollectionPolicies = new TagsCollectionPolicies();
