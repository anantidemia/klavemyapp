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
//import { addHex,subtractHex, isNegativeHex} from './utils';


const secureElementTransactionTable = "transaction_table";

const balanceTableName = "balance_table"; // Name of the new table for storing balances
/**
 * @transaction
 * @param {Transac} input - A parsed input argument
 */
export function storeTransaction(input: Transac): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const balanceTable = Ledger.getTable(balanceTableName);

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

    // Parse the amount from hex to decimal
    const hexAmount = parseInt(input.amount, 16);
    
    // Update balances in balanceTable
    if (input.transactionName === "Fund") {
        const existingBalanceHex = balanceTable.get(input.ToID) || "0x0";
        const existingBalance = parseInt(existingBalanceHex, 16);
        const newBalance = existingBalance + hexAmount;
        balanceTable.set(input.ToID, `0x${newBalance.toString(16)}`);
    } else if (input.transactionName === "Defund") {
        const existingBalanceHex = balanceTable.get(input.FromID) || "0x0";
        const existingBalance = parseInt(existingBalanceHex, 16);
        const newBalance = existingBalance - hexAmount;
        balanceTable.set(input.FromID, `0x${newBalance.toString(16)}`);
    } else if (input.transactionName === "OfflinePayment") {
        const toBalanceHex = balanceTable.get(input.ToID) || "0x0";
        const toBalance = parseInt(toBalanceHex, 16);
        const newToBalance = toBalance + hexAmount;
        balanceTable.set(input.ToID, `0x${newToBalance.toString(16)}`);

        const fromBalanceHex = balanceTable.get(input.FromID) || "0x0";
        const fromBalance = parseInt(fromBalanceHex, 16);
        const newFromBalance = fromBalance - hexAmount;
        balanceTable.set(input.FromID, `0x${newFromBalance.toString(16)}`);
    }

    // Update keysList in balanceTable
    const balanceKeysListHex = balanceTable.get("keysList") || "[]";
    const balanceKeysList = JSON.parse<string[]>(balanceKeysListHex);

    // Avoid duplicates: Only add if not already present
    if (!balanceKeysList.includes(input.FromID)) {
        balanceKeysList.push(input.FromID);
    }
    if (input.FromID !== input.ToID && !balanceKeysList.includes(input.ToID)) {
        balanceKeysList.push(input.ToID);
    }

    balanceTable.set("keysList", JSON.stringify(balanceKeysList));

    // Update secureElementTransactionTable
    if (input.transactionName === "Fund") {
        const toTransactionsData = seTransactionTable.get(input.ToID) || "[]";
        const toTransactions = JSON.parse<Array<Transac>>(toTransactionsData);
        toTransactions.push(input);
        seTransactionTable.set(input.ToID, JSON.stringify(toTransactions));
    } else if (input.transactionName === "Defund") {
        const fromTransactionsData = seTransactionTable.get(input.FromID) || "[]";
        const fromTransactions = JSON.parse<Array<Transac>>(fromTransactionsData);
        fromTransactions.push(input);
        seTransactionTable.set(input.FromID, JSON.stringify(fromTransactions));
    } else if (input.transactionName === "OfflinePayment") {
        const fromTransactionsData = seTransactionTable.get(input.FromID) || "[]";
        const fromTransactions = JSON.parse<Array<Transac>>(fromTransactionsData);
        fromTransactions.push(input);
        seTransactionTable.set(input.FromID, JSON.stringify(fromTransactions));

        const toTransactionsData = seTransactionTable.get(input.ToID) || "[]";
        const toTransactions = JSON.parse<Array<Transac>>(toTransactionsData);
        toTransactions.push(input);
    }

    // Maintain a list of keys in secureElementTransactionTable
    const seKeysList = seTransactionTable.get("keysList") || "[]";
    const seKeys = JSON.parse<Array<string>>(seKeysList);

    if (!seKeys.includes(input.FromID) && input.transactionName !== "Fund") {
        seKeys.push(input.FromID);
    }
    if (!seKeys.includes(input.ToID) && input.transactionName !== "Defund") {
        seKeys.push(input.ToID);
    }
    seTransactionTable.set("keysList", JSON.stringify(seKeys));

    // Respond with success
    Notifier.sendJson<StoreOutput>({
        success: true,
    });
}


