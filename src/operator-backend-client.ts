import {Request, Response} from "express";
import {OperatorClient,} from "./operator-client";
import winston from "winston";
import UAParser from "ua-parser-js";
import {
    GetIdsPrefsResponse,
    IdsAndOptionalPreferences,
    RedirectGetIdsPrefsResponse
} from "paf-mvp-core-js/dist/model/generated-model";
import {
    Cookies,
    fromCookieValues,
    getPrebidDataCacheExpiration,
    UNKNOWN_TO_OPERATOR
} from "paf-mvp-core-js/dist/cookies";
import {httpRedirect, metaRedirect, setCookie, getPafDataFromQueryString} from "paf-mvp-core-js/dist/express";
import {isBrowserKnownToSupport3PC} from "paf-mvp-core-js/dist/user-agent";
import {PublicKeys} from "paf-mvp-core-js/dist/crypto/keys";
import {GetIdsPrefsRequestBuilder} from "paf-mvp-core-js/dist/model/request-builders";

export enum RedirectType {
    http = "http",
    meta = "meta",
    javascript = "javascript",
}

const logger = winston.createLogger({
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console());
}

export const getCookies = (req: Request) => req.cookies ?? {}

export const getRequestUrl = (req: Request, path = req.url) => new URL(path, `${req.protocol}://${req.get('host')}`)

const saveCookieValueOrUnknown = <T>(res: Response, cookieName: string, cookieValue: T | undefined) => {
    logger.info(`Operator returned value for ${cookieName}: ${cookieValue !== undefined ? 'YES' : 'NO'}`)

    const valueToStore = cookieValue ? JSON.stringify(cookieValue) : UNKNOWN_TO_OPERATOR

    logger.info(`Save ${cookieName} value: ${valueToStore}`)

    setCookie(res, cookieName, valueToStore, getPrebidDataCacheExpiration())

    return valueToStore;
}

export class OperatorBackendClient {
    client: OperatorClient;
    private getIdsPrefsRequestBuilder: GetIdsPrefsRequestBuilder;

    constructor(protocol: 'https' | 'http', host: string, sender: string, privateKey: string, protected publicKeys: PublicKeys, private redirectType: RedirectType = RedirectType.http) {
        if (![RedirectType.http, RedirectType.meta].includes(redirectType)) {
            throw "Only backend redirect types are supported"
        }

        this.getIdsPrefsRequestBuilder = new GetIdsPrefsRequestBuilder(protocol, host, sender, privateKey)

        this.client = new OperatorClient(protocol, host, sender, privateKey, publicKeys)
    }

    getIdsAndPreferencesOrRedirect(req: Request, res: Response, view: string): IdsAndOptionalPreferences | undefined {
        const uriData = getPafDataFromQueryString<RedirectGetIdsPrefsResponse>(req);

        const foundData = this.processGetIdsAndPreferencesOrRedirect(req, uriData, res, view);

        if (foundData) {
            logger.info('Serve HTML', foundData)
        } else {
            logger.info('redirect')
        }

        return foundData;
    }

    private processGetIdsAndPreferencesOrRedirect(req: Request, uriData: RedirectGetIdsPrefsResponse | undefined, res: Response, view: string): IdsAndOptionalPreferences | undefined {
        // 1. Any Prebid 1st party cookie?
        const cookies = getCookies(req);

        const rawIds = cookies[Cookies.identifiers];
        const rawPreferences = cookies[Cookies.preferences];

        if (rawIds && rawPreferences) {
            logger.info('Cookie found: YES')

            return fromCookieValues(rawIds, rawPreferences)
        }

        logger.info('Cookie found: NO')

        // 2. Redirected from operator?
        if (uriData) {
            logger.info('Redirected from operator: YES')

            if (!uriData.response) {
                // FIXME do something smart in case of error
                throw uriData.error
            }

            const operatorData = uriData.response

            if (!this.client.verifyReadResponseSignature(operatorData)) {
                throw 'Verification failed'
            }

            // 3. Received data?
            const persistedIds = operatorData.body.identifiers.filter(identifier => identifier?.persisted !== false);
            saveCookieValueOrUnknown(res, Cookies.identifiers, persistedIds.length === 0 ? undefined : persistedIds)
            saveCookieValueOrUnknown(res, Cookies.preferences, operatorData.body.preferences);

            return operatorData.body
        }

        logger.info('Redirected from operator: NO')

        // 4. Browser known to support 3PC?
        const userAgent = new UAParser(req.header('user-agent'));

        if (isBrowserKnownToSupport3PC(userAgent.getBrowser())) {
            logger.info('Browser known to support 3PC: YES')

            return fromCookieValues(undefined, undefined);
        } else {
            logger.info('Browser known to support 3PC: NO')

            const request = this.getIdsPrefsRequestBuilder.buildRequest()
            const redirectRequest = this.getIdsPrefsRequestBuilder.toRedirectRequest(request, getRequestUrl(req))

            const redirectUrl =  this.getIdsPrefsRequestBuilder.getRedirectUrl(redirectRequest).toString()
            switch (this.redirectType) {
                case RedirectType.http:
                    httpRedirect(res, redirectUrl)
                    break
                case RedirectType.meta:
                    metaRedirect(res, redirectUrl, view)
                    break;
            }

            return undefined;
        }
    }
}
