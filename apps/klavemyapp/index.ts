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
    MaskedKeysOutput, // Import the MaskedKeysOutput class
    RevealTransactionsInput,
    WalletStatus
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

    // Initialize or update wallet balance
    let walletBalance: i32 = 0; // Ensure this is an i32
    const balanceKey = `${input.walletPublicKey}_balance`;
    const existingBalance = seTransactionTable.get(balanceKey);
    if (existingBalance) {
        walletBalance = <i32>parseFloat(existingBalance); // Explicit cast to i32
    }

    // Adjust wallet balance based on transaction name
    if (input.transactionName === "Fund") {
        walletBalance += <i32>parseFloat(input.amount); // Explicit cast to i32
    } else if (input.transactionName === "Defund") {
        walletBalance -= <i32>parseFloat(input.amount); // Explicit cast to i32
    }

    // Determine fraud status
    const fraudStatus: bool = walletBalance < 0;

    // Update wallet balance in the table
    seTransactionTable.set(balanceKey, walletBalance.toString());

    // Add the transaction
    const existingTransactions = seTransactionTable.get(input.walletPublicKey) || "[]";
    const transactions = JSON.parse<Array<Transac>>(existingTransactions);

    // Include the fraudStatus in the transaction
    input.fraudStatus = fraudStatus;
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
 * List all transactions stored in the secureElementTransactionTable.
 */
export function listAllTransactions(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Initialize array and wallet balance
    const allTransactions: Transac[] = []; // Initialize the transactions array
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const transactions = JSON.parse<Transac[]>(transactionData);

            let walletBalance: i32 = 0; // Initialize wallet balance for this key
            for (let j = 0; j < transactions.length; j++) {
                const transac = transactions[j];

                // Check transaction type and adjust wallet balance
                if (transac.transactionName === "Fund") {
                    walletBalance += <i32>Math.floor(parseFloat(transac.amount)); // Add the amount for Fund
                } else if (transac.transactionName === "Defund") {
                    walletBalance -= <i32>Math.floor(parseFloat(transac.amount)); // Subtract the amount for Defund
                }

                // Attach wallet balance to transaction
                transac.walletBalance = walletBalance;
                allTransactions.push(transac);
            }
        }
    }

    // Respond with all transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: allTransactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString()
    };

    Notifier.sendJson<TransactionListOutput>(output);
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
 * and return them as key-value pairs with their fraudStatus.
 */
export function listAllWalletPublicKeys(input: RevealTransactionsInput): void {
    const requiredKeys: string[] = ["d23c2888169c", "40610b3cf4df", "abb4a17bfbf0"]; // Required keys

    // Validate the input keys
    if (!input || !input.inputKeys || input.inputKeys.length !== requiredKeys.length) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Invalid number of keys provided for Reveal the WalletPublicKeys."
        });
        return;
    }

    // Check if all keys match
    let keysMatch = true;
    for (let i = 0; i < requiredKeys.length; i++) {
        if (requiredKeys[i] !== input.inputKeys[i]) {
            keysMatch = false;
            break;
        }
    }

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
    const uniqueWallets = new Array<WalletStatus>();

    // Iterate over each key in the transaction table
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionKey = transactionKeys[i];
        const transactionData = seTransactionTable.get(transactionKey);

        // Skip if no data for this key
        if (!transactionData || transactionData.trim() === "") {
            continue;
        }

        // Parse the transaction list for this key
        const transactions = JSON.parse<Transac[]>(transactionData);

        // Extract walletPublicKey and fraudStatus from each transaction
        for (let j = 0; j < transactions.length; j++) {
            const transaction = transactions[j];

            // Check if walletPublicKey already exists in uniqueWallets
            let existingEntry: WalletStatus | null = null;
            for (let k = 0; k < uniqueWallets.length; k++) {
                if (uniqueWallets[k].walletPublicKey === transaction.walletPublicKey) {
                    existingEntry = uniqueWallets[k];
                    break;
                }
            }

            if (existingEntry) {
                // Update fraudStatus if any transaction has fraud detected
                existingEntry.fraudStatus = existingEntry.fraudStatus || transaction.fraudStatus;
            } else {
                // Add new walletPublicKey with fraudStatus
                const newWalletStatus = new WalletStatus();
                newWalletStatus.walletPublicKey =
                    keysMatch && transaction.fraudStatus
                        ? transaction.walletPublicKey // Show real walletPublicKey
                        : "*".repeat(transaction.walletPublicKey.length); // Mask walletPublicKey otherwise
                newWalletStatus.fraudStatus = transaction.fraudStatus;
                uniqueWallets.push(newWalletStatus);
            }
        }
    }

    // Prepare response in the required format
    const keyValuePairs = new Array<string>();
    for (let i = 0; i < uniqueWallets.length; i++) {
        const entry = uniqueWallets[i];
        keyValuePairs.push(
            `WalletPublicKey${i + 1}: ${entry.walletPublicKey}, FraudStatus: ${entry.fraudStatus}`
        );
    }

    // Send the result back as a response
    const output = new StoredKeys();
    output.success = true;
    output.walletPublicKeys = keyValuePairs;
    Notifier.sendJson<StoredKeys>(output);
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
 * Obfuscate all transactions by masking sensitive fields with '*'.
 */
