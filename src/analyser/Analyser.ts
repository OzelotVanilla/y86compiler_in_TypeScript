import { TokenType } from "../tokeniser/TokenType";
import { Token, TokeniseSuccessResult } from "../tokeniser/Tokeniser";
import { isTwoArrayEqual } from "../util/Array";
import { Result } from "../util/Result";
import { ComponentStatus, ParseFailResult } from "../util/util_type";
import { AST } from "./AST";
import { AddressNode, DestinationNode, IntConstantNode, OperandNode, OperandType, RegisterNode } from "./OperandNode";
import { BinaryOpratorStmt, DirectiveStmt, LabelOnlyStmt, NullaryOpratorStmt, StmtNode, UnaryOpratorStmt } from "./StmtNode";
import { StmtType } from "./StmtType";

const no_offset_memory_access_pattern_piece = [TokenType.left_paren, TokenType.register, TokenType.right_paren]
const with_offset_memory_access_pattern_piece = [TokenType.numeric, ...no_offset_memory_access_pattern_piece]
const two_register_operand = [OperandType.register, OperandType.register]

export class Analyser
{
    /**
     * key: different operand's type.
     * 
     * value: array of possible patterns that form the operand,
     *  the inner array stands for the sequence of token.
     */
    public static readonly token_pattern_of_operand = new Map<OperandType, (TokenType[])[]>([
        [OperandType.register, [[TokenType.register]]],
        [OperandType.constant, [[TokenType.constant]]],
        [OperandType.address, [
            no_offset_memory_access_pattern_piece,
            with_offset_memory_access_pattern_piece,
            [TokenType.numeric], [TokenType.identifier]
        ]],
        [OperandType.numeric, [[TokenType.numeric]]]
    ])

    /**
     * key: operator's name.
     * 
     * value: array of possible patterns operands,
     *  the inner array stands for the sequence of token.
     */
    public static readonly operands_patterns_of = new Map<string, (OperandType[])[]>([
        ["halt", []], ["nop", []],
        ["rrmovq", [two_register_operand]],
        ["cmovle", [two_register_operand]], ["cmovl", [two_register_operand]],
        ["cmove", [two_register_operand]], ["cmovne", [two_register_operand]],
        ["cmovge", [two_register_operand]], ["cmovg", [two_register_operand]],
        ["irmovq", [[OperandType.constant, OperandType.register]]],
        ["rmmovq", [[OperandType.register, OperandType.address]]],
        ["mrmovq", [[OperandType.address, OperandType.register]]],
        ["addq", [two_register_operand]], ["subq", [two_register_operand]],
        ["andq", [two_register_operand]], ["xorq", [two_register_operand]],
        ["jmp", [[OperandType.address]]],
        ["jle", [[OperandType.address]]], ["jl", [[OperandType.address]]],
        ["je", [[OperandType.address]]], ["jne", [[OperandType.address]]],
        ["jge", [[OperandType.address]]], ["jg", [[OperandType.address]]],
        ["call", [[OperandType.address]]], ["ret", []],
        ["pushq", [[OperandType.register]]], ["popq", [[OperandType.register]]]
    ])

    public static readonly param_of_directive = new Map<string, (OperandType[])[]>([
        [".pos", [[OperandType.numeric]]],
        [".quad", [[OperandType.numeric]]],
        [".align", [[OperandType.numeric]]]
    ])

