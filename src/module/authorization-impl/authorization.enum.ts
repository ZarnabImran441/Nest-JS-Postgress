// import {PermissionStatusOptions} from '@lib/base-library';

export enum PermissionStatusOptions {
    ALLOW = 'allow',
    DISALLOW = 'disallow',
    UNSET = 'unset',
}

export enum PermissionOptions {
    NONE = 0,
    ///////////////////////
    LOGIN = 1 << 0, // 1
    CREATE = 1 << 1, // 2
    DELETE = 1 << 2, // 4
    UPDATE = 1 << 3, // 8
    READ = 1 << 4, // 16
    OWNER = 1 << 5, // 32
    FULL = 1 << 6, // 64
    EDITOR = 1 << 7, // 128
    PRIVATE = 1 << 8, // 256

    ///////////////////////

    // Shorthand permissions
    EDITOR_FULL = EDITOR | FULL,
    READ_UPDATE = READ | UPDATE,
    READ_DELETE = READ | DELETE,
    READ_UPDATE_DELETE = READ | UPDATE | DELETE,
    CREATE_READ_UPDATE = CREATE | READ | UPDATE,
    CREATE_UPDATE_DELETE = CREATE | UPDATE | DELETE,
    CREATE_READ_UPDATE_DELETE = CREATE | READ | UPDATE | DELETE,
    OWNER_READ = OWNER | READ,
    OWNER_UPDATE = OWNER | UPDATE,
    OWNER_READ_CREATE = OWNER | READ | CREATE,
    OWNER_READ_DELETE = OWNER | READ | DELETE,
    OWNER_READ_UPDATE_DELETE = OWNER | READ | UPDATE | DELETE,
    FULL_READ_UPDATE_DELETE = FULL | READ | UPDATE | DELETE,
    FULL_EDITOR_READ = FULL | EDITOR | READ,
    OWNER_CREATE = OWNER | CREATE,
    OWNER_DELETE = OWNER | DELETE,
    OWNER_READ_UPDATE = OWNER | READ | UPDATE,
    OWNER_FULL_EDITOR_READ = OWNER | FULL | EDITOR | READ,
    OWNER_FULL_EDITOR = OWNER | FULL | EDITOR,
    OWNER_FULL = OWNER | FULL,

    // TASK_ASSIGNEE = READ & UPDATE & ASSIGNEE,
    // OWNER_ASSIGNEE = OWNER | ASSIGNEE,
    // OWNER_ASSIGNEE_READ = OWNER | ASSIGNEE | READ,
    OWNER_CREATE_READ_UPDATE_DELETE = OWNER | CREATE | READ | UPDATE | DELETE,
    // ALL = ~(~0 << 6),
}

export enum EntityTypeOptions {
    Folder = 'folder',
    User = 'user',
    Workflow = 'workflow',
    CommonTag = 'commonTag',
    UserTag = 'userTag',
    CommonCustomFieldsDefinition = 'commonCustomFieldsDefinition',
    UserCustomFieldsDefinition = 'userCustomFieldsDefinition',
    CustomFieldsValue = 'CustomFieldsValue',
    TreeView = 'treeView',
    FolderWorkflow = 'folderWorkflow',
    FolderFilter = 'folderFilter',
    Importance = 'importance',
    Notification = 'notification',
    PermissionManager = 'permission-manager',
    Approval = 'approval',
    DisplacementGroup = 'displacementGroup',
    PurgeFoldersAndTasks = 'purgeFoldersAndTasks',
    Dashboard = 'dashboard',
    Widget = 'widget',
    replaceFolderOwner = 'replaceFolderOwner',
    customFieldCollection = 'customFieldCollection',
    Teams = 'teams',
    Space = 'space',
    FolderSpace = 'folderSpace',
    TagsCollection = 'tagsCollection',
}

//Confused where to put these
export const DefaultPermissonsOptions = [
    {
        role: EntityTypeOptions.UserTag,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.UserCustomFieldsDefinition,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.CustomFieldsValue,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    // {
    //     role: EntityTypeOptions.TaskAction,
    //     permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    // },
    {
        role: EntityTypeOptions.Notification,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    // {
    //     role: EntityTypeOptions.Task,
    //     permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    // },
    {
        role: EntityTypeOptions.TreeView,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    // {
    //     role: EntityTypeOptions.TagsTasksFolder,
    //     permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    // },
    {
        role: EntityTypeOptions.FolderFilter,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    // {
    //     role: EntityTypeOptions.TaskAttachments,
    //     permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    // },
    {
        role: EntityTypeOptions.Approval,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.User,
        permissions: PermissionOptions.LOGIN | PermissionOptions.CREATE_READ_UPDATE,
    },
    //////////////////////////////////////
    {
        role: EntityTypeOptions.Folder,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.FolderWorkflow,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.DisplacementGroup,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.PurgeFoldersAndTasks,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    //////////////////////////////////////
    {
        role: EntityTypeOptions.CommonCustomFieldsDefinition,
        permissions: PermissionOptions.READ,
    },
    {
        role: EntityTypeOptions.Importance,
        permissions: PermissionOptions.READ,
    },
    {
        role: EntityTypeOptions.Workflow,
        permissions: PermissionOptions.READ,
    },
    {
        role: EntityTypeOptions.CommonTag,
        permissions: PermissionOptions.READ,
    },
    //////////////////////////////////////
    {
        role: EntityTypeOptions.PermissionManager,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.Dashboard,
        permissions: PermissionOptions.READ,
    },
    {
        role: EntityTypeOptions.Widget,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.replaceFolderOwner,
        permissions: PermissionOptions.CREATE_READ_UPDATE_DELETE,
    },
    {
        role: EntityTypeOptions.Teams,
        permissions: PermissionOptions.READ,
    },
    {
        role: EntityTypeOptions.customFieldCollection,
        permissions: PermissionOptions.READ,
    },
    {role: EntityTypeOptions.Teams, permissions: PermissionOptions.READ},
    {role: EntityTypeOptions.Space, permissions: PermissionOptions.READ},
    {role: EntityTypeOptions.TagsCollection, permissions: PermissionOptions.READ},
];

export const PermissionsStatusOptions = [
    {
        label: 'Allow',
        value: PermissionStatusOptions.ALLOW,
    },
    {
        label: 'Disallow',
        value: PermissionStatusOptions.DISALLOW,
    },
    {
        label: 'Un-set',
        value: PermissionStatusOptions.UNSET,
    },
];
