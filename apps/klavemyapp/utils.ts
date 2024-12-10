import { Context } from "@klave/sdk";
export function getDate(): i64 {
    //trusted_time is a unix timestamp in nano second, cast it in i64 and convert in ms
    const unixTimeStamp = i64.parse(Context.get("trusted_time")) / 1000000;
    return unixTimeStamp;
}

export function getCurrentUser(): string {
    return Context.get('sender');
}
// utils.ts


// export function amountHexToNumber(hexString: string): number {
//     if (hexString.length !== 12) {
//         throw new Error("Input must be exactly 12 hex characters");
//     }

//     // Parse high and low bits
//     const highBits = parseInt(hexString.slice(0, 8), 16) as u64;
//     const lowBits = parseInt(hexString.slice(8, 12), 16) as u64;

//     // Shift high bits and combine with low bits
//     const combinedValue = (highBits << 12) | lowBits;

//     // Convert to a number and adjust scale
//     return f64(combinedValue) / 10000.0;
// }
