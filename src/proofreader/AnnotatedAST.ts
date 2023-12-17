import { AST } from "../analyser/AST"
import { CanBeLabelNode, OperandNode } from "../analyser/OperandNode"
import { StmtNode } from "../analyser/StmtNode"
import { Result } from "../util/Result"
import { ParseFailResult } from "../util/util_type"

export class AnnotatedAST extends AST
{
    private symbol_table: SymbolTable = new Map()

    public static fromAST(ast: AST)
    {
        let result = new AnnotatedAST({ stmt_nodes: ast.stmt_nodes, source_code: ast.source_code })
        return result
    }

    public registerSymbolDefinition(
        name: string, defined_at: StmtNode
    ): Result<undefined, MultipleLabelDefError>
    {
        if (!this.symbol_table.has(name)) { this.symbol_table.set(name, {}) }

        const symbol_reference = this.symbol_table.get(name)!
        if (symbol_reference.defined_at != undefined)
        {
            const [first_def_row, first_def_col] =
                [symbol_reference.defined_at.pos_row, symbol_reference.defined_at.pos_col]

            return Result.createErr({
                reason: `Cannot define symbol "${name}", `
                    + `it is first defined at row ${first_def_row} and column ${first_def_col}.`,
                at_row: defined_at.pos_row, at_col: defined_at.pos_col, first_def_row, first_def_col
            })
        }

        return Result.createOk(undefined)
    }

    public recordSymbolUsage(name: string, used_stmt: StmtNode, used_operand: CanBeLabelNode)
    {
        if (!this.symbol_table.has(name)) { this.symbol_table.set(name, {}) }

        const symbol_reference = this.symbol_table.get(name)!
        if (symbol_reference.used_in == undefined) { symbol_reference.used_in = [] }
        symbol_reference.used_in.push({ stmt: used_stmt, operand: used_operand })
    }

    public checkAllLabelDefined(): Result<undefined, LabelWithNoDefError>
    {
        for (const [name, reference] of this.symbol_table.entries())
        {
            if (reference.defined_at == undefined && reference.used_in != undefined)
            {
                return Result.createErr({
                    reason: `Label "${name}" is not defined in the program.`,
                    at_row: reference.used_in[0].operand.pos_row,
                    at_col: reference.used_in[0].operand.pos_col,
                    name
                })
            }
        }

        return Result.createOk(undefined)
    }

    public replaceLabelWithLocation({
        check_label_definition = true,
        check_node_has_location = true
    }: replaceLabelWithLocation_Config = {})
    {
        if (check_label_definition)
        {
            const result = this.checkAllLabelDefined()
            if (result.isErr()) { return Result.fromErr(result) }
        }
        if (check_node_has_location)
        {
            for (const [name, reference] of this.symbol_table.entries())
            {
                if (reference.defined_at == undefined || reference.defined_at.memory_location < 0n)
                {
                    return Result.createErr({
                        reason: `Statement still not have calculated memory location.`,
                        label: name,
                    })
                }
            }
        }

        for (const [name, reference] of this.symbol_table.entries())
        {
            if (reference.used_in == undefined) { continue }

            const label_defined_location = reference.defined_at!.memory_location
            for (let { operand } of reference.used_in)
            {
                operand.location = label_defined_location
            }
        }
    }
}

export type SymbolTable = Map<string, SymbolReference>

type SymbolReference = {
    defined_at?: StmtNode
    used_in?: { stmt: StmtNode, operand: CanBeLabelNode }[]
}

export type MultipleLabelDefError = ParseFailResult & { first_def_row: number; first_def_col: number }

export type LabelWithNoDefError = ParseFailResult & { name: string }

type replaceLabelWithLocation_Config = {
    check_label_definition?: boolean
    check_node_has_location?: boolean
}