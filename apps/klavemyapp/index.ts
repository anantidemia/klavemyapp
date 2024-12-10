import { Notifier, Ledger, Subscription, JSON, Context, Transaction } from '@klave/sdk';

import {
    StoreOutput,
    ErrorMessage,
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
            message: "Invalid parameters: One or more required fields are missing",
        });
        return;
    }

    // Initialize balances
    let estimateBalanceTo: i32 = 0;
    let estimateBalanceFrom: i32 = 0;

    // Retrieve transactions for the FromID and ToID
    const fromTransactionsData = seTransactionTable.get(input.FromID) || "[]";
    const toTransactionsData = seTransactionTable.get(input.ToID) || "[]";
    const fromTransactions = JSON.parse<Array<Transac>>(fromTransactionsData);
    const toTransactions = JSON.parse<Array<Transac>>(toTransactionsData);

    // Adjust balances based on transaction type
    if (input.transactionName === "Fund") {
        estimateBalanceTo += <i32>Math.floor(parseFloat(input.amount));
    } else if (input.transactionName === "Defund") {
        estimateBalanceFrom -= <i32>Math.floor(parseFloat(input.amount));
    } else if (input.transactionName === "OfflinePayment") {
        estimateBalanceTo += <i32>Math.floor(parseFloat(input.amount));
        estimateBalanceFrom -= <i32>Math.floor(parseFloat(input.amount));
    }

    // Determine fraud status
    const fraudStatus: bool = estimateBalanceTo < 0 || estimateBalanceFrom < 0;

    // Include the balances and fraudStatus in the transaction
    input.estimateBalanceTo = estimateBalanceTo;
    input.estimateBalanceFrom = estimateBalanceFrom;
    input.fraudStatus = fraudStatus;

    // Add the transaction to FromID and ToID
    fromTransactions.push(input);
    toTransactions.push(input);
    seTransactionTable.set(input.FromID, JSON.stringify(fromTransactions));
    seTransactionTable.set(input.ToID, JSON.stringify(toTransactions));

    // Maintain a list of keys in the table
    const keysList = seTransactionTable.get("keysList") || "[]";
    const keys = JSON.parse<Array<string>>(keysList);

    if (!keys.includes(input.FromID)) {
        keys.push(input.FromID);
    }
    if (!keys.includes(input.ToID)) {
        keys.push(input.ToID);
    }
    seTransactionTable.set("keysList", JSON.stringify(keys));

    Notifier.sendJson<StoreOutput>({
        success: true,
    });
}


// /**
//  * @query
//  * List all transactions stored in the secureElementTransactionTable.
//  */
/**
 * @query
 * List all transactions stored in the secureElementTransactionTable with dynamic balance calculations.
 */
export function listAllTransactions(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Initialize array to hold all transactions
    const allTransactions: Transac[] = [];

    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const allTransactionsForKey = JSON.parse<Transac[]>(transactionData);

            let estimateBalanceTo: i32 = 0; // Initialize balance for each key
            let estimateBalanceFrom: i32 = 0;

            for (let j = 0; j < allTransactionsForKey.length; j++) {
                const transac = allTransactionsForKey[j];
                const transactionToAdd = new Transac();

                // Recalculate balances dynamically
                if (transac.transactionName === "Fund") {
                    estimateBalanceTo += <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "Defund") {
                    estimateBalanceFrom -= <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "OfflinePayment") {
                    estimateBalanceTo += <i32>Math.floor(parseFloat(transac.amount));
                    estimateBalanceFrom -= <i32>Math.floor(parseFloat(transac.amount));
                }

                // Determine fraud status dynamically
                const fraudStatus = estimateBalanceTo < 0 || estimateBalanceFrom < 0;

                // Add transaction details
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
                transactionToAdd.estimateBalanceTo = estimateBalanceTo;
                transactionToAdd.estimateBalanceFrom = estimateBalanceFrom;
                transactionToAdd.fraudStatus = fraudStatus;

                allTransactions.push(transactionToAdd);
            }
        }
    }

    // Respond with all transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: allTransactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString(),
    };

    Notifier.sendJson<TransactionListOutput>(output);
}



