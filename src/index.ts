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
            logger.info("Running test connection")
            res.send(await myClient.testConnection())
        })
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            logger.debug("Running stdAccountList.")
            const accounts = await myClient.getAllAccounts()
            for (const account of accounts) {
                res.send(util.userToAccount(account))
            }
            logger.info(`stdAccountList sent ${accounts.length} accounts`)
        })
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            logger.debug("Running stdAccountRead.")
            const account = await myClient.getAccount(input.identity)
            res.send(util.userToAccount(account))
            logger.info(`stdAccountRead read account : ${input.identity}`)
        })
        .stdEntitlementList(async (context: Context, input: StdEntitlementListInput, res: Response<StdEntitlementListOutput>) => {
            logger.debug("Running stdEntitlementList.")
            var entitlements = await myClient.getAllRoles()
            for (const entitlement of entitlements) {
                res.send(util.roleToEntitlement(entitlement))
            }
            logger.info(`stdEntitlementList sent ${entitlements.length} entitlements`)
        })
        .stdEntitlementRead(async (context: Context, input: StdEntitlementReadInput, res: Response<StdEntitlementReadOutput>) => {
            logger.debug("Running stdEntitlementRead.")
            const entitlement = await myClient.getRole(input.identity)
            res.send(util.roleToEntitlement(entitlement))
            logger.info(`stdEntitlementRead read entitlement : ${input.identity}`)
        })
        .stdAccountCreate(async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
            logger.debug(input, 'account create input object')
            const user = await myClient.createAccount(util.accountToUser(input))
            logger.debug(user, 'new PAN user object')
            res.send(util.userToAccount(user))
        })
        .stdAccountEnable(async (context: Context, input: StdAccountEnableInput, res: Response<StdAccountEnableOutput>) => {
            logger.debug(input, 'account enable input object')
            const user = await myClient.getAccount(input.identity)
            const enabled = await myClient.enableAccount(user)
            res.send(util.userToAccount(enabled))
        })
        .stdAccountDisable(async (context: Context, input: StdAccountDisableInput, res: Response<StdAccountDisableOutput>) => {
            logger.debug(input, 'account disable input object')
            const user = await myClient.getAccount(input.identity)
            const disabled = await myClient.disableAccount(user)
            res.send(util.userToAccount(disabled))
        })
        .stdAccountUpdate(async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
            logger.debug(input, 'account update input object')
            //Check that the user currently exists
            const origUser = await myClient.getAccount(input.identity)
            if (!origUser)
                throw new ConnectorError(`User ${input.identity} does not exist or does not exist in this tenant.`)
            logger.debug(origUser, 'Prisma CSP user found')
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
        })
        .stdAccountDelete(async (context: Context, input: StdAccountDeleteInput, res: Response<StdAccountDeleteOutput>) => {
            logger.debug(input, 'account delete input object')
            const deleted = await myClient.deleteAccount(input.identity)
            if (!deleted) {
                throw new ConnectorError(`User ${input.identity} does was not disabled.`)
            }
            res.send({})
        })
}
