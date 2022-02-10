import {
    GetIdsPrefsRequest,
    GetIdsPrefsResponse,
    GetNewIdRequest,
    Identifiers,
    IdsAndPreferences,
    PostIdsPrefsRequest,
    Preferences
} from "paf-mvp-core-js/dist/model/generated-model";
import {UnsignedData, UnsignedMessage} from "paf-mvp-core-js/dist/model/model";
import {
    GetIdsPrefsRequestSigner,
    GetIdsPrefsResponseSigner,
    PostIdsPrefsRequestSigner
} from "paf-mvp-core-js/dist/crypto/message-signature";
import {PrefsSigner} from "paf-mvp-core-js/dist/crypto/data-signature";
import {PrivateKey, privateKeyFromString, PublicKeys} from "paf-mvp-core-js/dist/crypto/keys";
import {jsonEndpoints, redirectEndpoints, uriParams} from "paf-mvp-core-js/dist/endpoints";

// TODO all these methods should have signed messages
// FIXME use url builders instead of specific methods here
export class OperatorClient {
    private readonly writeSigner = new PostIdsPrefsRequestSigner()
    private readonly readSigner = new GetIdsPrefsRequestSigner()
    private readonly readVerifier = new GetIdsPrefsResponseSigner()
    private readonly prefsSigner = new PrefsSigner();
    private readonly ecdsaKey: PrivateKey;

    constructor(protected protocol: 'https' | 'http', public operatorHost: string, private host: string, privateKey: string, protected publicKeys: PublicKeys) {
        this.ecdsaKey = privateKeyFromString(privateKey);
    }

    private addReadQS(url: URL) {
        const message = this.buildGetIdsPrefsRequest();

        url.searchParams.set(uriParams.sender, message.sender)
        url.searchParams.set(uriParams.receiver, message.receiver)
        url.searchParams.set(uriParams.timestamp, message.timestamp.toString())
        url.searchParams.set(uriParams.signature, message.signature)
    }

    verifyReadResponseSignature(message: GetIdsPrefsResponse): boolean {
        return this.readVerifier.verify(this.publicKeys[message.sender], message)
    }

    buildPostIdsPrefsRequest(IdsAndPreferences: IdsAndPreferences, timestamp = new Date().getTime()): PostIdsPrefsRequest {
        const request: UnsignedMessage<PostIdsPrefsRequest> = {
            body: IdsAndPreferences,
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        }
        return {
            ...request,
            signature: this.writeSigner.sign(this.ecdsaKey, request)
        };
    }

    buildGetIdsPrefsRequest(timestamp = new Date().getTime()): GetIdsPrefsRequest {
        const request: UnsignedMessage<GetIdsPrefsRequest> = {
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        }
        return {
            ...request,
            signature: this.readSigner.sign(this.ecdsaKey, request)
        };
    }

    buildGetNewIdRequest(timestamp = new Date().getTime()): GetNewIdRequest {
        const request: UnsignedMessage<GetNewIdRequest> = {
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        }
        return {
            ...request,
            signature: this.readSigner.sign(this.ecdsaKey, request)
        };
    }

    getRedirectReadUrl(redirectUrl: string): URL {
        const url = this.getOperatorUrl(redirectEndpoints.read, redirectUrl);

        this.addReadQS(url);

        return url
    }

    getRedirectWriteUrl(IdsAndPreferences: IdsAndPreferences, redirectUrl: string): URL {
        if (!(IdsAndPreferences.identifiers.length > 0 || IdsAndPreferences.preferences)) {
            throw "Need something to write!"
        }
        const message = this.buildPostIdsPrefsRequest(IdsAndPreferences);

        const url = this.getOperatorUrl(redirectEndpoints.write, redirectUrl);

        url.searchParams.set(uriParams.data, JSON.stringify(message))

        return url
    }

    getJsonReadUrl(): URL {
        const url = this.getOperatorUrl(jsonEndpoints.read);

        const message = this.buildGetIdsPrefsRequest();

        this.addReadQS(url);

        return url
    }

    getJsonWriteUrl(): URL {
        // Note: POST body is signed
        return this.getOperatorUrl(jsonEndpoints.write)
    }

    getJsonVerify3PCUrl(): URL {
        return this.getOperatorUrl(jsonEndpoints.verify3PC)
    }

    buildPreferences(identifiers: Identifiers, optIn: boolean, timestamp = new Date().getTime()): Preferences {
        const unsignedPreferences: UnsignedData<Preferences> = {
            version: 0,
            data: {
                use_browsing_for_personalization: true
            },
            source: {
                domain: this.host,
                timestamp,
            }
        };

        const {source, ...rest} = unsignedPreferences;

        return {
            ...rest,
            source: {
                ...source,
                signature: this.prefsSigner.sign(this.ecdsaKey, unsignedPreferences)
            }
        };
    }

    private getOperatorUrl(endpoint: string, returnUrl: string = undefined): URL {
        const redirectUrl = new URL(`${this.protocol}://${this.operatorHost}${endpoint}`)

        if (returnUrl) {
            redirectUrl.searchParams.set(uriParams.returnUrl, returnUrl)
        }

        return redirectUrl;
    }
}

