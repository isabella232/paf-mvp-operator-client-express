"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addOperatorClientProxyEndpoints = void 0;
const cors_1 = __importDefault(require("cors"));
const operator_client_1 = require("./operator-client");
const endpoints_1 = require("paf-mvp-core-js/dist/endpoints");
const express_1 = require("paf-mvp-core-js/dist/express");
const addOperatorClientProxyEndpoints = (app, protocol, operatorHost, sender, privateKey, allowedOrigins, publicKeys) => {
    const client = new operator_client_1.OperatorClient(protocol, operatorHost, sender, privateKey, publicKeys);
    const corsOptions = {
        origin: allowedOrigins,
        optionsSuccessStatus: 200,
        credentials: true,
        allowedHeaders: ['Content-Type']
    };
    // *****************************************************************************************************************
    // ******************************************************************************************************* REDIRECTS
    // *****************************************************************************************************************
    app.get(`/prebid${endpoints_1.redirectEndpoints.read}`, (0, cors_1.default)(corsOptions), (req, res) => {
        const returnUrl = (0, express_1.getReturnUrl)(req, res);
        if (returnUrl) {
            (0, express_1.httpRedirect)(res, client.getRedirectReadUrl(returnUrl.toString()).toString(), 302);
        }
    });
    app.get(`/prebid${endpoints_1.redirectEndpoints.write}`, (0, cors_1.default)(corsOptions), (req, res) => {
        const returnUrl = (0, express_1.getReturnUrl)(req, res);
        const input = JSON.parse((0, express_1.getMandatoryQueryStringParam)(req, res, endpoints_1.uriParams.data));
        if (returnUrl) {
            // Note: signature is done on the fly
            (0, express_1.httpRedirect)(res, client.getRedirectWriteUrl(input, returnUrl.toString()).toString(), 302);
        }
    });
    // *****************************************************************************************************************
    // ************************************************************************************************************ JSON
    // *****************************************************************************************************************
    app.get(`/prebid${endpoints_1.jsonEndpoints.read}`, (0, cors_1.default)(corsOptions), (req, res) => {
        (0, express_1.httpRedirect)(res, client.getJsonReadUrl().toString(), 302);
    });
    app.post(`/prebid${endpoints_1.jsonEndpoints.write}`, (0, cors_1.default)(corsOptions), (req, res) => {
        // /!\ Notice return code 307!
        // Note: the message is assumed to be signed with signAndVerifyEndpoints.signWrite beforehand
        (0, express_1.httpRedirect)(res, client.getJsonWriteUrl().toString(), 307);
    });
    app.get(`/prebid${endpoints_1.jsonEndpoints.verify3PC}`, (0, cors_1.default)(corsOptions), (req, res) => {
        (0, express_1.httpRedirect)(res, client.getJsonVerify3PCUrl().toString(), 302);
    });
    // *****************************************************************************************************************
    // *************************************************************************************************** SIGN & VERIFY
    // *****************************************************************************************************************
    app.post(`/prebid${endpoints_1.signAndVerifyEndpoints.verifyRead}`, (0, cors_1.default)(corsOptions), (req, res) => {
        const message = JSON.parse(req.body);
        res.send(client.verifyReadResponseSignature(message));
    });
    app.post(`/prebid${endpoints_1.signAndVerifyEndpoints.signPrefs}`, (0, cors_1.default)(corsOptions), (req, res) => {
        const { identifier, optIn } = JSON.parse(req.body);
        res.send(client.buildPreferences(identifier, optIn));
    });
    app.post(`/prebid${endpoints_1.signAndVerifyEndpoints.signWrite}`, (0, cors_1.default)(corsOptions), (req, res) => {
        const message = JSON.parse(req.body);
        res.send(client.buildPostIdPrefsRequest(message));
    });
};
exports.addOperatorClientProxyEndpoints = addOperatorClientProxyEndpoints;
//# sourceMappingURL=operator-client-proxy.js.map