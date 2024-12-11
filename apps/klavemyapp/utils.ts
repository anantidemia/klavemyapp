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
/**
 * Adds two hexadecimal values.
 */
/**
 * Adds two hexadecimal values as strings.
 */
export function addHex(hex1: string, hex2: string): string {
    const val1 = parseInt(hex1, 16);
    const val2 = parseInt(hex2, 16);
    return `0x${(val1 + val2).toString(16).padStart(12, "0")}`;
}

/**
 * Subtracts one hexadecimal value from another as strings.
 */
export function subtractHex(hex1: string, hex2: string): string {
    const val1 = parseInt(hex1, 16);
    const val2 = parseInt(hex2, 16);
    const result = val1 - val2;
    return result < 0
        ? `-0x${Math.abs(result).toString(16).padStart(12, "0")}`
        : `0x${result.toString(16).padStart(12, "0")}`;
}

/**
 * Determines if a hexadecimal value is negative.
 */
export function isNegativeHex(hex: string): boolean {
    return hex.startsWith("-");
}