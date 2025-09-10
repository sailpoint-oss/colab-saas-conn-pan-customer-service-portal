import axios, { AxiosInstance } from "axios"
import axiosRetry from "axios-retry"
import { HTTP } from "./http";
import { logger as customLogger } from "../logger/logger"

export class AxiosWrapper implements HTTP {
    httpClient: AxiosInstance;
    constructor(baseUrl: string, token: string) {
        this.httpClient = axios.create({
            baseURL: baseUrl,
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        })

        // Wrap our Axios HTTP client in an Axios retry object to automatically
        // handle rate limiting.  By default, this logic will retry a given
        // API call 3 times before failing.  Read the documentation for 
        // axios-retry on NPM to see more configuration options.
        axiosRetry(this.httpClient, {
            retries: 15,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                // Only retry if the API call recieves an error code of 429
                if (error.response) {
                    if (error.response.status === 429) {
                        customLogger.info('Rate limited, retrying...')
                        return true;
                    } else {
                        return false;
                    }

                } else {
                    return false;
                }
            }

        })
    }

    async get<T = any>(url: string, data?: any) {
        try {
            return await this.httpClient.get<T>(url, data);
        } catch (error) {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            customLogger.error(`GET request failed for ${url}: ${errorMessage}`)
            throw error
        }
    }

    async post<T = any>(url: string, data?: any) {
        try {
            return await this.httpClient.post<T>(url, data);
        } catch (error) {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            customLogger.error(`POST request failed for ${url}: ${errorMessage}`)
            throw error
        }
    }

    async patch<T = any>(url: string, data?: any) {
        try {
            return await this.httpClient.patch<T>(url, data);
        } catch (error) {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            customLogger.error(`PATCH request failed for ${url}: ${errorMessage}`)
            throw error
        }
    }

    async delete<T = any>(url: string, data?: any) {
        try {
            return await this.httpClient.delete<T>(url, data);
        } catch (error) {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            customLogger.error(`DELETE request failed for ${url}: ${errorMessage}`)
            throw error
        }
    }

    async put<T = any>(url: string, data?: any) {
        try {
            return await this.httpClient.put<T>(url, data);
        } catch (error) {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            customLogger.error(`PUT request failed for ${url}: ${errorMessage}`)
            throw error
        }
    }

    async putFormData<T = any>(url: string, data?: any, headers?: any) {
        try {
            const formData = new URLSearchParams();
            for (const key in data) {
                formData.append(key, data[key]);
            }
            return await this.httpClient.put<T>(url, formData.toString(), { headers: headers });
        } catch (error) {
            const errorMessage = error instanceof Error ? `${error.message}\nStack: ${error.stack}` : String(error)
            customLogger.error(`PUT FormData request failed for ${url}: ${errorMessage}`)
            throw error
        }
    }

    // Update the authentication wtih the latest access token
    async updateAuth() {
        this.httpClient = axios.create({
            baseURL: globalThis.__BASE_URL,
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + globalThis.__ACCESS_TOKEN
            }
        })
    }
}