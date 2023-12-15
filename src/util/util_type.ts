export type ParseFailResult = {
    /** Descriptive message of the error. */
    reason: string
    /** Row position for the error. */
    at_row: number
    /** Column position for the error. */
    at_col: number
}