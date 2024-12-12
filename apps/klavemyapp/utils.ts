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


export function parseISODateToTimestamp(dateString: string): i64 {
    const parts = dateString.split('-');
    const year = I64.parseInt(parts[0]);
    const monthDay = parts[1].split('T');
    const month = I64.parseInt(monthDay[0]);
    const dayTime = monthDay[1].split(':');
    const day = I64.parseInt(parts[2]);
    const hour = I64.parseInt(dayTime[0]);
    const minute = I64.parseInt(dayTime[1]);
    const secondMillis = dayTime[2].split('.');
    const second = I64.parseInt(secondMillis[0]);
    const millisecond = secondMillis.length > 1 ? I64.parseInt(secondMillis[1]) : 0;

    // Calculate timestamp manually (simplified example)
    return ((year * 365 + month * 30 + day) * 24 + hour) * 3600 + minute * 60 + second; // Convert to seconds
}