export function listAllTransactionsObfuscated(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Collect all transactions and mask their fields
    const obfuscatedTransactions: Transac[] = [];
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const transactions = JSON.parse<Transac[]>(transactionData);
            for (let j = 0; j < transactions.length; j++) {
                const transac = transactions[j];
                const obfuscatedTransac = new Transac();
                obfuscatedTransac.walletPublicKey = "*".repeat(transac.walletPublicKey.length); // Keep publicKey visible
                obfuscatedTransac.synchronizationDate = "*".repeat(transac.synchronizationDate.length);
                obfuscatedTransac.transactionName = "*".repeat(transac.transactionName.length);
                obfuscatedTransac.FromID = "*".repeat(transac.FromID.length);
                obfuscatedTransac.ToID = "*".repeat(transac.ToID.length);
                obfuscatedTransac.nonce = "*".repeat(transac.nonce.length);
                obfuscatedTransac.amount = "*".repeat(transac.amount.length);
                obfuscatedTransac.generation = "*".repeat(transac.generation.length);
                obfuscatedTransac.currencycode = "*".repeat(transac.currencycode.length);
                obfuscatedTransac.txdate = "*".repeat(transac.txdate.length);
                obfuscatedTransac.fraudStatus = transac.fraudStatus;
                obfuscatedTransactions.push(obfuscatedTransac);
            }
        }
    }

    // Respond with masked transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: obfuscatedTransactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString()
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
/**
 * @transaction
 * Show all transactions, revealing original data if keys match, otherwise showing obfuscated data.
 */
export function revealTransactions(input: RevealTransactionsInput): void {
    const requiredKeys: string[] = ["d23c2888169c", "40610b3cf4df", "abb4a17bfbf0"]; // Required keys

    // Validate the input directly
    if (!input || !input.inputKeys || input.inputKeys.length !== requiredKeys.length) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Invalid number of keys provided for Reveal the Transactions."
        });
        return;
    }

    // Check if all keys match
    let keysMatch = true;
    for (let i = 0; i < requiredKeys.length; i++) {
        if (requiredKeys[i] !== input.inputKeys[i]) {
            keysMatch = false;
            break;
        }
    }

    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve all transactions
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    const transactions: Transac[] = [];
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const allTransactions = JSON.parse<Transac[]>(transactionData);

            let walletBalance: i32 = 0; // Initialize wallet balance for this key
            for (let j = 0; j < allTransactions.length; j++) {
                const transac = allTransactions[j];

                // Adjust wallet balance based on transaction type
                if (transac.transactionName === "Fund") {
                    walletBalance += <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "Defund") {
                    walletBalance -= <i32>Math.floor(parseFloat(transac.amount));
                }

                const transactionToAdd = new Transac();
                if (keysMatch && transac.fraudStatus) {
                    // Reveal all fields when keys match or fraudStatus is true
                    transactionToAdd.walletPublicKey = transac.walletPublicKey;
                    transactionToAdd.synchronizationDate = transac.synchronizationDate;
                    transactionToAdd.transactionName = transac.transactionName;
                    transactionToAdd.FromID = transac.FromID;
                    transactionToAdd.ToID = transac.ToID;
                    transactionToAdd.nonce = transac.nonce;
                    transactionToAdd.amount = transac.amount;
                    transactionToAdd.generation = transac.generation;
                    transactionToAdd.currencycode = transac.currencycode;
                    transactionToAdd.txdate = transac.txdate;
                    transactionToAdd.walletBalance = walletBalance;
                } else {
                    // Mask fields if keys don't match and fraudStatus is false
                    transactionToAdd.walletPublicKey = "*".repeat(transac.walletPublicKey.length);
                    transactionToAdd.synchronizationDate = "*".repeat(transac.synchronizationDate.length);
                    transactionToAdd.transactionName = "*".repeat(transac.transactionName.length);
                    transactionToAdd.FromID = "*".repeat(transac.FromID.length);
                    transactionToAdd.ToID = "*".repeat(transac.ToID.length);
                    transactionToAdd.nonce = "*".repeat(transac.nonce.length);
                    transactionToAdd.amount = "*".repeat(transac.amount.length);
                    transactionToAdd.generation = "*".repeat(transac.generation.length);
                    transactionToAdd.currencycode = "*".repeat(transac.currencycode.length);
                    transactionToAdd.txdate = "*".repeat(transac.txdate.length);
                }

                // Attach calculated wallet balance and fraud status
                
                transactionToAdd.fraudStatus = transac.fraudStatus;

                transactions.push(transactionToAdd);
            }
        }
    }

    // Respond with transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: transactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString()
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
