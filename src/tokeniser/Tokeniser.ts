import { Generator } from "../generator/Generator";
import { Result } from "../util/Result";
import { TokenType } from "./TokenType";

export class Tokeniser
{
    public static punctuation_to_token = new Map<string, TokenType>([
        ["(", TokenType.left_paren], [")", TokenType.right_paren],
        [",", TokenType.comma], [":", TokenType.colon]
    ])

    public static available_punctuation = [...Tokeniser.punctuation_to_token.keys()]

    public static quasi_name_prefix_to_token = new Map<string, TokenType>([
        ["%", TokenType.register], [".", TokenType.directive]
    ])

    public static available_quasi_name_prefixes = [...Tokeniser.quasi_name_prefix_to_token.keys()]

    public static available_operator = [...Generator.operator_to_bin.keys()]

    public static valid_number_checker = /\-?(?:0[xb])?\d+/

    private args: Tokeniser_Args

    constructor(args?: Tokeniser_Args)
    {
        this.args = args ?? {}
    }

    private stored__status: ParseStatus = ParseStatus.no_task
    public get status() { return this.stored__status }

    private stored__tokens: Token[] | null = null
    public get tokens()
    {
        if (this.status == ParseStatus.failed || this.stored__tokens == null)
        {
            throw TypeError(`Cannot get tokens if the tokeniser failed to parse.`)
        }

        return [...this.stored__tokens]
    }

    public parse(source_text: string): Result<TokeniseSuccessResult, TokeniseFailResult>
    {
        this.stored__status = ParseStatus.pending
        let result = getTokenFromCode(source_text)
        if (result.isOk())
        {
            this.stored__status = ParseStatus.succeed
            this.stored__tokens = result.unwarpOk().tokens
        }
        else
        {
            this.stored__status = ParseStatus.failed
        }
        return result
    }

    public collectStringFormToken(use_colour: boolean = false): string
    {
        if (this.status == ParseStatus.succeed)
        {
            return getTokensDisplay(this.stored__tokens!, use_colour)
        }
        else { throw TypeError(`Can only be called if successfully parsed content. Status now: ${this.status}.`) }
    }

    public static isDigit(one_char: string)
    {
        return one_char >= '0' && one_char <= '9'
    }

    public static isHexDigit(one_char: string)
    {
        let lower_char = one_char.toLowerCase()
        return Tokeniser.isDigit(lower_char) || (lower_char >= 'a' && lower_char <= 'f')
    }

    public static isLetter(one_char: string)
    {
        return (
            (one_char >= 'a' && one_char <= 'z')
            || (one_char >= "A" && one_char <= "Z")
        )
    }

    public static isPunctuation(one_char: string)
    {
        return Tokeniser.available_punctuation.includes(one_char)
    }

    public static willBeNumber(text: string, from_index: number)
    {
        return Tokeniser.isDigit(text[from_index])
            || (text[from_index] == "-" && Tokeniser.isDigit(text[from_index + 1]))
    }

    public static willBeLineBreak(text: string, from_index: number)
    {
        const char_now = text[from_index]
        const char_next = text[from_index + 1]
        return char_now == "\r" || char_now == "\n" || (char_now == "\r" && char_next == "\n")
    }

    public static readLetterGreedly(text: string, from_index: number)
    {
        const prev_index = from_index
        let end_index = from_index
        while (Tokeniser.isLetter(text[end_index])) { end_index++ }
        return text.slice(prev_index, end_index)
    }

    /** Only read digits (from `'0'` to `'9`) */
    public static readDigitGreedly(text: string, from_index: number)
    {
        const prev_index = from_index
        let end_index = from_index
        while (Tokeniser.isDigit(text[end_index])) { end_index++ }
        return text.slice(prev_index, end_index)
    }

