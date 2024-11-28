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
    TransactionListOutput
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
            message: `key '${input.key}' not found in table`
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
    let secureElement = Ledger.getTable(secureElementTable).get(input.key);
    if (secureElement.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `key '${input.key}' not found in secure element table`
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
        key: input.key,
        field1: input.field1,
        field2: input.field2,
        creationDate: getDate(),
        status: input.status
    };

    // Check if secure element already stored
    const secureElement = seTable.get(input.key);
    if (secureElement.length > 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Secure element already exists"
        });
        return;
    }

    // Check if key is already listed in the list of keys, if not add it to the list
    const keysList = seTable.get('keysList');
    if (keysList.length > 0) {
        const existingKeys = JSON.parse<string[]>(keysList);
        if (!existingKeys.includes(input.key)) {
            existingKeys.push(input.key);
            seTable.set('keysList', JSON.stringify<string[]>(existingKeys));
        }
    } else {
        seTable.set('keysList', JSON.stringify<string[]>([input.key]));
    }

    seTable.set(input.key, JSON.stringify<SecureElement>(seObj));

    Notifier.sendJson<FetchOutput>({
        success: true,
        value: `Secure element with key ${input.key} has been stored.`
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
        const key = existingKeys[i];
        const se = JSON.parse<SecureElement>(seTable.get(key));
        existingSecureElement.push(se);
    }

    Notifier.sendJson<SecureElementOutputList>({
        success: true,
        seList: existingSecureElement
    });
}

/**
 *
 * @transaction
 * @param {Transac} input - A parsed input argument
 */
export function storeTransaction(input: Transac): void {
    // Validate the input
    if (
        !input.walletPublicKey ||
        !input.FromID ||
        !input.ToID ||
        !input.amount ||
        !input.transactionName ||
        !input.synchronizationDate
    ) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Missing transaction fields in the input"
        });
        return;
    }

    // Store the transaction based on the wallet public key
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    let existingTransactionList = seTransactionTable.get(input.walletPublicKey);

    let existingTransactions: Transac[] = existingTransactionList.length > 0
        ? JSON.parse<Transac[]>(existingTransactionList)
        : [];

    // Check if a transaction with the same walletPublicKey, synchronizationDate, and nonce already exists
    let isDuplicate = false;
    for (let i = 0; i < existingTransactions.length; i++) {
        const transaction = existingTransactions[i];
        if (
            transaction.walletPublicKey === input.walletPublicKey &&
            transaction.synchronizationDate === input.synchronizationDate &&
            transaction.nonce === input.nonce
        ) {
            isDuplicate = true;
            break;
        }
    }

    if (isDuplicate) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Error Storing Transaction Logs : Duplicate entry"
        });
        return;
    }

    existingTransactions.push(input);

    // Store the updated list of transactions in the ledger
    seTransactionTable.set(input.walletPublicKey, JSON.stringify<Transac[]>(existingTransactions));

    Notifier.sendJson<StoreOutput>({
        success: true
    });
}

/**
 * @query
 * @param {SecureElementKey} input - A parsed input argument
 */
export function listTransactionsBySecureElement(input: SecureElementKey): void {
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    const transactionList = seTransactionTable.get(input.key);

    if (transactionList.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `No transactions found for key '${input.key}'`
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
