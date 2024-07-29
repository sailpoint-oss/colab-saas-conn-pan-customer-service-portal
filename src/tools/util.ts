import { ConnectorError, StdAccountCreateInput, StdAccountCreateOutput, StdEntitlementListOutput } from "@sailpoint/connector-sdk";
import { Role } from "../model/role";
import { User } from "../model/user";

export class Util {

    // Utility to convert the suer object to the standard output
    public userToAccount(user: User): StdAccountCreateOutput {
        return {
            identity: user.email ? user.email : '',
            uuid: user.userAccountId ? user.userAccountId.toString() : '',
            attributes: {
                userAccountId: user.userAccountId ? user.userAccountId : '',
                supportAccountId: user.supportAccountId ? user.supportAccountId : '',
                activationDate: user.activationDate ? user.activationDate : '',
                email: user.email ? user.email : '',
                roles: user.roles ? user.roles.map(entitlement => { return `${entitlement.id}` }) : null,
                description: user.description ? user.description : '',
                membershipId: user.membershipId ? user.membershipId : ''
            }
        }
    }

    // Utility to convert an entitlement to a standard output
    public roleToEntitlement(role: Role): StdEntitlementListOutput {
        return {
            identity: role.id ? role.id.toString() : '',
            uuid: role.id ? role.id.toString() : '',
            type: role.type ? role.type : 'role',
            attributes: {
                id: role.id ? role.id : '',
                name: role.name ? role.name : '',
                description: role.description ? role.description : '',
                type: role.type ? role.type : 'role',
            }
        }

    }
}