    /** Caution: If mal-formed number like `-0x`, it will return this part. */
    public static readNumberGreedly(text: string, from_index: number)
    {
        const prev_index = from_index
        let end_index = from_index
        enum NumberMode { bin, dec, hex }
        let number_mode = NumberMode.dec

        // First check if it is a negative number.
        if (text[end_index] == "-") { end_index++ }
        // Then check if it is non-decimal (check prefix).
        if (text[end_index] == "0" && ["b", "x"].includes(text[end_index + 1]))
        {
            if (text[end_index + 1] == "b") { number_mode = NumberMode.bin }
            else if (text[end_index + 1] == "x") { number_mode = NumberMode.hex }
            end_index += 2
        }
        // Then according to mode, read as much as possible.
        const isLegalDigit =
            number_mode == NumberMode.dec
                ? Tokeniser.isDigit
                : number_mode == NumberMode.hex
                    ? Tokeniser.isHexDigit // Otherwise, binary
                    : (one_char: string) => one_char == "0" || one_char == "1" // binary checker

        while (isLegalDigit(text[end_index] ?? "")) { end_index++ }
        return text.slice(prev_index, end_index)
    }
}

export type Tokeniser_Args = {}

export function getTokenFromCode(text: string, args?: Tokeniser_Args): Result<TokeniseSuccessResult, TokeniseFailResult>
{
    /** Index for `getTokenFromCode` to get the `char_start`. */
    let index = 0
    /** Column possition at `char_start`. */
    let pos_col = 0
    /** Row possition at `char_start`. */
    let pos_row = 0
    let tokens_parsed: Token[] = []
    let stat__start_time = Date.now()

    /** Inside function which add a number to token list (and move every index forward), or return an error. */
    function processOnNumber()
    {
        const content_got = Tokeniser.readNumberGreedly(text, index)
        if (Tokeniser.valid_number_checker.test(content_got)) // Got a valid number.
        {
            tokens_parsed.push({
                type: TokenType.constant, content: "$" + content_got,
                position_row: pos_row, position_col: pos_col
            })
            index += content_got.length
            pos_col += content_got.length
        }
        else // Should give bad result here.
        {
            const detail = `The number got "${content_got}" is malformed.`
            return Result.createErr({ at_col: pos_col, at_row: pos_row, detail })
        }
    }

    while (index < text.length)
    {
        // Skip white spaces (but not new line, because new line separates statements)
        while ([" ", "\t", "\u0020"].includes(text[index])) { index++; pos_col++ }

        const char_start = text[index]

        const is_possible_a_name = Tokeniser.isLetter(char_start)
        const is_possible_a_quasi_name = Tokeniser.available_quasi_name_prefixes.includes(char_start)

        // The following code until end of the while,
        //  should update `index` and position of `col` and `row` before next loop.

        // If it is a name, or there is a name following.
        // This process `operator`, `identifier`, `register` and `directive`.
        if (is_possible_a_name || is_possible_a_quasi_name) 
        {
            if (is_possible_a_quasi_name) { index++ }
            const content_got = Tokeniser.readLetterGreedly(text, index)
            const token: Token = {
                type: is_possible_a_quasi_name
                    ? Tokeniser.quasi_name_prefix_to_token.get(char_start)!
                    : Tokeniser.available_operator.includes(content_got)
                        ? TokenType.operator
                        : TokenType.identifier,
                content: is_possible_a_quasi_name ? char_start + content_got : content_got,
                position_row: pos_row, position_col: pos_col
            }
            tokens_parsed.push(token)
            index += content_got.length
            pos_col += content_got.length
        }
        // If it is a constant.
        else if (char_start == "$")
        {
            index++

            // If it is a number constant (actually y86 only has number for constant)
            if (Tokeniser.willBeNumber(text, index))
            {
                processOnNumber()
            }
            else
            {
                const detail =
                    `Malformed constant, cannot follow "$" with something like ${text.slice(index, index + 5)}.`
                return Result.createErr({ at_col: pos_col, at_row: pos_row, detail })
            }
        }
        // If it is a number.
        else if (Tokeniser.willBeNumber(text, index))
        {
            processOnNumber()
        }
        // If it is a punctuation.
        else if (Tokeniser.available_punctuation.includes(char_start))
        {
            tokens_parsed.push({
                type: Tokeniser.punctuation_to_token.get(char_start)!,
                content: char_start, position_row: pos_row, position_col: pos_col,
            })
            index++
            pos_col++
        }
        // If it is a line break.
        else if (Tokeniser.willBeLineBreak(text, index))
        {
            const content = text[index + 1] == "\n" ? "\r\n" : text[index]
            tokens_parsed.push({ type: TokenType.new_line, content, position_row: pos_row, position_col: pos_col })
            index += content.length
            pos_row++
            pos_col = 0
        }
        // If it starts a comment, skip until end of the line.
        else if (char_start == "#")
        {
            while (!["\r", "\n"].includes(text[index])) { index++ }
            pos_row++
            pos_col = 0
        }
        // Otherwise, something strange happens.
        else
        {
            const detail = `Something unexpected happen. The char or the content after cannot be parsed. `
                + `The content is (10 char after):\n${text.slice(index, index + 10)}`
            return Result.createErr({ at_col: pos_col, at_row: pos_row, detail })
        }
    }

    let stat__end_time = Date.now()

    return Result.createOk({ tokens: tokens_parsed, time_consumed: (stat__end_time - stat__start_time) / 1000 })
}

