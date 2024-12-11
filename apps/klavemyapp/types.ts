@serializable
export class ErrorMessage {
    success: boolean = false;
    message!: string;
}
@serializable
export class StoreOutput {
    success: boolean = true;
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
    walletPublicKeys: string[] = []; // Initialize with an empty array to avoid null/undefined issues
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
