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
    StdEntitlementReadOutput
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
}
