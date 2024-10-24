import { ConnectorError, logger } from "@sailpoint/connector-sdk"
import { auth, check_token_expiration, dateCustomFormatting, dateCustomFormattingZeros } from "./tools/generic-functions"
import { HTTPFactory } from "./http/http-factory"
import { User } from "./model/user"
import { Role } from "./model/role"
import { rolesRef } from "./data/roles"
import { AxiosError } from "axios"

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
        globalThis.__USER_PAUSE = config?.userUpdatePause ? config?.userUpdatePause : 750
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
            user.userAccountId = csp_u.userAccountId.toString()
            user.supportAccountId = csp_u.supportAccountId.toString()
            user.activationDate = csp_u.activationDate
            user.expirationDate = csp_u.expirationDate
            user.email = csp_u.email
            user.description = csp_u.description
            user.membershipId = csp_u.membershipId.toString()
            // Check if active
            let date = new Date()
            const dateFormat = dateCustomFormatting(date)
            if (user.expirationDate && user.expirationDate < dateFormat) {
                user.IIQDisabled = true
            }

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
        // Grab max of 1000 person - limitation on PAN CSP APIs
        const response = await httpClient.get('/v2/memberships/support-account?size=1000').catch((error: unknown) => {
            throw new ConnectorError(`Failed to retrieve csp users: ${error}`)
        })
        let user = new User()
        let userFound = false

        for (var csp_u of response.data.data) {
            if (csp_u.membershipId == identity || csp_u.email == identity) {
                userFound = true
                user.userAccountId = csp_u.userAccountId.toString()
                user.supportAccountId = csp_u.supportAccountId.toString()
                user.activationDate = csp_u.activationDate
                user.expirationDate = csp_u.expirationDate
                user.email = csp_u.email
                user.description = csp_u.description
                user.membershipId = csp_u.membershipId.toString()
                // Check if active
                let date = new Date()
                const dateFormat = dateCustomFormatting(date)
                if (user.expirationDate && user.expirationDate < dateFormat) {
                    user.IIQDisabled = true
                }
                user.roles = []
                const cspRoleMap = new Map(Array.from(rolesRef, a => [a.name, a.id]))
                for (var memRole of csp_u.membershipRoles) {
                    let role = new Role()
                    role.name = memRole.roleName
                    role.id = cspRoleMap.get(memRole.roleName)!
                    user.roles.push(role)
                }
            }
        }
        if(!userFound) {
            throw new ConnectorError(`Failed to retrieve user ${identity}`)
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

    async createAccount(user: User): Promise<User> {
        if (!user.email) {
            throw new ConnectorError(`User email cannot be null.`)
        }
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        let userExists = false

        // Create user object
        await httpClient.post<void>(`/v2/users`, {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        }).catch((error: AxiosError) => {
            if (error.message == "Request failed with status code 422") {
                userExists = true
            } else {
                throw new ConnectorError(`Error creating CSP account for ${user.email} ` + error.message)
            }
        })

        console.log(`User already has a membership - updating them.`)
        if (userExists) {
            let numRoles = user.roles.map(a => a.id)
            await httpClient.post<void>(`/v2/memberships`, {
                email: user.email,
                membershipRoles: numRoles
            }).catch((error: AxiosError) => {
                throw new ConnectorError(`Error creating CSP account for user that already exists ${user.email} ` + error.message)
            })
        }

        // Pause for the PAN API to catchup
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.email)

        return newUser
    }

    async disableAccount(user: User): Promise<User> {
        if (!user.membershipId) {
            throw new ConnectorError(`User membership ID cannot be null to disable user.`)
        }
        if (!user.email) {
            throw new ConnectorError(`User email ID cannot be null to disable user.`)
        }
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let numRoles = user.roles.map(a => a.id)
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        let date = new Date()
        date.setHours(date.getHours() - 7);
        const dateFormat = dateCustomFormattingZeros(date)

        console.log(`date: ${date} month: ${date.getUTCMonth()}`)

        let body = {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: dateFormat,
            description: 'User disabled by SailPoint.'
        }
        console.log(JSON.stringify(body))

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: dateFormat,
            description: 'User disabled by SailPoint.'
        }).catch((error: AxiosError) => {
            throw new ConnectorError(`Failed to disable ${user.email}: ` + error.message)
        })

        // Pause for the PAN API to catchup
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.membershipId)
        return newUser
    }

    async enableAccount(user: User): Promise<User> {
        if (!user.membershipId) {
            throw new ConnectorError(`User membership ID cannot be null to disable user.`)
        }
        if (!user.email) {
            throw new ConnectorError(`User email ID cannot be null to disable user.`)
        }
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let numRoles = user.roles.map(a => a.id)
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        const dateFormat = `2199-12-31 00:00:00`

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: dateFormat,
            description: 'User enabled by SailPoint.'
        }).catch((error: AxiosError) => {
            throw new ConnectorError(error.message)
        })

        // Pause for the PAN API to catchup
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.membershipId)
        return newUser
    }

    async deleteAccount(membershipId: string): Promise<boolean> {
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);

        await httpClient.delete<void>(`/v2/memberships/${membershipId}`).catch((error: AxiosError) => {
            throw new ConnectorError(`Error delting account with membership id ${membershipId}: ` + error.message)
        })

        return true
    }

    async assignMembershipRoles(email: string, roles: Role[]): Promise<boolean> {
        /*
            This API is to be used only if a user is already a CSP user and a member of a different CSP support account, 
            and needs to be added to this CSP support account.
        */
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);

        await httpClient.post<void>(`/v2/memberships`, {
            email: email,
            membershipRoles: roles
        }).catch((error: AxiosError) => {
            throw new ConnectorError(error.message)
        })

        return true
    }

    async setMembershipRoles(membershipId: string, roles: Role[]): Promise<boolean> {
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let numRoles = roles.map(a => a.id)
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: membershipId,
            membershipRoles: numRoles
        }).catch((error: AxiosError) => {
            throw new ConnectorError(error.message)
        })

        return true
    }

    async updateAccount(user: User): Promise<User> {
        if (!user.membershipId) {
            throw new ConnectorError(`User membership ID cannot be null to update user.`)
        }
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let numRoles = user.roles.map(a => a.id)
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: user.expirationDate,
            description: user.description
        }).catch((error: AxiosError) => {
            throw new ConnectorError(error.message)
        })

        // Pause for the PAN API to catchup
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.membershipId)
        return newUser
    }
}
