import {GetIdsPrefsRequest, PostIdsPrefsRequest, IdsAndPreferences, GetNewIdRequest} from "paf-mvp-core-js/dist/model/generated-model";
import {UnsignedMessage} from "paf-mvp-core-js/dist/model/model";
import {GetIdsPrefsRequestSigner, PostIdsPrefsRequestSigner, GetNewIdRequestSigner} from "paf-mvp-core-js/dist/crypto/message-signature";
import {PrivateKey, privateKeyFromString} from "paf-mvp-core-js/dist/crypto/keys";
import {jsonEndpoints, redirectEndpoints} from "paf-mvp-core-js/dist/endpoints";
import {QSParam} from "paf-mvp-core-js/dist/query-string";

export abstract class RestURLBuilder<T> {
    protected ecdsaKey: PrivateKey;

    constructor(protected protocol: 'https' | 'http', public operatorHost: string, protected host: string, privateKey: string, protected restEndpoint: string) {
        this.ecdsaKey = privateKeyFromString(privateKey);
    }

    protected getOperatorUrl(endpoint: string, pafQuery: object | undefined = undefined): URL {
        const url = new URL(`${this.protocol}://${this.operatorHost}${endpoint}`);

        if (pafQuery) {
            url.searchParams.set(QSParam.PAF, JSON.stringify(pafQuery))
        }

        return url
    }

    getRestUrl(request: T): URL {
        return this.getOperatorUrl(this.restEndpoint, request as unknown as object)
    }
}

export abstract class RestAndRedirectURLBuilder<T> extends RestURLBuilder<T> {

    constructor(protocol: "https" | "http", operatorHost: string, host: string, privateKey: string, restEndpoint: string, protected redirectEndpoint: string) {
        super(protocol, operatorHost, host, privateKey, restEndpoint);
    }

    getRedirectUrl(redirectRequest: { request: T, returnUrl: string }): URL {
        return this.getOperatorUrl(this.redirectEndpoint, redirectRequest)
    }

    toRedirectRequest(request: T, returnUrl: string) {
        return {
            request,
            returnUrl
        }
    }
}

export class GetIdsPrefsURLBuilder extends RestAndRedirectURLBuilder<GetIdsPrefsRequest> {
    private readonly signer = new GetIdsPrefsRequestSigner()

    constructor(protocol: "https" | "http", operatorHost: string, host: string, privateKey: string) {
        super(protocol, operatorHost, host, privateKey, jsonEndpoints.read, redirectEndpoints.read);
    }

    buildRequest(timestamp = new Date().getTime()): GetIdsPrefsRequest {
        const request: UnsignedMessage<GetIdsPrefsRequest> = {
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        }
        return {
            ...request,
            signature: this.signer.sign(this.ecdsaKey, request)
        };
    }
}

export class PostIdsPrefsURLBuilder extends RestAndRedirectURLBuilder<PostIdsPrefsRequest> {
    private readonly signer = new PostIdsPrefsRequestSigner()

    constructor(protocol: "https" | "http", operatorHost: string, host: string, privateKey: string) {
        super(protocol, operatorHost, host, privateKey, jsonEndpoints.write, redirectEndpoints.write);
    }

    buildRequest(idsAndPreferences: IdsAndPreferences, timestamp = new Date().getTime()): PostIdsPrefsRequest {
        const request: UnsignedMessage<PostIdsPrefsRequest> = {
            body: idsAndPreferences,
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        }
        return {
            ...request,
            signature: this.signer.sign(this.ecdsaKey, request)
        };
    }

    getRestUrl(request: PostIdsPrefsRequest): URL {
        return this.getOperatorUrl(this.restEndpoint) // /!\ not passing any object because it will be sent as POST!
    }
}

export class GetNewIdURLBuilder extends RestURLBuilder<GetNewIdRequest> {
    private readonly signer = new GetNewIdRequestSigner()

    constructor(protocol: "https" | "http", operatorHost: string, host: string, privateKey: string) {
        super(protocol, operatorHost, host, privateKey, jsonEndpoints.newId);
    }

    buildRequest(timestamp = new Date().getTime()): GetNewIdRequest {
        const request: UnsignedMessage<GetNewIdRequest> = {
            sender: this.host,
            receiver: this.operatorHost,
            timestamp
        }
        return {
            ...request,
            signature: this.signer.sign(this.ecdsaKey, request)
        };
    }
}

export class Get3PCURLBuilder extends RestURLBuilder<undefined> {
    constructor(protocol: "https" | "http", operatorHost: string, host: string, privateKey: string) {
        super(protocol, operatorHost, host, privateKey, jsonEndpoints.verify3PC);
    }

    buildRequest(timestamp = new Date().getTime()): undefined {
        return undefined;
    }
}

export class GetIdentityURLBuilder extends RestURLBuilder<undefined> {
    constructor(protocol: "https" | "http", operatorHost: string, host: string, privateKey: string) {
        super(protocol, operatorHost, host, privateKey, jsonEndpoints.identity);
    }

    buildRequest(timestamp = new Date().getTime()): undefined {
        return undefined;
    }
}
