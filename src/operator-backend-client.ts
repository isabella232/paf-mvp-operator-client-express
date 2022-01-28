import {Request, Response} from "express";
import {OperatorClient,} from "./operator-client";
import winston from "winston";
import UAParser from "ua-parser-js";
import {GetIdPrefsResponse, IdAndOptionalPreferences} from "paf-mvp-core-js/src/model/generated-model";
import {Cookies, fromCookieValues, getPrebidDataCacheExpiration, UNKNOWN_TO_OPERATOR} from "paf-mvp-core-js/src/cookies";
import {httpRedirect, metaRedirect, setCookie} from "paf-mvp-core-js/src/express";
import {uriParams} from "paf-mvp-core-js/src/endpoints";
import {isBrowserKnownToSupport3PC} from "paf-mvp-core-js/src/user-agent";
import {PublicKeys} from "paf-mvp-core-js/src/crypto/keys";

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

export const getRequestUrl = (req: Request, path = req.url) => new URL(path, `${req.protocol}://${req.get('host')}`).toString()

const saveCookieValueOrUnknown = <T>(res: Response, cookieName: string, cookieValue: T|undefined) => {
    logger.info(`Operator returned value for ${cookieName}: ${cookieValue !== undefined ? 'YES' : 'NO'}`)

    const valueToStore = cookieValue ? JSON.stringify(cookieValue) : UNKNOWN_TO_OPERATOR

    logger.info(`Save ${cookieName} value: ${valueToStore}`)

    setCookie(res, cookieName, valueToStore, getPrebidDataCacheExpiration())

    return valueToStore;
}

export class OperatorBackendClient {
    client: OperatorClient;

    constructor(protocol: 'https'|'http', host: string, sender: string, privateKey: string, protected publicKeys: PublicKeys, private redirectType: RedirectType = RedirectType.http) {
        if (![RedirectType.http, RedirectType.meta].includes(redirectType)) {
            throw "Only backend redirect types are supported"
        }

        this.client = new OperatorClient(protocol, host, sender, privateKey, publicKeys)
    }

    getIdAndPreferencesOrRedirect(req: Request, res: Response, view: string): IdAndOptionalPreferences|undefined {
        const uriData = req.query[uriParams.data] as string

        const foundData = this.processGetIdAndPreferencesOrRedirect(req, uriData, res, view);

        if (foundData) {
            logger.info('Serve HTML', foundData)
        } else {
            logger.info('redirect')
        }

        return foundData;
    }

    private processGetIdAndPreferencesOrRedirect(req: Request, uriData: string, res: Response, view: string): IdAndOptionalPreferences|undefined {
        // 1. Any Prebid 1st party cookie?
        const cookies = getCookies(req);

        const id = cookies[Cookies.ID];
        const rawPreferences = cookies[Cookies.PREFS];

        if (id && rawPreferences) {
            logger.info('Cookie found: YES')

            return fromCookieValues(id, rawPreferences)
        }

        logger.info('Cookie found: NO')

        // 2. Redirected from operator?
        if (uriData) {
            logger.info('Redirected from operator: YES')
            const operatorData = JSON.parse(uriData ?? '{}') as GetIdPrefsResponse

            if (!this.client.verifyReadResponseSignature(operatorData)) {
                throw 'Verification failed'
            }

            // 3. Received data?


            const returnedId = operatorData.body.identifiers?.[0]
            const hasPersistedId = returnedId?.persisted === undefined || returnedId?.persisted

            saveCookieValueOrUnknown(res, Cookies.ID, hasPersistedId ? returnedId : undefined);
            saveCookieValueOrUnknown(res, Cookies.PREFS, operatorData.body.preferences);

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

            const redirectUrl = this.client.getRedirectReadUrl(getRequestUrl(req)).toString();
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