    /**
     * This will try to read a full statement (including operation or directive) until line end.
     */
    public static readLabeledStmt(tokens: Token[], index: number): Result<Token[], ParseFailResult>
    {
        const prev_index = index
        const token_now = tokens[prev_index]
        const token_now_type = tokens[prev_index].type
        const token_now_text = tokens[prev_index].content

        if (token_now_type == TokenType.identifier)
        {
            if (tokens[prev_index + 1].type == TokenType.colon)
            {
                switch (tokens[prev_index + 2].type)
                {
                    case TokenType.operator:
                        return Analyser.readOperationStmt(tokens, prev_index + 2)
                    case TokenType.directive:
                        return Analyser.readDirectiveStmt(tokens, prev_index + 2)
                    case TokenType.new_line:
                        return Result.createOk(tokens.slice(prev_index + 0, prev_index + 2))

                    default:
                        return Result.createErr({
                            reason: `Cannot add a "${tokens[prev_index + 2].type}" directly after the colon.`,
                            at_row: tokens[prev_index + 2].position_row, at_col: tokens[prev_index + 2].position_col
                        })
                }
            }
            else // Bad syntax of labeled operation statement.
            {
                return Result.createErr({
                    reason: `A colon should be after the identifier "${token_now_text}". `
                        + `If "${token_now_text}" should not be an identifier, check your spelling.`,
                    at_row: tokens[prev_index + 1].position_row, at_col: tokens[prev_index + 1].position_col
                })
            }
        }
        else
        {
            return Result.createErr({
                reason: `A label statement should start with an non-occupied identifier, `
                    + `not a "${token_now_type}" token with value "${token_now_text}".`,
                at_row: token_now.position_row, at_col: token_now.position_col
            })
        }
    }

    /**
     * This will **not** read the label.
     * It will check the syntax of operation statement,
     *  and return the token that stands for a **valid** operation statement **without label**.
     */
    public static readOperationStmt(tokens: Token[], index: number)
    {
        return Analyser.readStmtWithOperand(tokens, index, Analyser.operands_patterns_of)
    }

    public static readDirectiveStmt(tokens: Token[], index: number)
    {
        return Analyser.readStmtWithOperand(tokens, index, Analyser.param_of_directive)
    }

    public static readStmtWithOperand(
        tokens: Token[],
        index: number,
        syntax_dict: Map<string, (OperandType[])[]>
    ): Result<Token[], Fail_readStmtWithOperand>
    {
        /** The index of the operator. */
        const operator_index = index
        const operator_name = tokens[operator_index].content
        const possible_operand_patterns = syntax_dict.get(operator_name)
        if (possible_operand_patterns == undefined)
        {
            throw TypeError(`Non-existing operator/directives "${operator_name}".`)
        }

        /** All tokens between `operator_index` and `processed_token_index` is checked by this function. */
        let processed_token_index = operator_index + 1

        /**
         * This is used to generate more user-friendly error message.
         * It will remember the count of last max match.
         */
        let max_match_count = -1
        let next_token_expecting: OperandType | undefined = undefined
        let is_stmt_matched = false

        for (let pattern_idx = 0; pattern_idx < possible_operand_patterns.length; pattern_idx++)
        {
            /** Current operand pattern to check, like `[address, register]`. */
            const operands_now = possible_operand_patterns[pattern_idx]
            for (let expect_operand_idx = 0; ;)
            {
                /** Current expecting operand, like `address`. */
                const expect_operand = operands_now[expect_operand_idx]
                const expect_operand_token_pattern = Analyser.token_pattern_of_operand.get(expect_operand)
                if (expect_operand_token_pattern == undefined)
                {
                    throw TypeError(`Operand "${expect_operand}" has no pattern registered.`)
                }

                let is_operand_matched = false

                // Each operand may have different token express, check if match.
                for (const expected_tokens of expect_operand_token_pattern)
                // for (let exp_token_idx = 0; exp_token_idx < expect_operand_token_pattern.length; exp_token_idx++)
                {
                    // These are two arrays that we are going to compare.

                    // const expected_tokens = expect_operand_token_pattern[exp_token_idx]
                    const actual_tokens = tokens.slice(
                        processed_token_index, processed_token_index + expected_tokens.length
                    ).map(e => e.type)

                    if (isTwoArrayEqual(expected_tokens, actual_tokens))
                    {
                        is_operand_matched = true
                        processed_token_index += expected_tokens.length + 1 // Also need to skip comma
                        break
                    }
                }

                if (is_operand_matched)
                {
                    // The whole statement is matched.
                    if (expect_operand_idx == operands_now.length - 1)
                    {
                        is_stmt_matched = true;
                        processed_token_index -= 1 // Remove the "trailing comma" which is another irrelevant token
                        break
                    }
                    // Still operands to check
                    else { expect_operand_idx++ }
                }
                // Must not be this operands pattern.
                else
                {
                    // See if update the max match record
                    if (expect_operand_idx > max_match_count)
                    {
                        max_match_count = expect_operand_idx
                        next_token_expecting = operands_now[expect_operand_idx + 1]
                    }
                    break
                }
            }

            // Check if successfully match.
            if (is_stmt_matched) { break }
            // If not, check whether next pattern works or not.
        }

        if (is_stmt_matched)
        {
            return Result.createOk([...tokens.slice(operator_index, processed_token_index)])
        }
        else
        {
            // Notice that `max_match_count` is the number of matched, not a index.
            const previous_matched_token = tokens[max_match_count]
            return Result.createErr({
                reason: `Incorrect operation statement`
                    + (next_token_expecting != undefined
                        ? `, expecting a "${next_token_expecting}" `
                        + `after ${max_match_count == 0
                            ? `${previous_matched_token.type} ("${previous_matched_token.content}")`
                            : `the operator/directives "${operator_name}"`
                        }.`
                        : ", please check the syntax of that"
                    ) + ".",
                at_row: tokens[max_match_count + 1].position_row,
                at_col: tokens[max_match_count + 1].position_col
            })
        }
    }