/**
 * @query
 * Fetch all wallet keys, dynamically calculate balances based on transactions in hexadecimal format, and provide fraud status.
 * The data except fraudStatus will be masked.
 */
export function listAllWalletPublicKeys(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Check if the table exists
    if (!seTransactionTable) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Transaction table not found or not initialized.",
        });
        return;
    }

    // Retrieve all wallet keys from the transaction table
    const keysListHex = seTransactionTable.get("keysList") || "[]"; // Default to an empty list
    const keysList = JSON.parse<string[]>(keysListHex);

    if (keysList.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "No keys found in the transaction table.",
        });
        return;
    }

    // Use a string-to-i64 mapping for wallet balances
    const walletBalances = new Map<string, i64>();

    // Calculate balances dynamically from all transactions
    for (let i = 0; i < keysList.length; i++) {
        const key = keysList[i];
        const transactionData = seTransactionTable.get(key) || "[]";
        const transactions = JSON.parse<Transac[]>(transactionData);

        for (let j = 0; j < transactions.length; j++) {
            const transaction = transactions[j];
            const amount: i64 = i64(parseInt(transaction.amount, 16)); // Convert amount from hex to i64

            if (transaction.transactionName === "Fund" || transaction.transactionName === "OfflinePayment") {
                // Add to ToID's balance
                const toBalance: i64 = walletBalances.has(transaction.ToID)
                    ? walletBalances.get(transaction.ToID)
                    : i64(0);
                walletBalances.set(transaction.ToID, toBalance + amount);
            }

            if (transaction.transactionName === "Defund" || transaction.transactionName === "OfflinePayment") {
                // Subtract from FromID's balance
                const fromBalance: i64 = walletBalances.has(transaction.FromID)
                    ? walletBalances.get(transaction.FromID)
                    : i64(0);
                walletBalances.set(transaction.FromID, fromBalance - amount);
            }
        }
    }

    const walletData: string[] = [];
    const walletKeys: string[] = walletBalances.keys();

    for (let i = 0; i < walletKeys.length; i++) {
        const walletKey = walletKeys[i];
        const balance: i64 = walletBalances.get(walletKey);
        const fraudStatus: bool = balance < 0;

        // Mask sensitive data
        const maskedWalletKey = "*".repeat(walletKey.length);
        const maskedBalance = "*".repeat(14); // Masking the balance

        // Format the wallet data
        walletData.push(
            `WalletPublicKey:${maskedWalletKey}, Balance: ${maskedBalance}, FraudStatus: ${fraudStatus}`
        );
    }

    // Send the response
    Notifier.sendJson<StoredKeys>({
        success: true,
        walletPublicKeys: walletData,
    });
}




/**
 * @query
 * List all transactions stored in the secureElementTransactionTable with fraudStatus determined by balances in the balanceTable.
 */
export function listAllTransactions(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const balanceTable = Ledger.getTable(balanceTableName); // Access the balance table

    // Retrieve the list of keys
    const keysList = seTransactionTable.get("keysList");
    const transactionKeys: string[] = keysList ? JSON.parse<string[]>(keysList) : [];

    // Initialize array to hold all transactions
    const allTransactions: Transac[] = [];

    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const allTransactionsForKey = JSON.parse<Transac[]>(transactionData);

            for (let j = 0; j < allTransactionsForKey.length; j++) {
                const transac = allTransactionsForKey[j];
                const transactionToAdd = new Transac();

                // Retrieve balances from balanceTable
                const toBalanceHex = balanceTable.get(transac.ToID) || "0x0";
                const fromBalanceHex = balanceTable.get(transac.FromID) || "0x0";

                // Convert hex balances to decimal
                const toBalance = parseInt(toBalanceHex, 16);
                const fromBalance = parseInt(fromBalanceHex, 16);

                // Determine fraud status based on balances
                const fraudStatus = toBalance < 0 || fromBalance < 0;

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
                transactionToAdd.fraudStatus = fraudStatus;

                allTransactions.push(transactionToAdd);
            }
        }
    }

    // Respond with all transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: allTransactions
    };

    Notifier.sendJson<TransactionListOutput>(output);
}




/**
 * @transaction
 * Deletes all transaction logs and data stored in the transaction_table and seTransactionTable.
 */
