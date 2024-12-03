import { Notifier, Ledger, Subscription, JSON, Context, Transaction } from '@klave/sdk';
import {
    FetchInput,
    FetchOutput,
    StoreInput,
    StoreOutput,
    SecureElementKey,
    SecureElement,
    SecureElementOutput,
    ErrorMessage,
    SecureElementOutputList,
    Transac,
    TransactionListOutput,
    StoredKeys,
    Key, // Import the Key class
    MaskedKeysOutput // Import the MaskedKeysOutput class
} from './types';
import { getDate } from './utils';

const myTableName = "my_storage_table";
const secureElementTable = "se_table";
const secureElementTransactionTable = "transaction_table";
/**
 * @query
 * @param {FetchInput} input - A parsed input argument
 */
export function fetchValue(input: FetchInput): void {
    let value = Ledger.getTable(myTableName).get(input.key);
    if (value.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `Key '${input.key}' not found in table`
        });
    } else {
        Notifier.sendJson<FetchOutput>({
            success: true,
            value
        });
    }
}

/**
 * @transaction
 * @param {StoreInput} input - A parsed input argument
 */
export function storeValue(input: StoreInput): void {
    if (input.key && input.value) {
        Ledger.getTable(myTableName).set(input.key, input.value);
        Notifier.sendJson<StoreOutput>({
            success: true
        });
        return;
    }

    Notifier.sendJson<ErrorMessage>({
        success: false,
        message: `Missing value arguments`
    });
}

/**
 * @query
 * @param {SecureElementKey} input - A parsed input argument
 */
export function getSecureElement(input: SecureElementKey): void {
    let secureElement = Ledger.getTable(secureElementTable).get(input.walletPublicKey);
    if (secureElement.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `walletPublicKey '${input.walletPublicKey}' not found in secure element table`
        });
        return;
    } else {
        Notifier.sendJson<SecureElementOutput>({
            success: true,
            secureElement
        });
    }
}

/**
 * @transaction
 * @param {SecureElement} input - A parsed input argument
 */
export function createSecureElement(input: SecureElement): void {
    const seTable = Ledger.getTable(secureElementTable);

    const seObj: SecureElement = {
        walletPublicKey: input.walletPublicKey,
        field1: input.field1,
        field2: input.field2,
        creationDate: getDate(),
        status: input.status
    };

    // Check if secure element already stored
    const secureElement = seTable.get(input.walletPublicKey);
    if (secureElement.length > 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Secure element already exists"
        });
        return;
    }

    // Check if walletPublicKey is already listed in the list of keys, if not add it to the list
    const keysList = seTable.get('keysList');
    if (keysList.length > 0) {
        const existingKeys = JSON.parse<string[]>(keysList);
        if (!existingKeys.includes(input.walletPublicKey)) {
            existingKeys.push(input.walletPublicKey);
            seTable.set('keysList', JSON.stringify<string[]>(existingKeys));
        }
    } else {
        seTable.set('keysList', JSON.stringify<string[]>([input.walletPublicKey]));
    }

    seTable.set(input.walletPublicKey, JSON.stringify<SecureElement>(seObj));

    Notifier.sendJson<FetchOutput>({
        success: true,
        value: `Secure element with walletPublicKey ${input.walletPublicKey} has been stored.`
    });
}

/**
 * @query
 */
export function listSecureElement(): void {
    Subscription.setReplayStart();

    const seTable = Ledger.getTable(secureElementTable);
    const keysList = seTable.get('keysList');
    const existingKeys = JSON.parse<string[]>(keysList);

    const existingSecureElement: SecureElement[] = [];
    for (let i = 0; i < existingKeys.length; i++) {
        const walletPublicKey = existingKeys[i];
        const se = JSON.parse<SecureElement>(seTable.get(walletPublicKey));
        existingSecureElement.push(se);
    }

    Notifier.sendJson<SecureElementOutputList>({
        success: true,
        seList: existingSecureElement
    });
}

/**
 * @transaction
 * @param {Transac} input - A parsed input argument
 */
