import { ConnectorError, StandardCommand } from '@sailpoint/connector-sdk'
import { PanCspClient } from '../src/pan-csp-client'

const mockConfig: any = {
    token: 'xxx123'
}

describe('connector client unit tests', () => {

    const myClient = new PanCspClient(mockConfig)

    it('connector client test connection', async () => {
        expect(await myClient.testConnection()).toStrictEqual({})
    })

    it('connector client test connection', async () => {
        expect(await myClient.testConnection()).toStrictEqual({})
    })

    it('invalid connector client', async () => {
        try {
            new PanCspClient({})
        } catch (e) {
            expect(e instanceof ConnectorError).toBeTruthy()
        }
    })
})