    public static getOperandNode(tokens: Token[]): Result<OperandNode, Fail_getOperandNode>
    {
        const first_token = tokens[0]
        const pos_row = first_token.position_row
        const pos_col = first_token.position_col
        switch (first_token.type)
        {
            // It is simply a register as operand.
            case TokenType.register:
                return Result.createOk(new RegisterNode({ name: first_token.content, pos_row, pos_col }))

            // It is simply a constant as operand.
            case TokenType.constant:
                const value_in_text =
                    first_token.content.slice(1) // Delete first `$` char.
                        .replace(/^0+(?=[^xb])/, "") // Delete leading zero to avoid being recognised as oct.
                // Notice that natively, only bin, hex and dec is supported here.
                return Result.createOk(new IntConstantNode({ from_text: value_in_text, pos_row, pos_col }))

            // Might be a destination or with-offset memory location
            case TokenType.numeric:
                if (tokens.length == 1)
                {
                    return Result.createOk(new DestinationNode({ from_text: first_token.content, pos_row, pos_col }))
                }
                else if (tokens[1].type == TokenType.left_paren
                    && tokens[2].type == TokenType.register
                    && tokens[3].type == TokenType.right_paren) // With-offset memory location
                {
                    return Result.createOk(new AddressNode({
                        base_register: tokens[2].content,
                        offset: parseInt(first_token.content),
                        pos_row, pos_col
                    }))
                }
                else
                {
                    return Result.createErr({
                        reason: `Malformed operand.`,
                        at_row: first_token.position_row, at_col: first_token.position_col
                    })
                }

            // That means it is a destination
            case TokenType.identifier:
                return Result.createOk(new DestinationNode({
                    label: first_token.content, pos_row, pos_col, from_text: first_token.content
                }))

            // That means it is a destination
            case TokenType.left_paren:
                return Result.createOk(new AddressNode({ base_register: tokens[1].content, pos_row, pos_col }))

            // Should not be an operand
            default:
                return Result.createErr({
                    reason: `The ${first_token.type} token cannot be the first token of operand.`,
                    at_row: first_token.position_row, at_col: first_token.position_col
                })
        }
    }

