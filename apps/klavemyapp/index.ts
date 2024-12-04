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

    // Ensure fraudStatus is set to false
    input.fraudStatus = false;

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
        success: true,
        fraudStatus: false // Response indicates fraudStatus is false
    });
}

/**
 * @query
 * List all transactions stored in the secureElementTransactionTable.
 */
export function listAllTransactions(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Collect all transactions
    const allTransactions: Transac[] = [];
    for (let i: i32 = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const transactions = JSON.parse<Transac[]>(transactionData);
            for (let j: i32 = 0; j < transactions.length; j++) {
                allTransactions.push(transactions[j]);
            }
        }
    }

    // Respond with all transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: allTransactions,
        has_next: false, // Indicate there are no paginated results
        last_evaluated_key: "",
        date: getDate().toString()
    };

    Notifier.sendJson<TransactionListOutput>(output);
}

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
        return b.txdate.localeCompare(a.txdate);
    });

    Notifier.sendJson<TransactionListOutput>({
        success: true,
        transactionList: listTransactionsOutput,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString()
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
        success: true,
        fraudStatus:false
    });
}

/**
 * @transaction
 */
/**
 * @transaction
 */
export function revealSecretKeys(): void {
    const keysTableName = "keys_storage_table";

    // Hardcoded keys
    const hardcodedKeys: Key[] = [
        {
            privateKey: "cd9e60f91f1c279b0629cb9d8c3d3d84c2a79abbf62db7ff74c671b4eb286491",
            originalPublicKey: "d23c2888169cb6d530101ae6cb5cd12057b3a6c0b1203cd7b4ef8858f39a26ee69bb1f7e49a612da5b360cc7d6374c3d809a068c964ff05864bb7ac3a26e7cd0",
            compressedPublicKey: "d23c2888169cb6d530101ae6cb5cd12057b3a6c0b1203cd7b4ef8858f39a26ee",
        },
        {
            privateKey: "15ec428803f2e38a40081489abffa6d2b896bccb0c4de93887c4a12da3547186",
            originalPublicKey: "40610b3cf4df60ff59f953bb679bbe11327185477520cdb3fb918656ccabc38098bd784c2434bbea8f717ba568b97d2de837ca77ed44a4ea5eccaaaf240f4833",
            compressedPublicKey: "40610b3cf4df60ff59f953bb679bbe11327185477520cdb3fb918656ccabc380",
        },
        {
            privateKey: "f6f9fb66b06146714cbca49847ddc15bf06d5b827cbec0339f0ac810db380333",
            originalPublicKey: "abb4a17bfbf0c3fb83ac85b09baebd35852669a2e20356b7ca97f3241aad591b64ea9907cf99b955a79d6b842bbf79ffd7d1998aa5ae17b2f7fa5c4e34449502",
            compressedPublicKey: "abb4a17bfbf0c3fb83ac85b09baebd35852669a2e20356b7ca97f3241aad591",
        }
    ];

    // Access the keys table
    const keysTable = Ledger.getTable(keysTableName);

    // Overwrite the key list with new data
    const newKeyIds: string[] = [];
    for (let i: i32 = 0; i < hardcodedKeys.length; i++) {
        const key = hardcodedKeys[i];
        const keyId = `Key${i + 1}`;

        keysTable.set(keyId, JSON.stringify(key));
        newKeyIds.push(keyId);
    }

    // Update the key list in the table
    keysTable.set("keyList", JSON.stringify(newKeyIds));

    // Respond with success
    const output = new MaskedKeysOutput();
    output.success = true;
    output.message = "All previous keys overwritten and new keys stored successfully.";
    output.keys = hardcodedKeys;

    Notifier.sendJson<MaskedKeysOutput>(output);
}

/**
 * @query
 * Encrypt all transactions stored in the secureElementTransactionTable using three hardcoded keys.
 */
export function listAllTransactionsObfuscated(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Collect and encrypt all transactions
    const allTransactions: Transac[] = [];
    for (let i: i32 = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const transactions = JSON.parse<Transac[]>(transactionData);
            for (let j: i32 = 0; j < transactions.length; j++) {
                allTransactions.push(transactions[j]);
            }
        }
    }

    // Encrypt all transaction values
    const encryptedTransactions: Transac[] = [];
    for (let i: i32 = 0; i < allTransactions.length; i++) {
        const transac = allTransactions[i];
        const encryptedTransac = new Transac();
        encryptedTransac.walletPublicKey = transac.walletPublicKey; // Keep publicKey visible
        encryptedTransac.synchronizationDate = "*".repeat(transac.synchronizationDate.length);
        encryptedTransac.transactionName = "*".repeat(transac.transactionName.length);
        encryptedTransac.FromID = "*".repeat(transac.FromID.length);
        encryptedTransac.ToID = "*".repeat(transac.ToID.length);
        encryptedTransac.nonce = "*".repeat(transac.nonce.length);
        encryptedTransac.amount = "*".repeat(transac.amount.length);
        encryptedTransac.generation = "*".repeat(transac.generation.length);
        encryptedTransac.currencycode = "*".repeat(transac.currencycode.length);
        encryptedTransac.txdate = "*".repeat(transac.txdate.length);
        encryptedTransactions.push(encryptedTransac);
    }

    // Respond with encrypted transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: encryptedTransactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString()
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
/**
 * @transaction
 * Show all transactions stored in the secureElementTransactionTable if all input keys match the required keys.
 * Otherwise, return an error message.
 */
export function revealTransactions(inputKeys: string[]): void {
    const requiredKeys: string[] = ["d23c2888169c", "40610b3cf4df", "abb4a17bfbf0"]; // Initialize directly

    // Validate input keys
    if (inputKeys.length !== requiredKeys.length) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Invalid number of keys provided for Reveal the Transactions."
        });
        return;
    }

    // Ensure all keys match
    let keysMatch = true;
    for (let i = 0; i < requiredKeys.length; i++) {
        if (inputKeys[i] !== requiredKeys[i]) {
            keysMatch = false;
            break;
        }
    }

    if (!keysMatch) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Provided keys do not match the required keys for Reveal the Transactions."
        });
        return;
    }

    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve all transactions
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    const allTransactions: Transac[] = [];
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const transactions = JSON.parse<Transac[]>(transactionData);
            for (let j = 0; j < transactions.length; j++) {
                allTransactions.push(transactions[j]);
            }
        }
    }

    // Respond with all transactions as-is
    const output: TransactionListOutput = {
        success: true,
        transactionList: allTransactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString()
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
