import { AttributeChange, ConnectorError, StdAccountCreateInput, StdAccountCreateOutput, StdEntitlementListOutput } from "@sailpoint/connector-sdk";
import { Role } from "../model/role";
import { User } from "../model/user";

export class Util {

    // Utility to convert the suer object to the standard output
    public userToAccount(user: User): StdAccountCreateOutput {
        return {
            identity: user.membershipId ? user.membershipId : '',
            uuid: user.membershipId ? user.membershipId : '',
            attributes: {
                membershipId: user.membershipId ? user.membershipId : '',
                userAccountId: user.userAccountId ? user.userAccountId : '',
                supportAccountId: user.supportAccountId ? user.supportAccountId : '',
                activationDate: user.activationDate ? user.activationDate : '',
                expirationDate: user.expirationDate ? user.expirationDate : '',
                IIQDisabled: user.IIQDisabled ? user.IIQDisabled : false,
                email: user.email ? user.email : '',
                roles: user.roles ? user.roles.map(entitlement => { return `${entitlement.id}` }) : null,
                description: user.description ? user.description : ''
            }
        }
    }

    public accountToUser(input: StdAccountCreateInput): User {
        const user = new User()
        const roles: Role[] = []

        if (input.attributes['roles'] != null) {
            if (!Array.isArray(input.attributes['roles'])) {
                input.attributes['roles'] = [input.attributes['roles']]
            }
            for (var role of input.attributes['roles']) {
                if (typeof role !== 'string') {
                    throw new ConnectorError('Invalid entitlement type: ' + role)
                }
                var userRole = new Role()
                userRole.id = Number(role)
                roles.push(userRole)
            }
        }

        // Set all the attributes we will when creating
        user.firstName = input.attributes.firstName
        user.lastName = input.attributes.lastName
        user.email = input.attributes.email

        // Set all the attributes we will when updating
        user.roles = roles
        user.membershipId = input.attributes.membershipId
        user.description = input.attributes.description

        return user
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

    // Sets an attribute on an account
    public accountSet(account: StdAccountCreateOutput, c: AttributeChange) {
        account.attributes[c.attribute] = c.value
    }

    // Adds an attribute on an account
    public accountAdd(account: StdAccountCreateOutput, c: AttributeChange) {
        const attribute: string[] = <string[]>account.attributes[c.attribute]
        if (attribute == null) {
            account.attributes[c.attribute] = c.value
        } else {
            if (c.attribute != 'roles') {
                throw new ConnectorError('Cannot add value to attribute: ' + c.attribute)
            }
    
            if (Array.isArray(c.value)) {
                account.attributes[c.attribute] = attribute.concat(c.value)
            } else {
                attribute.push(c.value)
            }
        }
    }

    // Remove an attribute from an account
    public accountRemove(account: StdAccountCreateOutput, c: AttributeChange) {
        if (c.attribute == 'roles') {
            if (Array.isArray(c.value)) {
                c.value.forEach(v => {
                    const attribute: string[] = <string[]>account.attributes[c.attribute]
                    const position = attribute.indexOf(v, 0)
                    if (position > -1) {
                        attribute.splice(position, 1)
                    }
                })
            } else {
                const attribute: string[] = <string[]>account.attributes[c.attribute]
                const position = attribute.indexOf(c.value, 0)
                if (position > -1) {
                    attribute.splice(position, 1)
                }
            }
        } else if (account.attributes[c.attribute] != null) {
            account.attributes[c.attribute] = null
        }
    }
}