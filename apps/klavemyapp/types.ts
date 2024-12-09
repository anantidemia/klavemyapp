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
    estimateBalanceTo: number = 0; // Default value to ensure proper initialization
    estimateBalanceFrom: number = 0; // Default value for initialization
    fraudStatus: boolean = false; // Indicates whether the transaction is fraudulent
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
    walletPublicKeys!: string[]; // Array to hold key-value pair strings
}

/**
 * Represents the structure of a cryptographic key.
 */
@serializable
export class Key {
    privateKey: string = ""; // Default empty string
    originalPublicKey: string = ""; // Original public key representation
    compressedPublicKey: string = ""; // Compressed public key representation
}

@serializable
export class MaskedKeysOutput {
    success: boolean = true;
    message: string = ""; // Message for any additional info
    keys: Key[] = []; // List of keys
}

@serializable
export class RevealTransactionsInput {
    inputKeys: string[] = []; // Array of input keys for revealing transactions
}

@serializable
export class WalletStatus {
    walletPublicKey!: string;
    estimateBalanceTo: number = 0; // Default value for balance to
    estimateBalanceFrom: number = 0; // Default value for balance from
    fraudStatus: boolean = false; // Indicates if fraud is detected for this wallet
}