// /**
//  * @query
//  * @param {SecureElementKey} input - A parsed input argument
//  */
// export function listTransactionsByWalletPublicKeys(input: SecureElementKey): void {
//     const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
//     const transactionList = seTransactionTable.get(input.walletPublicKey);

//     if (!transactionList || transactionList.length === 0) {
//         Notifier.sendJson<ErrorMessage>({
//             success: false,
//             message: `No transactions found for key '${input.walletPublicKey}'`
//         });
//         return;
//     }

//     // Parse the list of transactions
//     let listTransactionsOutput: Transac[] = JSON.parse<Transac[]>(transactionList);

//     // Sort by walletPublicKey in ascending order and by txdate in descending order
//     listTransactionsOutput = listTransactionsOutput.sort((a, b) => {
//         if (a.walletPublicKey < b.walletPublicKey) return -1;
//         if (a.walletPublicKey > b.walletPublicKey) return 1;
//         // Sort by txdate in descending order
//         return b.txdate.localeCompare(a.txdate);
//     });

//     Notifier.sendJson<TransactionListOutput >({
//         success: true,
//         transactionList: listTransactionsOutput,
//         has_next: true,
//         last_evaluated_key: "1732558315756",
//         date: "2024-11-26T08:14:29.205576" // Current date and time in ISO format
//     });
// }

/**
 * @query
 * Fetch all unique walletPublicKey values from the transaction list stored in the ledger,
 * and strictly prioritize FromID over ToID for storage and balance updates.
 */
