"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorBackendClient = exports.getRequestUrl = exports.getCookies = exports.RedirectType = void 0;
const operator_client_1 = require("./operator-client");
const winston_1 = __importDefault(require("winston"));
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const cookies_1 = require("paf-mvp-core-js/dist/cookies");
const express_1 = require("paf-mvp-core-js/dist/express");
const endpoints_1 = require("paf-mvp-core-js/dist/endpoints");
const user_agent_1 = require("paf-mvp-core-js/dist/user-agent");
var RedirectType;
(function (RedirectType) {
    RedirectType["http"] = "http";
    RedirectType["meta"] = "meta";
    RedirectType["javascript"] = "javascript";
})(RedirectType = exports.RedirectType || (exports.RedirectType = {}));
const logger = winston_1.default.createLogger({
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console()
    ],
});
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console());
}
const getCookies = (req) => { var _a; return (_a = req.cookies) !== null && _a !== void 0 ? _a : {}; };
exports.getCookies = getCookies;
const getRequestUrl = (req, path = req.url) => new URL(path, `${req.protocol}://${req.get('host')}`).toString();
exports.getRequestUrl = getRequestUrl;
const saveCookieValueOrUnknown = (res, cookieName, cookieValue) => {
    logger.info(`Operator returned value for ${cookieName}: ${cookieValue !== undefined ? 'YES' : 'NO'}`);
    const valueToStore = cookieValue ? JSON.stringify(cookieValue) : cookies_1.UNKNOWN_TO_OPERATOR;
    logger.info(`Save ${cookieName} value: ${valueToStore}`);
    (0, express_1.setCookie)(res, cookieName, valueToStore, (0, cookies_1.getPrebidDataCacheExpiration)());
    return valueToStore;
};
class OperatorBackendClient {
    constructor(protocol, host, sender, privateKey, publicKeys, redirectType = RedirectType.http) {
        this.publicKeys = publicKeys;
        this.redirectType = redirectType;
        if (![RedirectType.http, RedirectType.meta].includes(redirectType)) {
            throw "Only backend redirect types are supported";
        }
        this.client = new operator_client_1.OperatorClient(protocol, host, sender, privateKey, publicKeys);
    }
    getIdAndPreferencesOrRedirect(req, res, view) {
        const uriData = req.query[endpoints_1.uriParams.data];
        const foundData = this.processGetIdAndPreferencesOrRedirect(req, uriData, res, view);
        if (foundData) {
            logger.info('Serve HTML', foundData);
        }
        else {
            logger.info('redirect');
        }
        return foundData;
    }
    processGetIdAndPreferencesOrRedirect(req, uriData, res, view) {
        var _a;
        // 1. Any Prebid 1st party cookie?
        const cookies = (0, exports.getCookies)(req);
        const id = cookies[cookies_1.Cookies.ID];
        const rawPreferences = cookies[cookies_1.Cookies.PREFS];
        if (id && rawPreferences) {
            logger.info('Cookie found: YES');
            return (0, cookies_1.fromCookieValues)(id, rawPreferences);
        }
        logger.info('Cookie found: NO');
        // 2. Redirected from operator?
        if (uriData) {
            logger.info('Redirected from operator: YES');
            const operatorData = JSON.parse(uriData !== null && uriData !== void 0 ? uriData : '{}');
            if (!this.client.verifyReadResponseSignature(operatorData)) {
                throw 'Verification failed';
            }
            // 3. Received data?
            const returnedId = (_a = operatorData.body.identifiers) === null || _a === void 0 ? void 0 : _a[0];
            const hasPersistedId = (returnedId === null || returnedId === void 0 ? void 0 : returnedId.persisted) === undefined || (returnedId === null || returnedId === void 0 ? void 0 : returnedId.persisted);
            saveCookieValueOrUnknown(res, cookies_1.Cookies.ID, hasPersistedId ? returnedId : undefined);
            saveCookieValueOrUnknown(res, cookies_1.Cookies.PREFS, operatorData.body.preferences);
            return operatorData.body;
        }
        logger.info('Redirected from operator: NO');
        // 4. Browser known to support 3PC?
        const userAgent = new ua_parser_js_1.default(req.header('user-agent'));
        if ((0, user_agent_1.isBrowserKnownToSupport3PC)(userAgent.getBrowser())) {
            logger.info('Browser known to support 3PC: YES');
            return (0, cookies_1.fromCookieValues)(undefined, undefined);
        }
        else {
            logger.info('Browser known to support 3PC: NO');
            const redirectUrl = this.client.getRedirectReadUrl((0, exports.getRequestUrl)(req)).toString();
            switch (this.redirectType) {
                case RedirectType.http:
                    (0, express_1.httpRedirect)(res, redirectUrl);
                    break;
                case RedirectType.meta:
                    (0, express_1.metaRedirect)(res, redirectUrl, view);
                    break;
            }
            return undefined;
        }
    }
}
exports.OperatorBackendClient = OperatorBackendClient;
//# sourceMappingURL=operator-backend-client.js.map