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
    has_next: boolean;
    last_evaluated_key: string;
    date: string
}

@serializable
export class StoredKeys {
    success!: boolean;
    walletPublicKeys!: string[]; // Array of key-value pair strings
}
@serializable
export class GeneratedKeys {
    success: boolean = false;
    keys: Keys = new Keys();
}

@serializable
class Keys {
    key1: string = "";
    key2: string = "";
    key3: string = "";
}
