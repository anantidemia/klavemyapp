import { Context } from "@klave/sdk";

export function getDate(): i64 {
    //trusted_time is a unix timestamp in nano second, cast it in i64 and convert in ms
    const unixTimeStamp = i64.parse(Context.get("trusted_time")) / 1000000;
    return unixTimeStamp;
}

export function getCurrentUser(): string {
    return Context.get('sender');
}