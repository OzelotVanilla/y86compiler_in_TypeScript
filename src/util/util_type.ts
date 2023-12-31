export type ParseFailResult = {
    /** Descriptive message of the error. */
    reason: string
    /** Row position for the error. */
    at_row: number
    /** Column position for the error. */
    at_col: number
}

export enum ComponentStatus
{
    no_task = "no_task",
    pending = "pending",
    succeed = "succeed",
    failed = "failed",
}