    /**                                            
     * The label is considered in this function.
     * Assume the input `tokens` passed the syntax check.
     */
    public static getOperationStmt(
        tokens: Token[], { check_syntax = true }: getStmt_Config = {}
    ): Result<StmtNode, Fail_getOperationStmt>
    {
        const is_possible_labeled = tokens[0].type == TokenType.identifier && tokens[1].type == TokenType.colon
        const operator_index = is_possible_labeled ? 2 : 0

        // Assume that user input is incorrect until checked, or manually turned this to false.
        if (check_syntax)
        {
            const result = Analyser.readOperationStmt(tokens, 0)
            if (result.isErr()) { return result as Result<any, ParseFailResult> }
        }

        /** Tokens split into smaller array based on comma, like `[[register], [register]]` */
        const operands_nodes = tokens.slice(operator_index + 1).reduce(
            (prev: Token[][], curr) =>
            {
                // `prev` holds whole result array.
                // If current token is not a comma, push current token to last array in `prev`
                if (curr.type != TokenType.comma) { prev.at(-1)!.push(curr) }
                else { prev.push([]) }

                return prev
            },
            [[]]
        ).map(token_arr => Analyser.getOperandNode(token_arr).unwrapOk())

        const label = is_possible_labeled ? tokens[0].content : null
        const operator = tokens[operator_index].content
        const [first_param, second_param] = [operands_nodes[0], operands_nodes[1]]
        const [pos_row, pos_col] = [tokens[0].position_row, tokens[0].position_col]
        switch (operands_nodes.length)
        {
            case 0: return Result.createOk(new NullaryOpratorStmt({
                label, operator, pos_row, pos_col
            }))
            case 1: return Result.createOk(new UnaryOpratorStmt({
                label, operator, first_param, pos_row, pos_col
            }))
            case 2: return Result.createOk(new BinaryOpratorStmt({
                label, operator, first_param, second_param, pos_row, pos_col
            }))
            default: return Result.createErr({
                reason: `Too many operands (${operands_nodes.length}).`,
                at_row: tokens[operator_index].position_row, at_col: tokens[operator_index].position_col
            })
        }
    }

    public static getDirectiveStmt(
        tokens: Token[], { check_syntax = true }: getStmt_Config = {}
    ): Result<StmtNode, Fail_getOperationStmt>
    {
        const is_possible_labeled = tokens[0].type == TokenType.identifier && tokens[1].type == TokenType.colon
        const directive_index = is_possible_labeled ? 2 : 0

        // Assume that user input is incorrect until checked, or manually turned this to false.
        if (check_syntax)
        {
            const result = Analyser.readDirectiveStmt(tokens, 0)
            if (result.isErr()) { return result as Result<any, ParseFailResult> }
        }

        const label = is_possible_labeled ? tokens[0].content : null
        const directive = tokens[directive_index].content
        const param_got = Analyser.getOperandNode(tokens.slice(directive_index + 1)).unwrapOk()
        const param = param_got instanceof DestinationNode
            ? param_got.toIntConstantNode()
            : param_got
        const [pos_row, pos_col] = [tokens[0].position_row, tokens[0].position_col]

        return Result.createOk(new DirectiveStmt({ directive, param, label, pos_row, pos_col, tokens }))
    }

    public static getLabelOnlyStmt(
        tokens: Token[], { check_syntax = true }: getStmt_Config = {}
    ): Result<StmtNode, Fail_getOperationStmt>
    {
        if (check_syntax)
        {
            // If the syntax itself is wrong
            if (tokens[0].type != TokenType.identifier || tokens[1].type != TokenType.colon)
            {
                return Result.createErr({
                    reason: `The provided token seems not to be a label-only statement. `
                        + `Label definition statement should starts with a identifier as label name, `
                        + `following by a colon, not "${tokens[0].type}" with a "${tokens[1].type}."`,
                    at_row: tokens[0].position_row, at_col: tokens[0].position_col
                })
            }

            // If it is too long then it is not label definition statement
            if (tokens.length > 2)
            {
                return Result.createErr({
                    reason: `Label-only statement must only contains an identifier and a colon.`,
                    at_row: tokens[2].position_row, at_col: tokens[2].position_col
                })
            }
        }

        const label = tokens[0].content
        const [pos_row, pos_col] = [tokens[0].position_row, tokens[0].position_col]
        return Result.createOk(new LabelOnlyStmt({
            label, pos_row, pos_col, length: tokens[1].position_col - pos_col
        }))
    }

