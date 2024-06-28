import {PermissionManagerPolicyInterface} from '@lib/base-library';
import {PermissionManagerImplPolicy} from './permission-manager-impl.policy';

const _permissionManagerPolicies = new PermissionManagerImplPolicy();

export const PermissionManagerPolicyConfig: PermissionManagerPolicyInterface = {
    getSchema: _permissionManagerPolicies.Read(),

    getPermission: _permissionManagerPolicies.Read(),
    setPermission: _permissionManagerPolicies.Create(),
    delPermission: _permissionManagerPolicies.Delete(),

    getPermissionGroup: _permissionManagerPolicies.Read(),
    getOnePermissionGroup: _permissionManagerPolicies.Read(),
    createPermissionGroup: _permissionManagerPolicies.Create(),
    updatePermissionGroup: _permissionManagerPolicies.Update(),
    delPermissionGroup: _permissionManagerPolicies.Delete(),

    getPermissionGroupUser: _permissionManagerPolicies.Read(),
    setPermissionGroupUser: _permissionManagerPolicies.Create(),
    delPermissionGroupUser: _permissionManagerPolicies.Delete(),

    getBannedPermission: _permissionManagerPolicies.Read(),
    setBannedPermission: _permissionManagerPolicies.Create(),
    delBannedPermission: _permissionManagerPolicies.Delete(),
};
