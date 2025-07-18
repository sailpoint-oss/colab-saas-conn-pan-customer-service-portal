import { ConnectorError, logger } from "@sailpoint/connector-sdk"
import { auth, check_token_expiration, dateCustomFormatting, dateCustomFormattingZeros } from "./tools/generic-functions"
import { HTTPFactory } from "./http/http-factory"
import { User } from "./model/user"
import { Role } from "./model/role"
import { rolesRef } from "./data/roles"
import { AxiosError } from "axios"
import { logger as customLogger } from "./logger/logger"

export class PanCspClient {
    constructor(config: any) {
        customLogger.info('PanCspClient.constructor: Initializing PAN CSP client')
        
        // Fetch necessary properties from config.
        // Remove trailing slash in URL if present.  Then store in Global Variables.
        if (config?.baseURL.substr(config?.baseURL.length - 1) == '/') {
            globalThis.__BASE_URL = config?.baseURL.substr(0, config?.baseURL.length - 1)
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
        
        customLogger.info(`PanCspClient.constructor: Configuration loaded - BaseURL: ${globalThis.__BASE_URL}, AuthURL: ${globalThis.__AUTHURL}, UserPause: ${globalThis.__USER_PAUSE}ms`)
    }

    async checkTokenValidity(): Promise<void> {
        customLogger.debug('PanCspClient.checkTokenValidity: Checking token expiration')
        
        var expiration = globalThis.__EXPIRATION_TIME

        let valid_token = await check_token_expiration(expiration)
        if ((valid_token == 'undefined') || (valid_token == 'expired')) {
            customLogger.info('PanCspClient.checkTokenValidity: Token is undefined or expired, re-authenticating')
            let resAuth = await auth()
            logger.info(`Auth Status : ${JSON.stringify(resAuth.status)}`)

        }
        else if (valid_token == 'valid') {
            customLogger.debug('PanCspClient.checkTokenValidity: Token is valid, no re-authentication needed')
        }
    }

    async getAllAccounts(): Promise<User[]> {
        customLogger.info('PanCspClient.getAllAccounts: Starting to retrieve all accounts')
        
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        
        let allUsers: User[] = []
        let page = 0
        let hasMoreData = true
        
        customLogger.info('PanCspClient.getAllAccounts: Starting pagination to fetch all users')
        
        while (hasMoreData) {
            // Add debugging information
            const url = `/v2/memberships/support-account?size=100&page=${page}`
            customLogger.debug(`PanCspClient.getAllAccounts: Making GET request to: ${globalThis.__BASE_URL}${url}`)
            customLogger.debug(`PanCspClient.getAllAccounts: Using access token: ${globalThis.__ACCESS_TOKEN ? globalThis.__ACCESS_TOKEN.substring(0, 20) + '...' : 'undefined'}`)
            
            // Grab users with pagination - API limit is 100 per request
            const response = await httpClient.get(url).catch((error: unknown) => {
                // Enhanced error logging for debugging
                if (error instanceof Error && 'response' in error) {
                    const axiosError = error as any
                    customLogger.error('PanCspClient.getAllAccounts: HTTP Error Details:')
                    customLogger.error(`PanCspClient.getAllAccounts:   Status: ${axiosError.response?.status}`)
                    customLogger.error(`PanCspClient.getAllAccounts:   Status Text: ${axiosError.response?.statusText}`)
                    customLogger.error(`PanCspClient.getAllAccounts:   Response Data: ${JSON.stringify(axiosError.response?.data, null, 2)}`)
                    customLogger.error(`PanCspClient.getAllAccounts:   Request URL: ${axiosError.config?.url}`)
                    customLogger.error(`PanCspClient.getAllAccounts:   Request Method: ${axiosError.config?.method}`)
                }
                
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                throw new ConnectorError(`Failed to retrieve csp users: ${errorMessage}`)
            })

            customLogger.debug(`PanCspClient.getAllAccounts: Response status: ${response.status}`)
            customLogger.debug(`PanCspClient.getAllAccounts: Response data keys: ${Object.keys(response.data || {}).join(', ')}`)

            const pageUsers: User[] = []
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
                pageUsers.push(user)
            }
            
            customLogger.info(`PanCspClient.getAllAccounts: Retrieved ${pageUsers.length} users from page ${page}`)
            allUsers = allUsers.concat(pageUsers)
            
            // Check if there are more pages
            // If we got less than 100 users, we've reached the end
            // Or if the response data is empty
            if (pageUsers.length < 100 || response.data.data.length === 0) {
                hasMoreData = false
                customLogger.info(`PanCspClient.getAllAccounts: No more pages available. Total users retrieved: ${allUsers.length}`)
            } else {
                page++
                customLogger.debug(`PanCspClient.getAllAccounts: Moving to next page: ${page}`)
            }
        }
        
        customLogger.info(`PanCspClient.getAllAccounts: Completed retrieving all accounts. Total count: ${allUsers.length}`)
        return allUsers
    }

