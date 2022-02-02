import { GetIdPrefsRequest, GetIdPrefsResponse, GetNewIdRequest, Identifier, IdAndPreferences, PostIdPrefsRequest, Preferences } from "paf-mvp-core-js/dist/model/generated-model";
import { PublicKeys } from "paf-mvp-core-js/dist/crypto/keys";
export declare class OperatorClient {
    protected protocol: 'https' | 'http';
    operatorHost: string;
    private host;
    protected publicKeys: PublicKeys;
    private readonly writeSigner;
    private readonly readSigner;
    private readonly readVerifier;
    private readonly prefsSigner;
    private readonly ecdsaKey;
    constructor(protocol: 'https' | 'http', operatorHost: string, host: string, privateKey: string, publicKeys: PublicKeys);
    private addReadQS;
    verifyReadResponseSignature(message: GetIdPrefsResponse): boolean;
    buildPostIdPrefsRequest(idAndPreferences: IdAndPreferences, timestamp?: number): PostIdPrefsRequest;
    buildGetIdPrefsRequest(timestamp?: number): GetIdPrefsRequest;
    buildGetNewIdRequest(timestamp?: number): GetNewIdRequest;
    getRedirectReadUrl(redirectUrl: string): URL;
    getRedirectWriteUrl(idAndPreferences: IdAndPreferences, redirectUrl: string): URL;
    getJsonReadUrl(): URL;
    getJsonWriteUrl(): URL;
    getJsonVerify3PCUrl(): URL;
    buildPreferences(id: Identifier, optIn: boolean, timestamp?: number): Preferences;
    private getOperatorUrl;
}
