import { ConnectorError, logger } from "@sailpoint/connector-sdk"
import { auth, check_token_expiration } from "./tools/generic-functions"
import { HTTPFactory } from "./http/http-factory"
import { User } from "./model/user"
import { Role } from "./model/role"
import { rolesRef } from "./data/roles"

export class PanCspClient {
    constructor(config: any) {
        // Fetch necessary properties from config.
        // Remove trailing slash in URL if present.  Then store in Global Variables.
        if (config?.baseURL.substr(config?.baseURL.length - 1) == '/') {
            globalThis.__BASE_URL = config?.baseURL.substr(0, config?.instance.length - 1)
        } else {
            globalThis.__BASE_URL = config?.baseURL
        }

        if (config?.authUrl.substr(config?.authUrl.length - 1) == '/') {
            globalThis.__AUTHURL = config?.authUrl.substr(0, config?.authUrl.length - 1)
        } else {
            globalThis.__AUTHURL = config?.authUrl
        }

        // Store Client Credentials in Global Variables
        globalThis.__CLIENT_ID = config?.client_id
        globalThis.__CLIENT_SECRET = config?.client_secret
        globalThis.__USER_PAUSE = config?.userUpdatePause ? config?.userUpdatePause : 500
    }

    async checkTokenValidity(): Promise<void> {
        var expiration = globalThis.__EXPIRATION_TIME

        let valid_token = await check_token_expiration(expiration)
        if ((valid_token == 'undefined') || (valid_token == 'expired')) {
            console.log('######### Expiration Time is undefined or in the past')
            let resAuth = await auth()
            logger.info(`Auth Status : ${JSON.stringify(resAuth.status)}`)

        }
        else if (valid_token == 'valid') {
            console.log('### Expiration Time is in the future:  No need to Re-Authenticate')
        }
    }

    async getAllAccounts(): Promise<User[]> {
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        // Grab max of 1000 person - limitation on PAN CSP APIs
        const response = await httpClient.get('/v2/memberships/support-account?size=1000').catch((error: unknown) => {
            throw new ConnectorError(`Failed to retrieve csp users: ${error}`)
        })

        let users: User[] = []
        for (var csp_u of response.data.data) {
            let user = new User()
            user.userAccountId = csp_u.userAccountId
            user.supportAccountId = csp_u.supportAccountId
            user.activationDate = csp_u.activationDate
            user.email = csp_u.email
            user.description = csp_u.description
            user.membershipId = csp_u.membershipId
            user.roles = []
            for (var memRole of csp_u.membershipRoles) {
                let role = new Role()
                role.name = memRole.roleName
                role.id = memRole.roleId
                user.roles.push(role)
            }
            users.push(user)
        }
        return users
    }

    async getAccount(identity: string): Promise<User> {
        await this.checkTokenValidity()
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        const response = await httpClient.get('/v2/memberships?email=' + identity).catch((error: unknown) => {
            throw new ConnectorError(`Failed to retrieve CSP profile for user ${identity}: ${error}`)
        })
        let user = new User()
        if (response.data.data.length > 0) {
            let csp_user_data = response.data.data[0]
            user.userAccountId = csp_user_data.userAccountId
            user.supportAccountId = csp_user_data.supportAccountId
            user.activationDate = csp_user_data.activationDate
            user.email = csp_user_data.email
            user.description = csp_user_data.description
            user.membershipId = csp_user_data.membershipId
            user.roles = []
            const cspRoleMap = new Map(Array.from(rolesRef, a => [a.name, a.id]))
            for (var memRole of csp_user_data.membershipRoles) {
                let role = new Role()
                role.name = memRole.roleName
                role.id = cspRoleMap.get(memRole.roleName)!
                user.roles.push(role)
            }
        }
        return user
    }

    async getAllRoles(): Promise<Role[]> {
        let roles: Role[] = []
        roles = rolesRef
        return roles
    }

    async getRole(identity: string): Promise<Role> {
        let entitlement = new Role()
        for (var csp_role of rolesRef) {
            if (csp_role.id.toString() == identity)
                entitlement = csp_role
        }
        return entitlement
    }

    async testConnection(): Promise<any> {
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        // Use the memberships endpoint - size 10 is the minimum
        const response = await httpClient.get('/v2/memberships/support-account?size=10').catch((error: unknown) => {
            throw new ConnectorError(`Unable to complete test connection: ${error}`)
        })
        if (response.status !== 200) {
            throw new ConnectorError(`Unable to complete test connectionj, returned status: ${response.status}`)
        }

        return {}
    }
}
