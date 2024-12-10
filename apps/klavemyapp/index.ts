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


const secureElementTransactionTable = "transaction_table";

const balanceTableName = "balance_table"; // Name of the new table for storing balances

/**
 * @transaction
 * @param {Transac} input - A parsed input argument
 */
export function storeTransaction(input: Transac): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const balanceTable = Ledger.getTable(balanceTableName); // Access the new balance table

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
    const hexAmount = parseInt(input.amount, 16); // Convert hex amount to integer for calculations

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

    // Update secureElementTransactionTable
    if (input.transactionName === "Fund") {
        // Add transaction to ToID
        const toTransactionsData = seTransactionTable.get(input.ToID) || "[]";
        const toTransactions = JSON.parse<Array<Transac>>(toTransactionsData);
        toTransactions.push(input);
        seTransactionTable.set(input.ToID, JSON.stringify(toTransactions));
    } else if (input.transactionName === "Defund") {
        // Add transaction to FromID
        const fromTransactionsData = seTransactionTable.get(input.FromID) || "[]";
        const fromTransactions = JSON.parse<Array<Transac>>(fromTransactionsData);
        fromTransactions.push(input);
        seTransactionTable.set(input.FromID, JSON.stringify(fromTransactions));
    } else if (input.transactionName === "OfflinePayment") {
        // Add transaction to both FromID and ToID
        const fromTransactionsData = seTransactionTable.get(input.FromID) || "[]";
        const fromTransactions = JSON.parse<Array<Transac>>(fromTransactionsData);
        fromTransactions.push(input);
        seTransactionTable.set(input.FromID, JSON.stringify(fromTransactions));

        const toTransactionsData = seTransactionTable.get(input.ToID) || "[]";
        const toTransactions = JSON.parse<Array<Transac>>(toTransactionsData);
        toTransactions.push(input);
        seTransactionTable.set(input.ToID, JSON.stringify(toTransactions));
    }

    // Maintain a list of keys in secureElementTransactionTable
    const keysList = seTransactionTable.get("keysList") || "[]";
    const keys = JSON.parse<Array<string>>(keysList);

    if (!keys.includes(input.FromID) && input.transactionName !== "Fund") {
        keys.push(input.FromID);
    }
    if (!keys.includes(input.ToID) && input.transactionName !== "Defund") {
        keys.push(input.ToID);
    }
    seTransactionTable.set("keysList", JSON.stringify(keys));

    // Respond with success
    Notifier.sendJson<StoreOutput>({
        success: true,
    });
}


/**
 * @query
 * Fetch all wallet keys, calculate fraud status based on balance, and provide masked keys and balances.
 */
export function listAllWalletPublicKeys(): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    // Retrieve the list of keys
    const keysListHex = seTransactionTable.get("keysList") || "[]";
    const keysList: string[] = JSON.parse<string[]>(keysListHex);

    // Handle case when no keys are found
    if (!keysList || keysList.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "No wallet public keys found.",
        });
        return;
    }

    const walletBalances: Map<string, i32> = new Map();

    // Iterate through all transactions for each key and calculate the balance
    for (let i = 0; i < keysList.length; i++) {
        const key = keysList[i];
        const transactionsData = seTransactionTable.get(key) || "[]";
        const transactions: Array<Transac> = JSON.parse<Array<Transac>>(transactionsData);

        for (let j = 0; j < transactions.length; j++) {
            const transaction = transactions[j];
            const amount: i32 = <i32>parseInt(transaction.amount, 16); // Convert hex amount to integer

            // Update balance based on transaction type
            if (transaction.transactionName === "Fund" && transaction.ToID === key) {
                walletBalances.set(
                    key,
                    (walletBalances.get(key) || 0) + amount
                );
            } else if (transaction.transactionName === "Defund" && transaction.FromID === key) {
                walletBalances.set(
                    key,
                    (walletBalances.get(key) || 0) - amount
                );
            } else if (transaction.transactionName === "OfflinePayment") {
                if (transaction.ToID === key) {
                    walletBalances.set(
                        key,
                        (walletBalances.get(key) || 0) + amount
                    );
                }
                if (transaction.FromID === key) {
                    walletBalances.set(
                        key,
                        (walletBalances.get(key) || 0) - amount
                    );
                }
            }
        }
    }

    const walletData: string[] = [];

    // Prepare the wallet public key output with calculated balances
    for (let i = 0; i < keysList.length; i++) {
        const key = keysList[i];
        const balance: i32 = walletBalances.get(key) || 0;
        const balanceHex = balance < 0
            ? `-0x${Math.abs(balance).toString(16)}`
            : `0x${balance.toString(16)}`;
        const fraudStatus = balance < 0;

        walletData.push(
            `WalletPublicKey${i + 1}:${key}, Balance: ${balanceHex}, FraudStatus: ${fraudStatus}`
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
        transactionList: obfuscatedTransactions
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
        walletPublicKeys: walletPublicKeys
    };

    Notifier.sendJson<TransactionListOutput>(output);
}