    async getAccount(identity: string): Promise<User> {
        customLogger.info(`PanCspClient.getAccount: Starting to retrieve account for identity: ${identity}`)
        
        await this.checkTokenValidity()
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        
        // Grab users with pagination - API limit is 100 per request
        const response = await httpClient.get('/v2/memberships/support-account?size=100').catch((error: unknown) => {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            throw new ConnectorError(`Failed to retrieve csp users: ${errorMessage}`)
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
            customLogger.error(`PanCspClient.getAccount: User not found for identity: ${identity}`)
            throw new ConnectorError(`Failed to retrieve user ${identity}`)
        }
        
        customLogger.info(`PanCspClient.getAccount: Successfully retrieved account for identity: ${identity}`)
        return user
    }

    async getAllRoles(): Promise<Role[]> {
        customLogger.info('PanCspClient.getAllRoles: Retrieving all roles from static reference')
        let roles: Role[] = []
        roles = rolesRef
        customLogger.info(`PanCspClient.getAllRoles: Retrieved ${roles.length} roles`)
        return roles
    }

    async getRole(identity: string): Promise<Role> {
        customLogger.info(`PanCspClient.getRole: Retrieving role for identity: ${identity}`)
        let entitlement = new Role()
        for (var csp_role of rolesRef) {
            if (csp_role.id.toString() == identity)
                entitlement = csp_role
        }
        customLogger.info(`PanCspClient.getRole: Retrieved role: ${entitlement.name} for identity: ${identity}`)
        return entitlement
    }

    async testConnection(): Promise<any> {
        customLogger.info('PanCspClient.testConnection: Starting test connection')
        
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        // Use the memberships endpoint - size 10 is the minimum
        const response = await httpClient.get('/v2/memberships/support-account?size=10').catch((error: unknown) => {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            throw new ConnectorError(`Unable to complete test connection: ${errorMessage}`)
        })
        if (response.status !== 200) {
            customLogger.error(`PanCspClient.testConnection: Test connection failed with status: ${response.status}`)
            throw new ConnectorError(`Unable to complete test connectionj, returned status: ${response.status}`)
        }

        customLogger.info('PanCspClient.testConnection: Test connection completed successfully')
        return {}
    }

    async createAccount(user: User): Promise<User> {
        customLogger.info(`PanCspClient.createAccount: Starting account creation for email: ${user.email}`)
        
        if (!user.email) {
            customLogger.error('PanCspClient.createAccount: User email cannot be null')
            throw new ConnectorError(`User email cannot be null.`)
        }
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()

        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        let userExists = false

        // Create user object
        customLogger.debug(`PanCspClient.createAccount: Creating user with email: ${user.email}`)
        await httpClient.post<void>(`/v2/users`, {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        }).catch((error: AxiosError) => {
            if (error.message == "Request failed with status code 422") {
                userExists = true
                customLogger.info(`PanCspClient.createAccount: User already exists, will update membership`)
            } else {
                const errorMessage = `${error.message}\nStack: ${error.stack}`
                throw new ConnectorError(`Error creating CSP account for ${user.email} ${errorMessage}`)
            }
        })

        if (userExists) {
            customLogger.info(`PanCspClient.createAccount: User already has a membership - updating them`)
            let numRoles = user.roles.map(a => a.id)
            await httpClient.post<void>(`/v2/memberships`, {
                email: user.email,
                membershipRoles: numRoles
            }).catch((error: AxiosError) => {
                const errorMessage = `${error.message}\nStack: ${error.stack}`
                throw new ConnectorError(`Error creating CSP account for user that already exists ${user.email} ${errorMessage}`)
            })
        }

        // Pause for the PAN API to catchup
        customLogger.debug(`PanCspClient.createAccount: Pausing for ${globalThis.__USER_PAUSE}ms for API to catch up`)
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.email)

        customLogger.info(`PanCspClient.createAccount: Account creation completed successfully for email: ${user.email}`)
        return newUser
    }

    async disableAccount(user: User): Promise<User> {
        customLogger.info(`PanCspClient.disableAccount: Starting account disable for membership ID: ${user.membershipId}`)
        
        if (!user.membershipId) {
            customLogger.error('PanCspClient.disableAccount: User membership ID cannot be null to disable user')
            throw new ConnectorError(`User membership ID cannot be null to disable user.`)
        }
        if (!user.email) {
            customLogger.error('PanCspClient.disableAccount: User email ID cannot be null to disable user')
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

        customLogger.debug(`PanCspClient.disableAccount: Setting expiration date to: ${dateFormat}`)

        let body = {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: dateFormat,
            description: 'User disabled by SailPoint.'
        }
        customLogger.debug(`PanCspClient.disableAccount: Request body: ${JSON.stringify(body)}`)

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: dateFormat,
            description: 'User disabled by SailPoint.'
        }).catch((error: AxiosError) => {
            const errorMessage = `${error.message}\nStack: ${error.stack}`
            throw new ConnectorError(`Failed to disable ${user.email}: ${errorMessage}`)
        })

