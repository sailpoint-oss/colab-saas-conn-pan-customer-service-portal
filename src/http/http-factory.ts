import { AxiosWrapper } from "./axios-wrapper";
import { HTTP } from "./http";

export class HTTPFactory {
    static getHTTP(baseUrl: string, token: string): HTTP {
        return new AxiosWrapper(baseUrl, token)
    }
}