export function deleteAllTransactionLogs(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const balanceTable = Ledger.getTable(balanceTableName); // Access the balance table

    // Get the list of keys from the transaction table
    const transactionKeysList = seTransactionTable.get("keysList") || "[]";
    const transactionKeys = JSON.parse<string[]>(transactionKeysList);

    // Iterate through each key and clear its associated data
    for (let i = 0; i < transactionKeys.length; i++) {
        seTransactionTable.set(transactionKeys[i], ""); // Set an empty string to simulate deletion
    }

    // Clear the transaction keys list
    seTransactionTable.set("keysList", "[]"); // Reset the keys list to an empty array

    // Clear the balance table
    const balanceKeysList = balanceTable.get("keysList") || "[]";
    const balanceKeys = JSON.parse<string[]>(balanceKeysList);

    // Iterate through each key in the balance table and clear associated data
    for (let i = 0; i < balanceKeys.length; i++) {
        balanceTable.set(balanceKeys[i], ""); // Clear balance data
    }

    // Clear the balance keys list
    balanceTable.set("keysList", "[]"); // Reset the keys list to an empty array

    // Confirm deletion
    Notifier.sendJson<StoreOutput>({
        success: true,
      
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
                transactionToAdd.fraudStatus = fraudStatus;

                obfuscatedTransactions.push(transactionToAdd);
            }
        }
    }

    // Respond with obfuscated transactions
    const output: TransactionListOutput = {
        success: true,
        transactionList: obfuscatedTransactions
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
 

/**
 * @transaction
 * Show all transactions, revealing original data if keys match, otherwise showing obfuscated data.
 * Additionally, lists all wallet public keys in the response, using logic from listAllWalletPublicKeys.
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
    const walletBalances = new Map<string, i64>();

    // Calculate balances dynamically from all transactions
    for (let i = 0; i < transactionKeys.length; i++) {
        const transactionData = seTransactionTable.get(transactionKeys[i]);
        if (transactionData && transactionData.trim() !== "") {
            const allTransactions = JSON.parse<Transac[]>(transactionData);

            for (let j = 0; j < allTransactions.length; j++) {
                const transac = allTransactions[j];
                const amount: i64 = i64(parseInt(transac.amount, 16)); // Convert amount from hex to i64

                if (transac.transactionName === "Fund" || transac.transactionName === "OfflinePayment") {
                    // Add to ToID's balance
                    const toBalance: i64 = walletBalances.has(transac.ToID)
                        ? walletBalances.get(transac.ToID)
                        : i64(0);
                    walletBalances.set(transac.ToID, toBalance + amount);
                }

                if (transac.transactionName === "Defund" || transac.transactionName === "OfflinePayment") {
                    // Subtract from FromID's balance
                    const fromBalance: i64 = walletBalances.has(transac.FromID)
                        ? walletBalances.get(transac.FromID)
                        : i64(0);
                    walletBalances.set(transac.FromID, fromBalance - amount);
                }

                const transactionToAdd = new Transac();

                // Calculate fraud status dynamically
                const fraudStatus = walletBalances.get(transac.FromID) < 0 || walletBalances.get(transac.ToID) < 0;

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
                    transactionToAdd.fraudStatus = fraudStatus;
                } else {
                    // Mask fields if keys don't match
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
                    transactionToAdd.fraudStatus = fraudStatus;
                }

                transactions.push(transactionToAdd);
            }
        }
    }

    // Prepare walletPublicKeys data
    const walletData: string[] = [];
    const walletKeys: string[] = walletBalances.keys();

    for (let i = 0; i < walletKeys.length; i++) {
        const walletKey = walletKeys[i];
        const balance: i64 = walletBalances.get(walletKey);
        const fraudStatus: bool = balance < 0;

        // Mask sensitive data if keys don't match
        const maskedWalletKey = keysMatch ? walletKey : "*".repeat(walletKey.length);
        const maskedBalance = keysMatch ? balance.toString() : "*".repeat(14);

        // Format the wallet data
        walletData.push(
            `WalletPublicKey:${maskedWalletKey}, Balance: ${maskedBalance}, FraudStatus: ${fraudStatus}`
        );
    }

    // Combine both responses
    const output: TransactionListOutput = {
        success: true,
        transactionList: transactions,
        walletPublicKeys: walletData
    };

    Notifier.sendJson<TransactionListOutput>(output);
}
