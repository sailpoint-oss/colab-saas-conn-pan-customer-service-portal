import {
    Context,
    createConnector,
    readConfig,
    Response,
    logger,
    StdAccountListOutput,
    StdAccountReadInput,
    StdAccountReadOutput,
    StdTestConnectionOutput,
    StdAccountListInput,
    StdTestConnectionInput,
    StdEntitlementListInput,
    StdEntitlementListOutput,
    StdEntitlementReadInput,
    StdEntitlementReadOutput,
    StdAccountCreateInput,
    StdAccountCreateOutput,
    StdAccountDisableOutput,
    StdAccountDisableInput,
    StdAccountEnableInput,
    StdAccountEnableOutput,
    ConnectorError,
    StdAccountUpdateInput,
    StdAccountUpdateOutput,
    StdAccountDeleteInput,
    StdAccountDeleteOutput,
    AttributeChangeOp
} from '@sailpoint/connector-sdk'
import { PanCspClient } from './pan-csp-client'
import { Util } from './tools/util'
import { logger as customLogger } from "./logger/logger"


// Connector must be exported as module property named connector
export const connector = async () => {

    // Get connector source config
    const config = await readConfig()

    // Setup Util
    const util = new Util();

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const myClient = new PanCspClient(config)

    return createConnector()
        .stdTestConnection(async (context: Context, input: StdTestConnectionInput, res: Response<StdTestConnectionOutput>) => {
            try {
                customLogger.info("Running test connection")
                const result = await myClient.testConnection()
                res.send(result)
                customLogger.info("Test connection completed successfully")
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Test connection failed: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            try {
                customLogger.debug("Running stdAccountList.")
                const accounts = await myClient.getAllAccounts()
                for (const account of accounts) {
                    res.send(util.userToAccount(account))
                }
                customLogger.info(`stdAccountList sent ${accounts.length} accounts`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account list failed: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            try {
                customLogger.debug("Running stdAccountRead.")
                const account = await myClient.getAccount(input.identity)
                res.send(util.userToAccount(account))
                customLogger.info(`stdAccountRead read account : ${input.identity}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account read failed for identity ${input.identity}: ${errorMessage}`)
                throw error
            }
        })
        .stdEntitlementList(async (context: Context, input: StdEntitlementListInput, res: Response<StdEntitlementListOutput>) => {
            try {
                customLogger.debug("Running stdEntitlementList.")
                var entitlements = await myClient.getAllRoles()
                for (const entitlement of entitlements) {
                    res.send(util.roleToEntitlement(entitlement))
                }
                customLogger.info(`stdEntitlementList sent ${entitlements.length} entitlements`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Entitlement list failed: ${errorMessage}`)
                throw error
            }
        })
        .stdEntitlementRead(async (context: Context, input: StdEntitlementReadInput, res: Response<StdEntitlementReadOutput>) => {
            try {
                customLogger.debug("Running stdEntitlementRead.")
                const entitlement = await myClient.getRole(input.identity)
                res.send(util.roleToEntitlement(entitlement))
                customLogger.info(`stdEntitlementRead read entitlement : ${input.identity}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Entitlement read failed for identity ${input.identity}: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountCreate(async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
            try {
                customLogger.debug(input, 'account create input object')
                const user = await myClient.createAccount(util.accountToUser(input))
                customLogger.debug(user, 'new PAN user object')
                res.send(util.userToAccount(user))
                customLogger.info(`Account created successfully for: ${input.attributes.email}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account create failed for ${input.attributes.email}: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountEnable(async (context: Context, input: StdAccountEnableInput, res: Response<StdAccountEnableOutput>) => {
            try {
                customLogger.debug(input, 'account enable input object')
                const user = await myClient.getAccount(input.identity)
                const enabled = await myClient.enableAccount(user)
                res.send(util.userToAccount(enabled))
                customLogger.info(`Account enabled successfully for: ${input.identity}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account enable failed for ${input.identity}: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountDisable(async (context: Context, input: StdAccountDisableInput, res: Response<StdAccountDisableOutput>) => {
            try {
                customLogger.debug(input, 'account disable input object')
                const user = await myClient.getAccount(input.identity)
                const disabled = await myClient.disableAccount(user)
                res.send(util.userToAccount(disabled))
                customLogger.info(`Account disabled successfully for: ${input.identity}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account disable failed for ${input.identity}: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountUpdate(async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
            try {
                customLogger.debug(input, 'account update input object')
                //Check that the user currently exists
                const origUser = await myClient.getAccount(input.identity)
                if (!origUser)
                    throw new ConnectorError(`User ${input.identity} does not exist or does not exist in this tenant.`)
                customLogger.debug(origUser, 'Prisma CSP user found')
                const account = util.userToAccount(origUser)

                input.changes.forEach(c => {
                    switch (c.op) {
                        case AttributeChangeOp.Add:
                            util.accountAdd(account, c)
                            break
                        case AttributeChangeOp.Set:
                            util.accountSet(account, c)
                            break
                        case AttributeChangeOp.Remove:
                            util.accountRemove(account, c)
                            break
                        default:
                            throw new ConnectorError('Unknown account change op: ' + c.op)
                    }
                })

                const preUpdateUser = util.accountToUser(account)
                const updatedUser = await myClient.updateAccount(preUpdateUser)
                res.send(util.userToAccount(updatedUser))
                customLogger.info(`Account updated successfully for: ${input.identity}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account update failed for ${input.identity}: ${errorMessage}`)
                throw error
            }
        })
        .stdAccountDelete(async (context: Context, input: StdAccountDeleteInput, res: Response<StdAccountDeleteOutput>) => {
            try {
                customLogger.debug(input, 'account delete input object')
                const deleted = await myClient.deleteAccount(input.identity)
                if (!deleted) {
                    throw new ConnectorError(`User ${input.identity} does was not disabled.`)
                }
                res.send({})
                customLogger.info(`Account deleted successfully for: ${input.identity}`)
            } catch (error) {
                const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
                customLogger.error(`Account delete failed for ${input.identity}: ${errorMessage}`)
                throw error
            }
        })
}
