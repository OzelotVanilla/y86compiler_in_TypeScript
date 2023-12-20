import { getASTFromTokens } from "../analyser/Analyser"
import { AddressNode, DestinationNode, IntConstantNode, OperandNode, RegisterNode } from "../analyser/OperandNode"
import { DirectiveStmt, OperationStmt, StmtNode } from "../analyser/StmtNode"
import { AnnotatedAST } from "../proofreader/AnnotatedAST"
import { getProofreadedAST } from "../proofreader/Proofreader"
import { getTokenFromCode } from "../tokeniser/Tokeniser"
import { Result } from "../util/Result"
import { ComponentStatus, ParseFailResult } from "../util/util_type"

const mapping_of_operator_to_bin = [
    ["halt", 0x00], ["nop", 0x10],
    ["rrmovq", 0x20], ["cmovle", 0x21], ["cmovl", 0x22], ["cmove", 0x23], ["cmovne", 0x24], ["cmovge", 0x25], ["cmovg", 0x26],
    ["irmovq", 0x30], ["rmmovq", 0x40], ["mrmovq", 0x50],
    ["addq", 0x60], ["subq", 0x61], ["andq", 0x62], ["xorq", 0x63],
    ["jmp", 0x70], ["jle", 0x71], ["jl", 0x72], ["je", 0x73], ["jne", 0x74], ["jge", 0x75], ["jg", 0x76],
    ["call", 0x80], ["ret", 0x90], ["pushq", 0xa0], ["popq", 0xb0]
] as const

const operation_length_in_byte_64_bit_mode = [
    ["halt", 1], ["nop", 1],
    ["rrmovq", 2], ["cmovle", 2], ["cmovl", 2], ["cmove", 2], ["cmovne", 2], ["cmovge", 2], ["cmovg", 2],
    ["irmovq", 10], ["rmmovq", 10], ["mrmovq", 10],
    ["addq", 2], ["subq", 2], ["andq", 2], ["xorq", 2],
    ["jmp", 9], ["jle", 9], ["jl", 9], ["je", 9], ["jne", 9], ["jge", 9], ["jg", 9],
    ["call", 9], ["ret", 1], ["pushq", 2], ["popq", 2]
] as const

const mapping_register_to_bin = [
    ["%rax", 0x0], ["%rbx", 0x3], ["%rcx", 0x1], ["%rdx", 0x2],
    ["%rsp", 0x4], ["%rbp", 0x5], ["%rsi", 0x6], ["%rdi", 0x7],
    ["r8", 0x8], ["r9", 0x9], ["r10", 0xa], ["r11", 0xb],
    ["r12", 0xc], ["r13", 0xd], ["r14", 0xe],
] as const

export class Generator
{
    /**
     * The operator that is supported in the original Y86.
     */
    public static readonly operator_to_bin = new Map<string, number>(mapping_of_operator_to_bin)

    public static readonly operation_mem_length = new Map<string, number>(operation_length_in_byte_64_bit_mode)

    public static readonly register_to_bin = new Map<string, number>(mapping_register_to_bin)

    /**
     * @returns Total length of the program.
     */
    public static calculateAndSetMemLoc(anot_ast: AnnotatedAST): Result<number, ParseFailResult>
    {
        let mem_loc = 0
        let align = 8

        for (const stmt of anot_ast.stmt_nodes)
        {
            // Assign the location of current statement first
            stmt.memory_location = BigInt(mem_loc)

            // Only need to increase the mem location if encounter `OperationStmt`.
            if (stmt instanceof OperationStmt)
            {
                const mem_len_found = Generator.operation_mem_length.get(stmt.operator)
                if (mem_len_found == undefined)
                {
                    throw TypeError(
                        `The operator "${stmt.operator}" doesn't exist in memory length table.`
                    )
                }

                mem_loc += mem_len_found
            }
            else if (stmt instanceof DirectiveStmt)
            {
                switch (stmt.directive)
                {
                    case ".pos":
                        const pos_value = (stmt.getParam()[0] as IntConstantNode).value
                        if (pos_value < mem_loc)
                        {
                            return Result.createErr({
                                reason: `Position directive changed current location to ${pos_value}, `
                                    + `but it should be greater than last operation's location ${mem_loc}.`,
                                at_row: stmt.pos_row, at_col: stmt.pos_col
                            })
                        }
                        mem_loc = Number(pos_value)
                        break

                    case ".quad":
                        mem_loc += 8
                        break

                    case ".align":
                    // TODO

                    default:
                        return Result.createErr({
                            reason: `Directive "${stmt.directive}" not available.`,
                            at_row: stmt.pos_row, at_col: stmt.pos_col
                        })
                }
            }
        }

        return Result.createOk(mem_loc)
    }

