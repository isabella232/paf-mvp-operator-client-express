import {Express} from "express";
import cors, {CorsOptions} from "cors";
import {OperatorClient} from "./operator-client";
import {GetIdPrefsResponse, IdAndPrefs} from "paf-mvp-core-js/src/model/generated-model";
import {NewPrefs} from "paf-mvp-core-js/src/model/model";
import {jsonEndpoints, redirectEndpoints, signAndVerifyEndpoints, uriParams} from "paf-mvp-core-js/src/endpoints";
import {getMandatoryQueryStringParam, getReturnUrl, httpRedirect} from "paf-mvp-core-js/src/express";
import {PublicKeys} from "paf-mvp-core-js/src/crypto/keys";

export const addOperatorClientProxyEndpoints = (app: Express, protocol: 'https'|'http', operatorHost: string, sender: string, privateKey: string, allowedOrigins: string[], publicKeys: PublicKeys) => {
    const client = new OperatorClient(protocol, operatorHost, sender, privateKey, publicKeys)

    const corsOptions: CorsOptions = {
        origin: allowedOrigins,
        optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
        credentials: true,
        allowedHeaders: ['Content-Type']
    };

    // *****************************************************************************************************************
    // ******************************************************************************************************* REDIRECTS
    // *****************************************************************************************************************

    app.get(`/prebid${redirectEndpoints.read}`, cors(corsOptions), (req, res) => {
        const returnUrl = getReturnUrl(req, res);
        if (returnUrl) {
            httpRedirect(res, client.getRedirectReadUrl(returnUrl.toString()).toString(), 302)
        }
    });

    app.get(`/prebid${redirectEndpoints.write}`, cors(corsOptions), (req, res) => {
        const returnUrl = getReturnUrl(req, res);
        const input = JSON.parse(getMandatoryQueryStringParam(req, res, uriParams.data)) as IdAndPrefs;
        if (returnUrl) {
            // Note: signature is done on the fly
            httpRedirect(res, client.getRedirectWriteUrl(input, returnUrl.toString()).toString(), 302)
        }
    });

    // *****************************************************************************************************************
    // ************************************************************************************************************ JSON
    // *****************************************************************************************************************

    app.get(`/prebid${jsonEndpoints.read}`, cors(corsOptions), (req, res) => {
        httpRedirect(res, client.getJsonReadUrl().toString(), 302)
    });

    app.post(`/prebid${jsonEndpoints.write}`, cors(corsOptions), (req, res) => {
        // /!\ Notice return code 307!
        // Note: the message is assumed to be signed with signAndVerifyEndpoints.signWrite beforehand
        httpRedirect(res, client.getJsonWriteUrl().toString(), 307)
    });

    app.get(`/prebid${jsonEndpoints.verify3PC}`, cors(corsOptions), (req, res) => {
        httpRedirect(res, client.getJsonVerify3PCUrl().toString(), 302)
    });

    // *****************************************************************************************************************
    // *************************************************************************************************** SIGN & VERIFY
    // *****************************************************************************************************************

    app.post(`/prebid${signAndVerifyEndpoints.verifyRead}`, cors(corsOptions), (req, res) => {
        const message = JSON.parse(req.body as string) as GetIdPrefsResponse;
        res.send(client.verifyReadResponseSignature(message))
    });

    app.post(`/prebid${signAndVerifyEndpoints.signPrefs}`, cors(corsOptions), (req, res) => {
        const {identifier, optIn} = JSON.parse(req.body as string) as NewPrefs;
        res.send(client.buildPreferences(identifier, optIn))
    });

    app.post(`/prebid${signAndVerifyEndpoints.signWrite}`, cors(corsOptions), (req, res) => {
        const message = JSON.parse(req.body as string) as IdAndPrefs;
        res.send(client.buildPostIdPrefsRequest(message))
    });
}
