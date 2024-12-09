
@serializable
export class ErrorMessage {
    success: boolean = false;
    message!: string;
}

@serializable
export class FetchInput {
    key!: string;
}

@serializable
export class FetchOutput {
    success: boolean = true;
    value!: string;
}

@serializable
export class StoreInput {
    key!: string;
    value!: string;
}

@serializable
export class StoreOutput {
    success: boolean = true;
}

@serializable
export class SecureElementKey {
    walletPublicKey!: string;
}

@serializable
export class SecureElement {
    walletPublicKey!: string;
    field1!: string;
    field2!: string;
    creationDate!: i64;
    status!: string;
}

@serializable
export class SecureElementOutput {
    success: boolean = true;
    secureElement!: string;
}

@serializable
export class SecureElementOutputList {
    success: boolean = true;
    seList!: SecureElement[];
}

@serializable
export class Transac {
    walletPublicKey!: string;
    synchronizationDate!: string;
    transactionName!: string;
    FromID!: string;
    ToID!: string;
    nonce!: string;
    amount!: string;
    generation!: string;
    currencycode!: string;
    txdate!: string;
    estimateBalanceTo: number; // Define as non-optional with default value
    estimateBalanceFrom: number;
    fraudStatus: boolean = false; // New property with default value
}


@serializable
export class SecureElementTransaction {
    secureElement!: string;
    transactionList!: Transac[];
}

@serializable
export class TransactionListOutput {
    success: boolean = true;
    transactionList!: Transac[];
    has_next!: boolean;
    last_evaluated_key!: string;
    date!: string;
}

@serializable
export class StoredKeys {
    success: boolean = true;
    walletPublicKeys!: string[]; // Array of key-value pair strings
}
/**
 * A class representing the response structure for masked keys.
 */
@serializable
export class Key {
    privateKey: string = ""; // Default initialization
    originalPublicKey: string = "";
    compressedPublicKey: string = "";
}

@serializable
export class MaskedKeysOutput {
    success: boolean = true;
    message: string = "";
    keys: Key[] = [];
}
@serializable
export class RevealTransactionsInput {
    inputKeys: string[] = [];
}
@serializable
export class WalletStatus {
    walletPublicKey!: string;
    fraudStatus: boolean = false;
}
@serializable
export class UniqueEntry {
    id: string;
    isFromID: boolean;
    estimateBalanceTo: number;
    estimateBalanceFrom: number;
    fraudStatus: boolean;

    constructor(id: string, isFromID: boolean) {
        this.id = id;
        this.isFromID = isFromID;
        this.estimateBalanceTo = 0;
        this.estimateBalanceFrom = 0;
        this.fraudStatus = false;
    }
}
