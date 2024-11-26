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
import { parseAllTransactions } from './transactionParser';

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

// Store transactions initially from parsed dummy data
const transactions: Transac[] = parseAllTransactions();
export function storeTransaction(input: SecureElementKey): void {
    // Load dummy transaction data
    const allTransactions = parseAllTransactions();

    // Filter transactions based on the input key
    const filteredTransactions: Transac[] = [];
    for (let i = 0; i < allTransactions.length; i++) {
        const transaction = allTransactions[i];
        if (
            transaction.walletPublicKey === input.key ||
            transaction.FromID === input.key ||
            transaction.ToID === input.key
        ) {
            filteredTransactions.push(transaction);
        }
    }

    if (filteredTransactions.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `No transactions found for key '${input.key}'`
        });
        return;
    }

    // Store filtered transactions in the secure element transaction table
    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    seTransactionTable.set(input.key, JSON.stringify<Transac[]>(filteredTransactions));

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

    const listTransactionsOutput: Transac[] = JSON.parse<Transac[]>(transactionList);

    Notifier.sendJson<TransactionListOutput>({
        success: true,
        transactionList: listTransactionsOutput
    });
}