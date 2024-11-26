import { Notifier, Ledger, Subscription, JSON, Context, Transaction } from '@klave/sdk';
import { FetchInput, FetchOutput, StoreInput, StoreOutput, SecureElementKey, SecureElement, SecureElementOutput, ErrorMessage, SecureElementOutputList, Transac, TransactionListOutput } from './types';
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

    //check if secure element already stored
    const secureElement = seTable.get(input.key);
    if (secureElement.length > 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "secure element already exists"
        });
        return;
    }

    //check if key is already listed in the list of keys, if not add it to the list
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
        value: "Secure element with key " + input.key + " has been stored."
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
    //we can't use forEach in assemblyScript
    for (let i = 0; i < existingKeys.length; i++) {
        const key = existingKeys[i];
        const se = JSON.parse<SecureElement>(seTable.get(key));
        existingSecureElement.push(se);
    }

    Notifier.sendJson<SecureElementOutputList>({
        success: true,
        seList: existingSecureElement
    });
    return;
}

/**
 * @transaction
 * @param {Transac} input - A parsed input argument
 */
export function storeTransaction(input: Transac): void {
    //check input arguments
    if (!input.origin || !input.payee || !input.payer || input.amount <= 0)
    {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Wrong arguments in the input"
        });
        return;
    }

    const originSecureElement = input.origin;
    const payeeSecureElement = input.payee;
    const payerSecureElement = input.payer;

    if (!Ledger.getTable(secureElementTable).get(originSecureElement))
    {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Origin Secure Element doesn't exist - transaction won't be stored"
        });
        return;
    }
    if (!Ledger.getTable(secureElementTable).get(payeeSecureElement))
    {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Payee Secure Element doesn't exist - transaction won't be stored"
        });
        return;
    }
    if (!Ledger.getTable(secureElementTable).get(payerSecureElement))
    {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: "Payer Secure Element doesn't exist - transaction won't be stored"
        });
        return;
    }

    input.storeDate = getDate();

    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);

    //TODO: instead of reloading the whole list of transactions for 1 secure element
    //it's better to work with a chained list to prevent loading and storing too much data
    let transactionList = seTransactionTable.get(originSecureElement);
    if (transactionList.length > 0) {
        let existingTransactions: Transac[] = JSON.parse<Transac[]>(transactionList);
        existingTransactions.push(input);
        seTransactionTable.set(originSecureElement, JSON.stringify<Transac[]>(existingTransactions));
    } else {
        seTransactionTable.set(originSecureElement, JSON.stringify<Transac[]>([input]));
    }

    Notifier.sendJson<StoreOutput>({
        success: true
    });
}

/**
 * @query
 * @param {SecureElementKey} input - A parsed input argument
 */
export function listTransactionsBySecureElement(input: SecureElementKey): void {

    const secureElement = Ledger.getTable(secureElementTable).get(input.key);
    if (secureElement.length === 0) {
        Notifier.sendJson<ErrorMessage>({
            success: false,
            message: `key '${input.key}' not found in secure element table`
        });
        return;
    }

    const seTransactionTable = Ledger.getTable(secureElementTransactionTable);
    let transactionList = seTransactionTable.get(input.key);

    let listTransactionsOutput: Transac[] = [];
    if (transactionList.length > 0)
    {
        listTransactionsOutput = JSON.parse<Transac[]>(transactionList);
    }

    Notifier.sendJson<TransactionListOutput>({
        success: true,
        transactionList: listTransactionsOutput
    });
}