export function storeTransaction(input: Transac): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Validate input
    if (
        !input.walletPublicKey ||
        !input.synchronizationDate ||
        !input.transactionName ||
        !input.FromID ||
        !input.ToID ||
        !input.nonce ||
        !input.amount ||
        !input.generation ||
        !input.currencycode ||
        !input.txdate
    ) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Invalid parameters: One or more required fields are missing"
        });        
        return;
    }

    // Add the transaction
    const existingTransactions = seTransactionTable.get(input.walletPublicKey) || "[]";
    const transactions = JSON.parse<Array<Transac>>(existingTransactions);
    transactions.push(input);
    seTransactionTable.set(input.walletPublicKey, JSON.stringify(transactions));

    // Maintain a list of keys in the table
    const keysList = seTransactionTable.get("keysList") || "[]";
    const keys = JSON.parse<Array<string>>(keysList);

    if (!keys.includes(input.walletPublicKey)) {
        keys.push(input.walletPublicKey);
        seTransactionTable.set("keysList", JSON.stringify(keys));
    }

    Notifier.sendJson<StoreOutput>({
        success: true
});

}


/**
 * @query
 * @param {SecureElementKey} input - A parsed input argument
 */
export function listTransactionsByWalletPublicKeys(input: SecureElementKey): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const transactionList = seTransactionTable.get(input.walletPublicKey);

    if (!transactionList || transactionList.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `No transactions found for key '${input.walletPublicKey}'`
        });
        return;
    }

    // Parse the list of transactions
    let listTransactionsOutput: Transac[] = JSON.parse<Transac[]>(transactionList);

    // Sort by walletPublicKey in ascending order and by txdate in descending order
    listTransactionsOutput = listTransactionsOutput.sort((a, b) => {
        if (a.walletPublicKey < b.walletPublicKey) return -1;
        if (a.walletPublicKey > b.walletPublicKey) return 1;
        // Sort by txdate in descending order
        return b.txdate.localeCompare(a.txdate);
    });

    Notifier.sendJson<TransactionListOutput >({
        success: true,
        transactionList: listTransactionsOutput,
        has_next: true,
        last_evaluated_key: "1732558315756",
        date: "2024-11-26T08:14:29.205576" // Current date and time in ISO format
    });
}

/**
 * @query
 * Fetch all unique walletPublicKey values from the transaction list stored in the ledger,
 * and return them as key-value pairs with keys in the format "WalletPublicKeyX".
 */
export function listAllWalletPublicKeys(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const keysList = seTransactionTable.get("keysList");

    // Check if keysList exists and is not empty
    if (!keysList || keysList.trim() === "[]") {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "No transactions found in the ledger.",
        });
        return;
    }

    // Parse the keysList to get the transaction keys
    const transactionKeys = JSON.parse<string[]>(keysList);
    const uniqueWalletPublicKeys = new Map<string, bool>(); // Use Map to emulate a Set

    // Iterate over each key in the transaction table using a for loop
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionKey = transactionKeys[i];
        const transactionData = seTransactionTable.get(transactionKey);

        // Skip if no data for this key
        if (!transactionData || transactionData.trim() === "") {
            continue;
        }

        // Parse the transaction list for this key
        const transactions = JSON.parse<Transac[]>(transactionData);

        // Extract walletPublicKey from each transaction
        for (let j = 0; j < transactions.length; j++) {
            const walletPublicKey = transactions[j].walletPublicKey;

            // Add non-empty and unique walletPublicKeys to the Map
            if (walletPublicKey && walletPublicKey.trim() !== "") {
                uniqueWalletPublicKeys.set(walletPublicKey, true);
            }
        }
    }

    // Convert the Map keys to an Array manually
    const uniqueKeysArray: string[] = [];
    const mapKeys = uniqueWalletPublicKeys.keys(); // Get all keys from the Map
    for (let k = 0; k < mapKeys.length; k++) {
        uniqueKeysArray.push(mapKeys[k]);
    }

    // Generate key-value pairs in the format "WalletPublicKeyX: walletPublicKey"
    const keyValuePairs: string[] = [];
    for (let i = 0; i < uniqueKeysArray.length; i++) {
        keyValuePairs.push(`WalletPublicKey${i + 1}: ${uniqueKeysArray[i]}`);
    }

    // Send the result back as a response
    Notifier.sendJson<StoredKeys>({
        success: true,
        walletPublicKeys: keyValuePairs,
    });
}


