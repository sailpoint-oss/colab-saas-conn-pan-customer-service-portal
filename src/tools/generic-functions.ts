import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import { logger as customLogger } from '../logger/logger'

export function dateCustomFormatting(date: Date): string {
    const padStart = (value: number): string =>
        value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${padStart(date.getMonth()+1)}-${padStart(date.getDate())} ${padStart(date.getHours())}:${padStart(date.getMinutes())}:${padStart(date.getSeconds())}`;
}

export function dateCustomFormattingZeros(date: Date): string {
    const padStart = (value: number): string =>
        value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${padStart(date.getMonth()+1)}-${padStart(date.getDate())} 00:00:00`;
}


// Function to check if a token is still good
export async function check_token_expiration(exp_time: number) {
    // Check EXPIRATION_TIME
    let now = 0
    now = Date.now();
    customLogger.info('now Time =        ' + now)
    customLogger.info('Expiration Time = ' + exp_time)
    
    if (exp_time) {
        customLogger.info('Current time (ISO): ' + new Date(now).toISOString())
        customLogger.info('Expiration time (ISO): ' + new Date(exp_time).toISOString())
    }
    
    const time_buffer = 250
    let valid_token = 'valid'
    if (!exp_time) {
        customLogger.info('######### Expiration Time is undefined')
        valid_token = 'undefined'
    }
    else {
        if (exp_time - time_buffer <= now) {
            customLogger.info('Expiration Time is in the past')
            customLogger.info('Time difference: ' + (exp_time - now) + 'ms')
            valid_token = 'expired'
        }
        else {
            customLogger.info('### Expiration Time is in the future:  No need to Re-Authenticate')
            customLogger.info('Time until expiration: ' + (exp_time - now) + 'ms')
            valid_token = 'valid'
        }
    }

    return valid_token
}

// Function to perform the authentication and retrieve a token.
export async function auth() {
    let base64data = Buffer.from(globalThis.__CLIENT_ID + ':' + globalThis.__CLIENT_SECRET).toString('base64')
    const authorization = 'Basic ' + base64data

    const axios = require('axios');
    const qs = require('querystring');
    const data = {
        grant_type: 'client_credentials',
        scope: 'user-management'
    };

    // set the headers
    const config = {
        method: 'post',
        rejectUnauthorized: false,
        url: globalThis.__AUTHURL,
        data: qs.stringify(data),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authorization
        }
    };

    try {
        customLogger.info('Making authentication request...')
        let resAuth = await axios(config)
        customLogger.info('Authentication successful')
        customLogger.info('Response status: ' + resAuth.status)
        customLogger.info('Response data keys: ' + Object.keys(resAuth.data || {}).join(', '))
        
        // Store res data in Global variable
        let now = 0
        now = Date.now();
        globalThis.__ACCESS_TOKEN = resAuth.data.access_token
        globalThis.__EXPIRATION_TIME = now + (resAuth.data.expires_in * 1000)
        
        customLogger.info('Access token stored: ' + (globalThis.__ACCESS_TOKEN ? globalThis.__ACCESS_TOKEN.substring(0, 20) + '...' : 'undefined'))
        customLogger.info('Expiration time: ' + new Date(globalThis.__EXPIRATION_TIME).toISOString())
        
        return resAuth
    } catch (err: any) {
        customLogger.error('Authentication failed:')
        if (err.response) {
            customLogger.error('  Status: ' + err.response.status)
            customLogger.error('  Status Text: ' + err.response.statusText)
            customLogger.error('  Response Data: ' + JSON.stringify(err.response.data, null, 2))
        }
        const errorMessage = err instanceof Error ? `${err.name} :: ${err.message}\nStack: ${err.stack}` : `${err.name} :: ${err.message}`
        throw new ConnectorError(errorMessage)
    }
}