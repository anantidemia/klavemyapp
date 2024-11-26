import { Transac } from './types'; // Import the Transac type

// Define the type for dummy data
interface DummyData {
    transaction_list: Transac[];
    has_next: boolean;
    last_evaluated_key: string;
    date: string;
}

// Dummy data as an object (or load it from an external JSON file if preferred)
const dummyData: DummyData = {
    transaction_list: [
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
        // More transactions...
    ],
    has_next: true,
    last_evaluated_key: "1732558315756",
    date: "2024-11-26T08:14:29.205576"
};

// Function to parse and map all transactions
export function parseAllTransactions(): Transac[] {
    return dummyData.transaction_list.map(transaction => ({
        ...transaction
    }));
}