export function listAllWalletPublicKeys(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of transaction keys
    const keysList = seTransactionTable.get("keysList");
    if (!keysList || keysList.trim() === "[]") {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "No transactions found in the ledger.",
        });
        return;
    }

    const transactionKeys = JSON.parse<string[]>(keysList);
    const uniqueWallets = new Map<string, WalletStatus>();

    // Process each transaction key
    for (let i: i32 = 0; i < transactionKeys.length; i++) {
        const transactionKey = transactionKeys[i];
        const transactionData = seTransactionTable.get(transactionKey);

        if (!transactionData || transactionData.trim() === "") {
            continue;
        }

        // Parse the transaction list for this key
        const transactions = JSON.parse<Transac[]>(transactionData);

        for (let j: i32 = 0; j < transactions.length; j++) {
            const transaction = transactions[j];
            const fromWalletPublicKey = transaction.FromID;
            const toWalletPublicKey = transaction.ToID;
            const amount = parseFloat(transaction.amount);

            // ** Process FromID **
            if (!uniqueWallets.has(fromWalletPublicKey)) {
                // FromID is not present, add it
                uniqueWallets.set(fromWalletPublicKey, {
                    walletPublicKey: "*".repeat(fromWalletPublicKey.length),
                    estimateBalanceTo: 0,
                    estimateBalanceFrom: 0,
                    fraudStatus: false,
                });
            }
            const fromEntry = uniqueWallets.get(fromWalletPublicKey)!;
            if (transaction.transactionName === "Defund" || transaction.transactionName === "OfflinePayment") {
                fromEntry.estimateBalanceFrom -= amount;
                if (fromEntry.estimateBalanceFrom < 0) {
                    fromEntry.fraudStatus = true;
                }
            }

            // ** Process ToID **
            if (uniqueWallets.has(fromWalletPublicKey)) {
                // Add ToID only if FromID exists
                if (!uniqueWallets.has(toWalletPublicKey)) {
                    uniqueWallets.set(toWalletPublicKey, {
                        walletPublicKey: "*".repeat(toWalletPublicKey.length),
                        estimateBalanceTo: 0,
                        estimateBalanceFrom: 0,
                        fraudStatus: false,
                    });
                }
                const toEntry = uniqueWallets.get(toWalletPublicKey)!;
                if (transaction.transactionName === "Fund" || transaction.transactionName === "OfflinePayment") {
                    toEntry.estimateBalanceTo += amount;
                    if (toEntry.estimateBalanceTo < 0) {
                        toEntry.fraudStatus = true;
                    }
                }
            }
        }
    }

    // Prepare the output in the required format
    const walletPublicKeys: string[] = [];
    let index: i32 = 1;
    const uniqueWalletKeys = uniqueWallets.keys();
    for (let i: i32 = 0; i < uniqueWalletKeys.length; i++) {
        const key = uniqueWalletKeys[i];
        const wallet = uniqueWallets.get(key)!;
        const type = wallet.estimateBalanceFrom !== 0 ? "FromID" : "ToID";
        walletPublicKeys.push(
            `WalletPublicKey${index}: ${type} : ${wallet.walletPublicKey}, EstimateBalanceTo: ${wallet.estimateBalanceTo}, EstimateBalanceFrom: ${wallet.estimateBalanceFrom}, FraudStatus: ${wallet.fraudStatus}`
        );
        index++;
    }

    // Send the response
    Notifier.sendJson<StoredKeys>({
        success: true,
        walletPublicKeys: walletPublicKeys,
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
 * Obfuscate all transactions by masking sensitive fields with '*', while calculating dynamic balances.
 */
export function listAllTransactionsObfuscated(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Initialize array to hold all obfuscated transactions
    const obfuscatedTransactions: Transac[] = [];

    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const allTransactionsForKey = JSON.parse<Transac[]>(transactionData);

            let estimateBalanceTo: i32 = 0; // Initialize balance for each key
            let estimateBalanceFrom: i32 = 0;

            for (let j = 0; j < allTransactionsForKey.length; j++) {
                const transac = allTransactionsForKey[j];
                const transactionToAdd = new Transac();

                // Recalculate balances dynamically
                if (transac.transactionName === "Fund") {
                    estimateBalanceTo += <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "Defund") {
                    estimateBalanceFrom -= <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "OfflinePayment") {
                    estimateBalanceTo += <i32>Math.floor(parseFloat(transac.amount));
                    estimateBalanceFrom -= <i32>Math.floor(parseFloat(transac.amount));
                }

                // Determine fraud status dynamically
                const fraudStatus = estimateBalanceTo < 0 || estimateBalanceFrom < 0;

                // Mask transaction details
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

                // Add calculated balances and fraud status
                transactionToAdd.estimateBalanceTo = estimateBalanceTo;
                transactionToAdd.estimateBalanceFrom = estimateBalanceFrom;
                transactionToAdd.fraudStatus = fraudStatus;

                obfuscatedTransactions.push(transactionToAdd);
            }
        }
    }

    // Respond with obfuscated transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: obfuscatedTransactions,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString(),
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
 

/**
 * @transaction
 * Show all transactions, revealing original data if keys match, otherwise showing obfuscated data.
 * Additionally, lists all wallet public keys in the response.
 */
export function revealTransactions(input: RevealTransactionsInput): void {
    const requiredKeys: string[] = ["d23c2888169c", "40610b3cf4df", "abb4a17bfbf0"]; // Required keys

    // Validate the input
    if (!input || !input.inputKeys || input.inputKeys.length !== requiredKeys.length) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Invalid number of keys provided for Reveal the Transactions.",
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
    const uniqueWallets = new Map<string, WalletStatus>();

    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const allTransactions = JSON.parse<Transac[]>(transactionData);

            for (let j = 0; j < allTransactions.length; j++) {
                const transac = allTransactions[j];
                const transactionToAdd = new Transac();

                // Recalculate balances dynamically
                let estimateBalanceTo: i32 = 0;
                let estimateBalanceFrom: i32 = 0;

                if (transac.transactionName === "Fund") {
                    estimateBalanceTo += <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "Defund") {
                    estimateBalanceFrom -= <i32>Math.floor(parseFloat(transac.amount));
                } else if (transac.transactionName === "OfflinePayment") {
                    estimateBalanceTo += <i32>Math.floor(parseFloat(transac.amount));
                    estimateBalanceFrom -= <i32>Math.floor(parseFloat(transac.amount));
                }

                // Determine fraud status dynamically
                const fraudStatus = estimateBalanceTo < 0 || estimateBalanceFrom < 0;

                if (keysMatch && fraudStatus) {
                    // Reveal all fields when keys match
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
                } else {
                    // Mask fields if keys don't match
                    transactionToAdd.walletPublicKey = "*".repeat(transac.walletPublicKey.length);
                    transactionToAdd.synchronizationDate = "*".repeat(transac.synchronizationDate.length);
                    transactionToAdd.transactionName = "*".repeat(transac.transactionName.length);
                    transactionToAdd.FromID = "*".repeat(transac.FromID.length); // Keep FromID unmasked
                    transactionToAdd.ToID = "*".repeat(transac.ToID.length); // Keep ToID unmasked
                    transactionToAdd.nonce = "*".repeat(transac.nonce.length);
                    transactionToAdd.amount = "*".repeat(transac.amount.length);
                    transactionToAdd.generation = "*".repeat(transac.generation.length);
                    transactionToAdd.currencycode = "*".repeat(transac.currencycode.length);
                    transactionToAdd.txdate = "*".repeat(transac.txdate.length);
                }

                // Set balances based on transactionName
                if (transac.transactionName === "Fund") {
                    transactionToAdd.estimateBalanceTo = estimateBalanceTo;
        
                } else if (transac.transactionName === "Defund") {
                    transactionToAdd.estimateBalanceFrom = estimateBalanceFrom;
                } else if (transac.transactionName === "OfflinePayment") {
                    transactionToAdd.estimateBalanceTo = estimateBalanceTo;
                    transactionToAdd.estimateBalanceFrom = estimateBalanceFrom;
                }

                transactionToAdd.fraudStatus = fraudStatus;
                transactions.push(transactionToAdd);

                // Process unique wallet balances (FromID and ToID)
                const fromWalletPublicKey = transac.FromID;
                const toWalletPublicKey = transac.ToID;
                const amount = parseFloat(transac.amount);

                if (!uniqueWallets.has(fromWalletPublicKey)) {
                    uniqueWallets.set(fromWalletPublicKey, {
                        walletPublicKey: fromWalletPublicKey,
                        estimateBalanceTo: 0,
                        estimateBalanceFrom: 0,
                        fraudStatus: false,
                    });
                }
                const fromEntry = uniqueWallets.get(fromWalletPublicKey)!;
                if (transac.transactionName === "Defund" || transac.transactionName === "OfflinePayment") {
                    fromEntry.estimateBalanceFrom -= amount;
                    if (fromEntry.estimateBalanceFrom < 0) {
                        fromEntry.fraudStatus = true;
                    }
                }

                if (!uniqueWallets.has(toWalletPublicKey)) {
                    uniqueWallets.set(toWalletPublicKey, {
                        walletPublicKey: toWalletPublicKey,
                        estimateBalanceTo: 0,
                        estimateBalanceFrom: 0,
                        fraudStatus: false,
                    });
                }
                const toEntry = uniqueWallets.get(toWalletPublicKey)!;
                if (transac.transactionName === "Fund" || transac.transactionName === "OfflinePayment") {
                    toEntry.estimateBalanceTo += amount;
                    if (toEntry.estimateBalanceTo < 0) {
                        toEntry.fraudStatus = true;
                    }
                }
            }
        }
    }

    // Prepare walletPublicKeys output
    const walletPublicKeys: string[] = [];
    const uniqueWalletKeys = uniqueWallets.keys();
    let index = 1;

    for (let i: i32 = 0; i < uniqueWalletKeys.length; i++) {
        const key = uniqueWalletKeys[i];
        const wallet = uniqueWallets.get(key)!;

        // Handle separate entries for OfflinePayment
        if (wallet.estimateBalanceFrom !== 0) {
            walletPublicKeys.push(
                `WalletPublicKey${index++}:${wallet.walletPublicKey}, Balance: ${wallet.estimateBalanceFrom}, FraudStatus: ${wallet.fraudStatus}`
            );
        }
        if (wallet.estimateBalanceTo !== 0) {
            walletPublicKeys.push(
                `WalletPublicKey${index++}:${wallet.walletPublicKey}, Balance: ${wallet.estimateBalanceTo}, FraudStatus: ${wallet.fraudStatus}`
            );
        }
    }

    // Combine both responses -do 
    const output: TransactionListOutput = {
        success: true,
        transactionList: transactions,
        walletPublicKeys: walletPublicKeys,
        has_next: false,
        last_evaluated_key: "",
        date: getDate().toString(),
    };

    Notifier.sendJson<TransactionListOutput>(output);
}