    public static replaceLabelWithLocation(anot_ast: AnnotatedAST)
    {
        return anot_ast.replaceLabelWithLocation()
    }

    public static translateStmtToMachineCode(stmt: StmtNode, { endian = "little" }: Generator_Args = {})
    {
        let result: number[] = []

        function isRaRbStmt(bin_operator: number)
        {
            return (bin_operator >= 0x20 && bin_operator <= 0x26)
                || (bin_operator >= 0x60 && bin_operator <= 0x63)
                || bin_operator == 0x40 || bin_operator == 0x50
        }

        function isJumpOrCallStmt(bin_operator: number)
        {
            return (bin_operator >= 0x70 && bin_operator <= 0x76) || bin_operator == 0x80
        }

        function getRegName(operand: OperandNode)
        {
            if (operand instanceof RegisterNode) { return operand.name }
            else if (operand instanceof AddressNode) { return operand.base_register }
            else { throw TypeError(`The operand does not contain register name.`) }
        }

        if (stmt instanceof OperationStmt)
        {
            // First two byte will be `opcode` and `ifunc`
            const bin_operator = Generator.operator_to_bin.get(stmt.operator)!
            result.push(bin_operator)

            // Then decide whether `register` will be next, or destination
            const operator = stmt.operator

            // Should also push two register (`rrmovq` or `cmovxx` or `rmmovq` or `mrmovq` or `operator`)
            if (isRaRbStmt(bin_operator))
            {
                const operands = stmt.getOperands()
                const ra_bin = Generator.register_to_bin.get(getRegName(operands[0]))!
                const rb_bin = Generator.register_to_bin.get(getRegName(operands[1]))!
                result.push((ra_bin << 4) + rb_bin)

                // Should push number after that
                if (bin_operator == 0x40) // `rmmovq`
                {
                    result.push((operands[1] as AddressNode).offset)
                }
                else if (bin_operator == 0x50) // `mrmovq`
                {
                    result.push((operands[0] as AddressNode).offset)
                }
            }
            else if (isJumpOrCallStmt(bin_operator))
            {
                const dest = stmt.getOperands()[0]
                result.push(...this.getLittleEndianU64((dest as DestinationNode).location))
            }
            else if (bin_operator == 0x30) // `irmovq`
            {
                const operands = stmt.getOperands()
                const i_num = this.getLittleEndianU64((operands[0] as IntConstantNode).value)
                const rb_bin = Generator.register_to_bin.get(getRegName(operands[1]))!
                result.push(0xf0 + rb_bin, ...i_num)
            }
            else if (bin_operator == 0xa0 || bin_operator == 0xb0) // `pushq` or `popq`
            {
                const ra_bin = Generator.register_to_bin.get(getRegName(stmt.getOperands()[0]))!
                result.push((ra_bin << 4) + 0xf)
            }
            else
            {
                throw RangeError(`Operator (${operator}) not supported.`)
            }
        }
        else if (stmt instanceof DirectiveStmt)
        {
            if (stmt.directive == ".quad")
            {
                result.push(...this.getLittleEndianU64((stmt.param as IntConstantNode).value))
            }
        }

        return result
    }

    public static getLittleEndianU64(value: bigint)
    {
        let result = []
        for (let i = 0; i < 8; i++)
        {
            result[i] = (value >> BigInt(4 * i)) & 0xfn
        }

        return result.map(n => Number(n))
    }

    private args

    private stored__status: ComponentStatus = ComponentStatus.no_task
    public get status() { return this.stored__status }

    constructor(args: Generator_Args)
    {
        this.args = args
        this.args.endian = this.args.endian ?? "little"
    }

    public generateFrom(anot_ast: AnnotatedAST)
    {
        return generateCodeFromAnnotatedAST(anot_ast)
    }
}

export function generateCodeFromAnnotatedAST(
    anot_ast: AnnotatedAST
): Result<Uint8Array, ParseFailResult>
{
    // First let the AST fill every statement with memory location
    const set_mem_loc_result = Generator.calculateAndSetMemLoc(anot_ast)
    if (set_mem_loc_result.isErr()) { return Result.fromErr(set_mem_loc_result) }

    // Then replace every label with actual memory location
    Generator.replaceLabelWithLocation(anot_ast)

    let result = new Uint8Array(set_mem_loc_result.unwrapOk())
    let index = 0
    for (const stmt of anot_ast.stmt_nodes)
    {
        const translated = Generator.translateStmtToMachineCode(stmt)
        for (let i = 0; i < translated.length; i++) { result[index++] = translated[i] }
    }

    return Result.createOk(result)
}

type Generator_Args = {
    endian?: "big" | "little"
}

export const possible_original_y86_operator = mapping_of_operator_to_bin.map(x => x[0])