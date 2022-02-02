import { Express } from "express";
import { PublicKeys } from "paf-mvp-core-js/dist/crypto/keys";
export declare const addOperatorClientProxyEndpoints: (app: Express, protocol: 'https' | 'http', operatorHost: string, sender: string, privateKey: string, allowedOrigins: string[], publicKeys: PublicKeys) => void;
