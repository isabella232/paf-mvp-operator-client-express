import { Request, Response } from "express";
import { OperatorClient } from "./operator-client";
import { IdAndOptionalPreferences } from "paf-mvp-core-js/dist/model/generated-model";
import { PublicKeys } from "paf-mvp-core-js/dist/crypto/keys";
export declare enum RedirectType {
    http = "http",
    meta = "meta",
    javascript = "javascript"
}
export declare const getCookies: (req: Request) => any;
export declare const getRequestUrl: (req: Request, path?: string) => string;
export declare class OperatorBackendClient {
    protected publicKeys: PublicKeys;
    private redirectType;
    client: OperatorClient;
    constructor(protocol: 'https' | 'http', host: string, sender: string, privateKey: string, publicKeys: PublicKeys, redirectType?: RedirectType);
    getIdAndPreferencesOrRedirect(req: Request, res: Response, view: string): IdAndOptionalPreferences | undefined;
    private processGetIdAndPreferencesOrRedirect;
}
