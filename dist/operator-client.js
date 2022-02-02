"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorClient = void 0;
const message_signature_1 = require("paf-mvp-core-js/dist/crypto/message-signature");
const data_signature_1 = require("paf-mvp-core-js/dist/crypto/data-signature");
const keys_1 = require("paf-mvp-core-js/dist/crypto/keys");
const endpoints_1 = require("paf-mvp-core-js/dist/endpoints");
// TODO all these methods should have signed messages
class OperatorClient {
    constructor(protocol, operatorHost, host, privateKey, publicKeys) {
        this.protocol = protocol;
        this.operatorHost = operatorHost;
        this.host = host;
        this.publicKeys = publicKeys;
        this.writeSigner = new message_signature_1.PostIdPrefsRequestSigner();
        this.readSigner = new message_signature_1.GetIdPrefsRequestSigner();
        this.readVerifier = new message_signature_1.GetIdPrefsResponseSigner();
        this.prefsSigner = new data_signature_1.PrefsSigner();
        this.ecdsaKey = (0, keys_1.privateKeyFromString)(privateKey);
    }
    addReadQS(url) {
        const message = this.buildGetIdPrefsRequest();
        url.searchParams.set(endpoints_1.uriParams.sender, message.sender);
        url.searchParams.set(endpoints_1.uriParams.receiver, message.receiver);
        url.searchParams.set(endpoints_1.uriParams.timestamp, message.timestamp.toString());
        url.searchParams.set(endpoints_1.uriParams.signature, message.signature);
    }
    verifyReadResponseSignature(message) {
        return this.readVerifier.verify(this.publicKeys[message.sender], message);
    }
    buildPostIdPrefsRequest(idAndPreferences, timestamp = new Date().getTime()) {
        const request = {
            body: idAndPreferences,
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        };
        return Object.assign(Object.assign({}, request), { signature: this.writeSigner.sign(this.ecdsaKey, request) });
    }
    buildGetIdPrefsRequest(timestamp = new Date().getTime()) {
        const request = {
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        };
        return Object.assign(Object.assign({}, request), { signature: this.readSigner.sign(this.ecdsaKey, request) });
    }
    buildGetNewIdRequest(timestamp = new Date().getTime()) {
        const request = {
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        };
        return Object.assign(Object.assign({}, request), { signature: this.readSigner.sign(this.ecdsaKey, request) });
    }
    getRedirectReadUrl(redirectUrl) {
        const url = this.getOperatorUrl(endpoints_1.redirectEndpoints.read, redirectUrl);
        this.addReadQS(url);
        return url;
    }
    getRedirectWriteUrl(idAndPreferences, redirectUrl) {
        if (!(idAndPreferences.identifiers.length > 0 || idAndPreferences.preferences)) {
            throw "Need something to write!";
        }
        const message = this.buildPostIdPrefsRequest(idAndPreferences);
        const url = this.getOperatorUrl(endpoints_1.redirectEndpoints.write, redirectUrl);
        url.searchParams.set(endpoints_1.uriParams.data, JSON.stringify(message));
        return url;
    }
    getJsonReadUrl() {
        const url = this.getOperatorUrl(endpoints_1.jsonEndpoints.read);
        const message = this.buildGetIdPrefsRequest();
        this.addReadQS(url);
        return url;
    }
    getJsonWriteUrl() {
        // Note: POST body is signed
        return this.getOperatorUrl(endpoints_1.jsonEndpoints.write);
    }
    getJsonVerify3PCUrl() {
        return this.getOperatorUrl(endpoints_1.jsonEndpoints.verify3PC);
    }
    buildPreferences(id, optIn, timestamp = new Date().getTime()) {
        const unsignedPreferences = {
            version: 0,
            data: {
                use_browsing_for_personalization: true
            },
            source: {
                domain: this.host,
                timestamp,
            }
        };
        const { source } = unsignedPreferences, rest = __rest(unsignedPreferences, ["source"]);
        return Object.assign(Object.assign({}, rest), { source: Object.assign(Object.assign({}, source), { signature: this.prefsSigner.sign(this.ecdsaKey, unsignedPreferences) }) });
    }
    getOperatorUrl(endpoint, returnUrl = undefined) {
        const redirectUrl = new URL(`${this.protocol}://${this.operatorHost}${endpoint}`);
        if (returnUrl) {
            redirectUrl.searchParams.set(endpoints_1.uriParams.returnUrl, returnUrl);
        }
        return redirectUrl;
    }
}
exports.OperatorClient = OperatorClient;
//# sourceMappingURL=operator-client.js.map