/**
 * @transaction
 * Deletes all transaction logs and data stored in the transaction_table and seTransactionTable.
 */
export function deleteAllTransactionLogs(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Get the list of keys from the table
    const keysList = seTransactionTable.get("keysList") || "[]";
    const keys = JSON.parse<string[]>(keysList);

    // Iterate through each key and clear its associated data
    for (let i = 0; i < keys.length; i++) {
        seTransactionTable.set(keys[i], ""); // Set an empty string to simulate deletion
    }

    // Clear the keysList
    seTransactionTable.set("keysList", "[]"); // Reset the keysList to an empty array

    // Confirm deletion
    Notifier.sendJson<StoreOutput>({
        success: true
    });
}

/**
 * @transaction
 */
export function RevealTheKeys(): void {
    const keysTableName = "keys_storage_table";

    // Hardcoded keys
    const hardcodedKeys: Key[] = [
        {
            privateKey: "cd9e60f91f1c279b0629cb9d8c3d3d84c2a79abbf62db7ff74c671b4eb286491",
            originalPublicKey: "d23c2888169cb6d530101ae6cb5cd12057b3a6c0b1203cd7b4ef8858f39a26ee69bb1f7e49a612da5b360cc7d6374c3d809a068c964ff05864bb7ac3a26e7cd0",
            compressedPublicKey: "02d23c2888169cb6d530101ae6cb5cd12057b3a6c0b1203cd7b4ef8858f39a26ee",
        },
        {
            privateKey: "15ec428803f2e38a40081489abffa6d2b896bccb0c4de93887c4a12da3547186",
            originalPublicKey: "40610b3cf4df60ff59f953bb679bbe11327185477520cdb3fb918656ccabc38098bd784c2434bbea8f717ba568b97d2de837ca77ed44a4ea5eccaaaf240f4833",
            compressedPublicKey: "0240610b3cf4df60ff59f953bb679bbe11327185477520cdb3fb918656ccabc380",
        },
        {
            privateKey: "f6f9fb66b06146714cbca49847ddc15bf06d5b827cbec0339f0ac810db380333",
            originalPublicKey: "abb4a17bfbf0c3fb83ac85b09baebd35852669a2e20356b7ca97f3241aad591b64ea9907cf99b955a79d6b842bbf79ffd7d1998aa5ae17b2f7fa5c4e34449502",
            compressedPublicKey: "02abb4a17bfbf0c3fb83ac85b09baebd35852669a2e20356b7ca97f3241aad591",
        }
    ];

    // Check existing keys in the table
    const keysTable = Ledger.getTable(keysTableName);
    const existingKeysList = keysTable.get("keyList");
    const existingKeyIds: string[] = existingKeysList ? JSON.parse<string[]>(existingKeysList) : [];

    // Mask the compressed public keys and filter out already stored keys
    const maskedKeys: Key[] = [];
    for (let i: i32 = 0; i < hardcodedKeys.length; i++) {
        const originalKey = hardcodedKeys[i];
        const keyId = `Key${i + 1}`;

        // Skip if the key is already stored
        if (existingKeyIds.includes(keyId)) {
            continue;
        }

        // Mask the key and add it to the array
        const maskedKey = new Key();
        maskedKey.privateKey = originalKey.privateKey;
        maskedKey.originalPublicKey = originalKey.originalPublicKey;
        maskedKey.compressedPublicKey =
            originalKey.compressedPublicKey.slice(0, 6) +
            "*".repeat(originalKey.compressedPublicKey.length - 6);
        maskedKeys.push(maskedKey);

        // Add the key to the table
        keysTable.set(keyId, JSON.stringify(maskedKey));
        existingKeyIds.push(keyId);
    }

    // Update the key list in the table
    keysTable.set("keyList", JSON.stringify(existingKeyIds));

    // Respond with success and the new masked keys
    const output = new MaskedKeysOutput();
    output.success = true;
    output.message = maskedKeys.length > 0
        ? "The Keys are Generated Successfully."
        : "All keys are already stored. No new keys were added.";
    output.keys = maskedKeys;

    Notifier.sendJson<MaskedKeysOutput>(output);
}