export function getTokensDisplay(tokens: Token[] | null | undefined, use_colour: boolean = false)
{
    if (tokens == null || tokens == undefined) { throw TypeError(`Cannot get display text of ${tokens}.`) }

    const max_length_of_token_type =
        (Object.values(TokenType) as string[]).map(s => s.length).reduce((a, b) => a > b ? a : b)
    const max_length_of_content =
        tokens.map(t => t.content.toString().length).reduce((a, b) => a > b ? a : b)

    let display_texts: string[] = []
    for (const token of tokens)
    {
        if (token.type == TokenType.new_line)
        {
            let new_line_text: string
            if (token.content == "\r") { new_line_text = "\\r" }
            else if (token.content == "\n") { new_line_text = "\\n" }
            else if (token.content == "\r\n") { new_line_text = "\\r\\n" }
            else
            {
                throw TypeError(
                    `Content "${[...token.content].map((_, pos) => String.prototype.codePointAt(pos))}"`
                )
            }

            const text = use_colour
                ? `\x1b[38;2;152;174;193m<New Line (${new_line_text}) >\x1b[39m\n`
                : `<New Line (${new_line_text}) >\n`

            display_texts.push(text)
        }
        else
        {
            const token_type_text = token.type + " ".repeat(max_length_of_token_type - token.type.length)
            const text = use_colour
                ? `\x1b[1m\x1b[38;2;137;91;138m${token_type_text}\x1b[38;2;163;163;162m:\x1b[0m  `
                + `\x1b[38;2;114;109;64m${token.content}\x1b[0m `
                + `\x1b[38;2;163;163;162m(row: ${token.position_row}, col: ${token.position_col})\x1b[0m`
                : `${token_type_text}:  ${token.content} (row: ${token.position_row}, col: ${token.position_col})`

            display_texts.push(text)
        }
    }

    return display_texts.join("\n")
}

export type Token = ({
    type: TokenType
    content: string
} | {
    type: TokenType.numeric
    content: number
}) & {
    position_row: number
    position_col: number
}

export enum ParseStatus
{
    no_task = "no_task",
    pending = "pending",
    succeed = "succeed",
    failed = "failed",
}

export type TokeniseSuccessResult = {
    /** Parsed token. */
    tokens: Token[]
    /** Consumed time for tokenising (in seconds). */
    time_consumed: number
}

export type TokeniseFailResult = {
    /** Row position for the error. */
    at_row: number
    /** Column position for the error. */
    at_col: number
    /** Descriptive message of the error. */
    detail: string
}