    private args

    private stored__status: ComponentStatus = ComponentStatus.no_task
    public get status() { return this.stored__status }

    constructor(args: Analyser_Args)
    {
        this.args = args
    }
}

export function getASTFromTokens(tokens: Token[]): Result<AST, ParseFailResult>
export function getASTFromTokens(tokenise_result: TokeniseSuccessResult): Result<AST, ParseFailResult>
export function getASTFromTokens(param: Token[] | TokeniseSuccessResult): Result<AST, ParseFailResult>
{
    const tokens = param instanceof Array ? param : param.tokens
    let index = 0
    let stmt_nodes = [] as StmtNode[]

    while (index < tokens.length)
    {
        const current_token = tokens[index]
        const current_type = current_token.type
        let tokens_read: Result<Token[], ParseFailResult>

        // Try to read a statement represented in `Token`.
        switch (current_type)
        {
            case TokenType.operator:
                tokens_read = Analyser.readOperationStmt(tokens, index); break
            case TokenType.directive:
                tokens_read = Analyser.readDirectiveStmt(tokens, index); break
            case TokenType.identifier:
                tokens_read = Analyser.readLabeledStmt(tokens, index); break
            case TokenType.new_line:
                index++; continue // This `continue` is for outer loop.

            default:
                return Result.createErr<ParseFailResult>({
                    reason: `Statement cannot starts with "${current_type}" (for "${current_token.content}").`,
                    at_row: current_token.position_row, at_col: current_token.position_col
                })
        }

        if (tokens_read.isErr()) { return tokens_read as Result<any, ParseFailResult> }

        // Try to get a statement as a `StmtNode`.
        function toStmtType(token_type: TokenType)
        {
            switch (token_type)
            {
                case TokenType.operator: return StmtType.operation
                case TokenType.directive: return StmtType.directive
                case TokenType.identifier: return StmtType.label
                default:
                    throw TypeError(`Should not encounter statement starting with "${token_type}" now.`)
            }
        }
        const stmt_tokens = tokens_read.unwrapOk()
        const stmt_type = toStmtType(
            current_type == TokenType.identifier && stmt_tokens.length > 2
                ? tokens[index + 2].type as Exclude<typeof current_type, TokenType.identifier>
                : current_type
        )

        let get_stmt_result
        switch (stmt_type) // Check if the statement only defines a label (and then do nothing), or not.
        {
            case StmtType.operation:
                get_stmt_result = Analyser.getOperationStmt(stmt_tokens, { check_syntax: false }); break
            case StmtType.directive:
                get_stmt_result = Analyser.getDirectiveStmt(stmt_tokens, { check_syntax: false }); break
            case StmtType.label:
                get_stmt_result = Analyser.getLabelOnlyStmt(stmt_tokens, { check_syntax: false }); break
        }

        if (get_stmt_result.isErr()) { return Result.fromErr(get_stmt_result) }

        const stmt_node = get_stmt_result.unwrapOk()
        stmt_nodes.push(stmt_node)
        index += stmt_tokens.length
    }

    const source_code = param instanceof Array ? "# No code, generated from tokens" : param.source_code
    return Result.createOk(new AST({ stmt_nodes, source_code }))
}

type Fail_readStmtWithOperand = ParseFailResult & {}

type Fail_getOperationStmt = ParseFailResult & {}

type Fail_getOperandNode = ParseFailResult & {}

type Analyser_Args = {}

type getStmt_Config = {
    check_syntax?: boolean
}