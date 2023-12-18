import { AST } from "../analyser/AST";
import { DestinationNode, IntConstantNode } from "../analyser/OperandNode";
import { DirectiveStmt, OperationStmt, StmtNode } from "../analyser/StmtNode";
import { Result } from "../util/Result";
import { ParseFailResult } from "../util/util_type";
import { AnnotatedAST, LabelWithNoDefError, MultipleLabelDefError } from "./AnnotatedAST";

export class Proofreader
{
    private args
    private ast: AST

    public static readonly num_limit_64_bit = (1n << 64n) - 1n

    constructor(ast: AST, args: Proofreader_Args)
    {
        this.args = args
        this.ast = ast
    }

    /**
     * This will make this proofreader associated with this AST until you clear.
     * First check all 
     */
    public proofread(ast: AST)
    {
        const result = getProofreadedAST(ast)
    }
}

export function getProofreadedAST(ast: AST): Result<AnnotatedAST, ProofreadError>
{
    let annotated_ast = AnnotatedAST.fromAST(ast)
    const stmt_nodes = annotated_ast.stmt_nodes

    // First go through the statements node to register symbol definition or record symbol use
    for (const stmt of stmt_nodes)
    {
        // First check if it defines a label.
        if (stmt.label != null)
        {
            const reg_result = annotated_ast.registerSymbolDefinition(stmt.label, stmt)
            if (reg_result.isErr()) // Label defined multiple times
            {
                return Result.createErr({
                    error_type: ProofreadError_ErrorType.too_many_label_def,
                    details: reg_result.unwrapErr()
                })
            }
        }

        // Then check if it uses a label.
        if (stmt instanceof OperationStmt)
        {
            for (const [used_operand, label_name] of stmt.getOperandOfLabel())
            {
                annotated_ast.recordSymbolUsage(label_name, stmt, used_operand)
            }
        }

        // Also check if any int node is exceeding the limit.
        const operands =
            stmt instanceof OperationStmt
                ? stmt.getOperands()
                : stmt instanceof DirectiveStmt ? stmt.getParam() : []

        for (let operand of operands)
        {
            if (
                (operand instanceof IntConstantNode && operand.value > Proofreader.num_limit_64_bit)
                || (operand instanceof DestinationNode
                    && operand.isInited()
                    && operand.location > Proofreader.num_limit_64_bit)
            )
            {
                return Result.createErr({
                    error_type: ProofreadError_ErrorType.value_exceed_limit,
                    details: {
                        reason: `Number ${operand instanceof IntConstantNode ? operand.value : operand.location}`
                            + ` exceed current bit length limit`,
                        at_row: operand.pos_row, at_col: operand.pos_col
                    }
                })
            }
        }
    }

    // Then check if there is some label that is not defined.
    const label_def_check = annotated_ast.checkAllLabelDefined()
    if (label_def_check.isErr())
    {
        return Result.createErr({
            error_type: ProofreadError_ErrorType.label_with_no_def,
            details: label_def_check.unwrapErr()
        })
    }

    // Every check passed, return annotated AST.
    return Result.createOk(annotated_ast)
}

type Proofreader_Args = {

}

type NumberTooBigError = ParseFailResult & {}

enum ProofreadError_ErrorType
{
    too_many_label_def,
    value_exceed_limit,
    label_with_no_def
}

type ProofreadError =
    { error_type: ProofreadError_ErrorType.too_many_label_def, details: MultipleLabelDefError }
    | { error_type: ProofreadError_ErrorType.value_exceed_limit, details: NumberTooBigError }
    | { error_type: ProofreadError_ErrorType.label_with_no_def, details: LabelWithNoDefError }

type ProofreadError_Param = MultipleLabelDefError | ParseFailResult | LabelWithNoDefError