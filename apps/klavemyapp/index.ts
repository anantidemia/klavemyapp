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
    StoreKeys
} 
from './types';
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
            message: `walletPublicKey '${input.key}' not found in table`
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
        throw new Error("All fields in Transac are mandatory. Please provide complete input.");
    }

    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

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

    if (transactionList.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `No transactions found for key '${input.walletPublicKey}'`
        });
        return;
    }

    // Parse the list of transactions
    let listTransactionsOutput: Transac[] = JSON.parse<Transac[]>(transactionList);

    // Sort by walletPublicKey in ascending order and by txnDate in descending order
    listTransactionsOutput = listTransactionsOutput.sort((a, b) => {
        if (a.walletPublicKey < b.walletPublicKey) return -1;
        else  return 1;
    });

    Notifier.sendJson<TransactionListOutput>({
        success: true,
        transactionList: listTransactionsOutput
    });
}
/**
 * @query
 * Fetch all walletPublicKey values from the transaction list stored in the ledger,
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
    const transactionKeys: string[] = JSON.parse<string[]>(keysList);
    const walletPublicKeys: string[] = [];

    // Iterate over each key in the transaction table
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);

        // Skip if no data for this key
        if (!transactionData || transactionData.trim() === "") {
            continue;
        }

        // Parse the transaction list for this key
        const transactions: Transac[] = JSON.parse<Transac[]>(transactionData);

        // Extract walletPublicKey from each transaction
        for (let j = 0; j < transactions.length; j++) {
            const walletPublicKey = transactions[j].walletPublicKey;

            // Add only non-empty walletPublicKeys
            if (walletPublicKey && walletPublicKey.trim() !== "") {
                walletPublicKeys.push(walletPublicKey);
                seTransactionTable.set("keysList", JSON.stringify(walletPublicKey));
            }
        }
    }

    // Generate key-value pairs in the format "WalletPublicKeyX: walletPublicKey"
    const keyValuePairs = walletPublicKeys.map<string>((key: string, index: i32): string => {
        return `WalletPublicKey${index + 1}: ${key}`;
    });

    // Send the result back as a response
    Notifier.sendJson<StoreKeys>({
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