        // Pause for the PAN API to catchup
        customLogger.debug(`PanCspClient.disableAccount: Pausing for ${globalThis.__USER_PAUSE}ms for API to catch up`)
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.membershipId)
        
        customLogger.info(`PanCspClient.disableAccount: Account disable completed successfully for membership ID: ${user.membershipId}`)
        return newUser
    }

    async enableAccount(user: User): Promise<User> {
        customLogger.info(`PanCspClient.enableAccount: Starting account enable for membership ID: ${user.membershipId}`)
        
        if (!user.membershipId) {
            customLogger.error('PanCspClient.enableAccount: User membership ID cannot be null to enable user')
            throw new ConnectorError(`User membership ID cannot be null to disable user.`)
        }
        if (!user.email) {
            customLogger.error('PanCspClient.enableAccount: User email ID cannot be null to enable user')
            throw new ConnectorError(`User email ID cannot be null to disable user.`)
        }
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let numRoles = user.roles.map(a => a.id)
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);
        const dateFormat = `2199-12-31 00:00:00`

        customLogger.debug(`PanCspClient.enableAccount: Setting expiration date to: ${dateFormat}`)

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: user.membershipId,
            membershipRoles: numRoles,
            expirationDate: dateFormat,
            description: 'User enabled by SailPoint.'
        }).catch((error: AxiosError) => {
            const errorMessage = `${error.message}\nStack: ${error.stack}`
            throw new ConnectorError(errorMessage)
        })

        // Pause for the PAN API to catchup
        customLogger.debug(`PanCspClient.enableAccount: Pausing for ${globalThis.__USER_PAUSE}ms for API to catch up`)
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.membershipId)
        
        customLogger.info(`PanCspClient.enableAccount: Account enable completed successfully for membership ID: ${user.membershipId}`)
        return newUser
    }

    async deleteAccount(membershipId: string): Promise<boolean> {
        customLogger.info(`PanCspClient.deleteAccount: Starting account deletion for membership ID: ${membershipId}`)
        
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);

        await httpClient.delete<void>(`/v2/memberships/${membershipId}`).catch((error: AxiosError) => {
            const errorMessage = `${error.message}\nStack: ${error.stack}`
            throw new ConnectorError(`Error delting account with membership id ${membershipId}: ${errorMessage}`)
        })

        customLogger.info(`PanCspClient.deleteAccount: Account deletion completed successfully for membership ID: ${membershipId}`)
        return true
    }

    async assignMembershipRoles(email: string, roles: Role[]): Promise<boolean> {
        customLogger.info(`PanCspClient.assignMembershipRoles: Starting role assignment for email: ${email}`)
        
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
            const errorMessage = `${error.message}\nStack: ${error.stack}`
            throw new ConnectorError(errorMessage)
        })

        customLogger.info(`PanCspClient.assignMembershipRoles: Role assignment completed successfully for email: ${email}`)
        return true
    }

    async setMembershipRoles(membershipId: string, roles: Role[]): Promise<boolean> {
        customLogger.info(`PanCspClient.setMembershipRoles: Starting role setting for membership ID: ${membershipId}`)
        
        //Check expiration tiem for Bearer toekn in Global variable
        await this.checkTokenValidity()
        // Get the ids of the role into an array
        let numRoles = roles.map(a => a.id)
        let httpClient = HTTPFactory.getHTTP(globalThis.__BASE_URL, globalThis.__ACCESS_TOKEN);

        await httpClient.patch<void>(`/v2/membership`, {
            membershipId: membershipId,
            membershipRoles: numRoles
        }).catch((error: AxiosError) => {
            const errorMessage = `${error.message}\nStack: ${error.stack}`
            throw new ConnectorError(errorMessage)
        })

        customLogger.info(`PanCspClient.setMembershipRoles: Role setting completed successfully for membership ID: ${membershipId}`)
        return true
    }

    async updateAccount(user: User): Promise<User> {
        customLogger.info(`PanCspClient.updateAccount: Starting account update for membership ID: ${user.membershipId}`)
        
        if (!user.membershipId) {
            customLogger.error('PanCspClient.updateAccount: User membership ID cannot be null to update user')
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
            const errorMessage = `${error.message}\nStack: ${error.stack}`
            throw new ConnectorError(errorMessage)
        })

        // Pause for the PAN API to catchup
        customLogger.debug(`PanCspClient.updateAccount: Pausing for ${globalThis.__USER_PAUSE}ms for API to catch up`)
        await new Promise(f => setTimeout(f, globalThis.__USER_PAUSE));
        // Fetch representation of the user
        let newUser = await this.getAccount(user.membershipId)
        
        customLogger.info(`PanCspClient.updateAccount: Account update completed successfully for membership ID: ${user.membershipId}`)
        return newUser
    }
}
