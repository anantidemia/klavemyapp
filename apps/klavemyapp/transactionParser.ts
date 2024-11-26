import { Transac } from './types'; // Import the Transac type

// Define the DummyDataType correctly for AssemblyScript
@serializable
export class DummyTransaction {
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

// Dummy data as an array of objects
const dummyData: DummyTransaction[] = [
    {
        walletPublicKey: "5b33aadf0529f2fc6917c54e8f92e509e0d2dc990c6d72f7c95f8e64849a535e91add5de8d6180c6471ecafff9b6c9165350bd9f3e05f94105ce31d295f83cd5",
        synchronizationDate: "2024-11-25T18:27:56.830374",
        transactionName: "OfflinePayment",
        FromID: "4515d2fae1df1951",
        ToID: "85d87ead1e382a9d",
        nonce: "00000011",
        amount: "00000000003c",
        generation: "00000000",
        currencycode: "0840",
        txdate: "20240802"
    },
    {
        walletPublicKey: "e4808676dd98acf2f3249f32cee2b1d88c20ac06b0dc7bf4afc3809b415c43518aed7750c10d7596dbc68ef29ce018a3c71547b0eadaa9977ffa077e97e2109c",
        synchronizationDate: "2024-11-25T18:26:37.009321",
        transactionName: "OfflinePayment",
        FromID: "d0d3d36fa4983ad2",
        ToID: "85d87ead1e382a9d",
        nonce: "00000010",
        amount: "00000000004b",
        generation: "00000000",
        currencycode: "0840",
        txdate: "20240802"
    }
    // Add more transactions as needed
];

// Function to parse and map all transactions
export function parseAllTransactions(): Transac[] {
    const transactions: Transac[] = [];

    for (let i = 0; i < dummyData.length; i++) {
        const transaction = dummyData[i];

        // Push the mapped transaction to the transactions array
        transactions.push({
            walletPublicKey: transaction.walletPublicKey,
            synchronizationDate: transaction.synchronizationDate,
            transactionName: transaction.transactionName,
            FromID: transaction.FromID,
            ToID: transaction.ToID,
            nonce: transaction.nonce,
            amount: transaction.amount,
            generation: transaction.generation,
            currencycode: transaction.currencycode,
            txdate: transaction.txdate
        });
    }

    return transactions;
}
