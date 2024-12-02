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
    walletPublicKey!: string;
}

@serializable
export class SecureElement {
    walletPublicKey!: string;
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

interface ITransacInput {
    walletPublicKey: string;
    synchronizationDate: string;
    transactionName: string;
    FromID: string;
    ToID: string;
    nonce: string;
    amount: string;
    generation: string;
    currencycode: string;
    txdate: string;
}

@serializable
export class Transac {
    walletPublicKey!: string;
    synchronizationDate!: string;
    transactionName!: string;
    FromID!: string;
    ToID!: string;
    nonce!: string;
    amount!: string;
    generation!: string;
    currencycode!: string;
    txdate!: string;

    constructor(input: ITransacInput) {
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

        this.walletPublicKey = input.walletPublicKey;
        this.synchronizationDate = input.synchronizationDate;
        this.transactionName = input.transactionName;
        this.FromID = input.FromID;
        this.ToID = input.ToID;
        this.nonce = input.nonce;
        this.amount = input.amount;
        this.generation = input.generation;
        this.currencycode = input.currencycode;
        this.txdate = input.txdate;
    }
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

@serializable
export class StoreKeys {
    success!: boolean;
    walletPublicKeys!: string[]; // Array of key-value pair strings
}
