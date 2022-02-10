import {GetIdsPrefsResponse, Identifiers, Preferences} from "paf-mvp-core-js/dist/model/generated-model";
import {UnsignedData} from "paf-mvp-core-js/dist/model/model";
import {
    GetIdsPrefsRequestSigner,
    GetIdsPrefsResponseSigner,
    PostIdsPrefsRequestSigner
} from "paf-mvp-core-js/dist/crypto/message-signature";
import {PrefsSigner} from "paf-mvp-core-js/dist/crypto/data-signature";
import {PrivateKey, privateKeyFromString, PublicKeys} from "paf-mvp-core-js/dist/crypto/keys";

// TODO all these methods should have signed messages
export class OperatorClient {
    private readonly readVerifier = new GetIdsPrefsResponseSigner()
    private readonly prefsSigner = new PrefsSigner();
    private readonly ecdsaKey: PrivateKey;

    constructor(protected protocol: 'https' | 'http', public operatorHost: string, private host: string, privateKey: string, protected publicKeys: PublicKeys) {
        this.ecdsaKey = privateKeyFromString(privateKey);
    }

    verifyReadResponseSignature(message: GetIdsPrefsResponse): boolean {
        return this.readVerifier.verify(this.publicKeys[message.sender], message)
    }

    buildPreferences(identifiers: Identifiers, optIn: boolean, timestamp = new Date().getTime()): Preferences {
        const unsignedPreferences: UnsignedData<Preferences> = {
            version: 0,
            data: {
                use_browsing_for_personalization: optIn
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
}

