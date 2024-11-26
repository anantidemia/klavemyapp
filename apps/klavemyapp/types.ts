import { JSON } from '@klave/sdk';

@serializable
export class ErrorMessage {
    success!: boolean;
    message!: string;
}

@serializable
export class FetchInput {
    key!: string;
}

@serializable
export class FetchOutput {
    success!: boolean;
    value!: string;
}

@serializable
export class StoreInput {
    key!: string;
    value!: string;
}

@serializable
export class StoreOutput {
    success!: boolean;
}

@serializable
export class SecureElementKey {
    key!: string;
}

@serializable
export class SecureElement {
    key!: string;
    field1!: string;
    field2!: string;
    creationDate!: i64;
    status!: string;
}

@serializable
export class SecureElementOutput {
    success!: boolean;
    secureElement!: string;
}

@serializable
export class SecureElementOutputList {
    success!: boolean;
    seList!: SecureElement[];
}

@serializable
export class Transac {
    origin!: string;
    payer!: string;
    payee!: string;
    amount: number = 0;
    storeDate!: i64;
}

@serializable
export class SecureElementTransaction {
    secureElement!: string;
    transactionList!: Transac[];
}

@serializable
export class TransactionListOutput {
    success!: boolean;
    transactionList!: Transac[];
}