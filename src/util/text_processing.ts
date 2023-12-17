/** 
 * Convert `(row, col)` index to string's index. Might be useful when get `ParseFailResult`.
 * Assume that `\r`, `\n`, `\r\n` are line separator. 
 */
export function getStringIndexFromRowCol(text: string, at_row: number, at_col: number)
{
    let index = 0
    let row_count = 1
    while (row_count < at_row)
    {
        const current_text = text[index]
        if (current_text == "\n") { row_count++; index++ }
        else if (current_text == "\r") { row_count++; index += text[index + 1] == "\n" ? 2 : 1 }
        else { index++ }
    }

    const target_line = text.slice(index, index + at_col)
    if (target_line.includes("\n") || target_line.includes("\r"))
    {
        throw RangeError(`The column count should not be ${at_col} because it is already in another line.`)
    }

    return index + at_col - 1
}