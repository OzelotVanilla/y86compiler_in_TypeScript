import { Token } from "../tokeniser/Tokeniser"
import { CanBeLabelNode, OperandNode } from "./OperandNode"

export abstract class StmtNode
{
    private static id_counter = 0
    public readonly node_id
    public readonly label
    /** The row index of the statement starting, exactly same with index. */
    public readonly pos_row
    /** The column index of the statement starting, exactly same with index. */
    public readonly pos_col
    public get length(): number { throw ReferenceError(`Should not call this on abstract class.`) }

    /** Will be init later in code generation phase. */
    public memory_location: bigint = -1n

    constructor({ label, pos_col, pos_row }: StmtNode_Param)
    {
        this.node_id = StmtNode.id_counter++
        this.label = label
        this.pos_row = pos_row
        this.pos_col = pos_col
    }
}

type StmtNode_Param = {
    label: string | null
    pos_row: number
    pos_col: number
}

type StmtNode_Param_CanBeOmit = "label"

type StmtNode_SuperConstructor_Param =
    Partial<Pick<StmtNode_Param, StmtNode_Param_CanBeOmit>>
    & Pick<StmtNode_Param, Exclude<keyof StmtNode_Param, StmtNode_Param_CanBeOmit>>

export class LabelOnlyStmt extends StmtNode
{
    private stored__length
    public override get length() { return this.stored__length }

    constructor({ label, pos_col, pos_row, length }: LabelStmt_Param) 
    {
        super({ label, pos_col, pos_row })
        this.stored__length = length
    }
}

type LabelStmt_Param = Pick<StmtNode_Param, Exclude<keyof StmtNode_Param, "label">> & {
    label: string
    length: number
}

export class DirectiveStmt extends StmtNode
{
    public readonly directive
    public readonly param
    public readonly tokens

    public override get length() { return this.directive.length + (this.param?.length ?? 0) }

    public getParam() { return this.param != undefined ? [this.param] : [] }

    constructor({ directive, param, label = null, pos_col, pos_row, tokens }: DirectiveStmt_Param) 
    {
        super({ label, pos_col, pos_row })
        this.directive = directive
        this.param = param
        this.tokens = tokens
    }
}

type DirectiveStmt_Param = StmtNode_SuperConstructor_Param & {
    directive: string
    param?: OperandNode
    tokens: Token[]
}

export abstract class OperationStmt extends StmtNode
{
    public readonly operator
    public readonly tokens

    protected getLengthByTokens()
    {
        const last_token = this.tokens.at(-1)!
        return last_token.position_col + last_token.content.length - this.tokens[0].position_col
    }

    protected warnNonPreciseLengthGetting()
    {
        console.warn(
            `Getting length from a \`OperationStmt\` ("${this.operator}" here) that is not created from tokens, `
            + `might result in length that is not precise. The whitespace might influence the result.`
        )
    }

    /** Return the `(operand_node, label_name)[]`. */
    public abstract getOperandOfLabel(): (readonly [CanBeLabelNode, string])[]

    /** Return `operand[]`. */
    public abstract getOperands(): OperandNode[]

    constructor({ label = null, operator, pos_col, pos_row, tokens = [] }: OperationStmt_Param) 
    {
        super({ label, pos_col, pos_row })
        this.operator = operator
        this.tokens = tokens
    }
}

type OperationStmt_Param = StmtNode_SuperConstructor_Param & {
    operator: string
    tokens?: Token[]
}

export class NullaryOpratorStmt extends OperationStmt
{
    public override get length(): number
    {
        // Not precise length getting.
        if (this.tokens.length == 0)
        {
            this.warnNonPreciseLengthGetting()
            return (this.label?.length ?? 0) + 1 + this.operator.length
        }
        else { return this.getLengthByTokens() }
    }

    public override getOperandOfLabel() { return [] }

    public override getOperands() { return [] }

    constructor({ label, operator, pos_col, pos_row, tokens }: NullaryOpratorStmt_Param)
    {
        super({ label, operator, pos_col, pos_row, tokens })
    }
}

type NullaryOpratorStmt_Param = OperationStmt_Param & {}

export class UnaryOpratorStmt extends OperationStmt
{
    public readonly first_param

    public override get length(): number
    {
        if (this.tokens.length == 0)
        {
            this.warnNonPreciseLengthGetting()
            return (this.label?.length ?? 0) + 1 + this.operator.length + this.first_param.length
        }
        else { return this.getLengthByTokens() }
    }

    public override getOperandOfLabel()
    {
        let result = []
        if (this.first_param instanceof CanBeLabelNode)
        {
            const label = this.first_param.getLabel()
            if (label != null) { result.push([this.first_param, label] as const) }
        }
        return result
    }

    public override getOperands() { return [this.first_param] }

    constructor({ label, operator, first_param, pos_col, pos_row, tokens }: UnaryOpratorStmt_Param)
    {
        super({ label, operator, pos_col, pos_row, tokens })
        this.first_param = first_param
    }
}

type UnaryOpratorStmt_Param = OperationStmt_Param & {
    first_param: OperandNode
}

export class BinaryOpratorStmt extends OperationStmt
{
    public readonly first_param
    public readonly second_param

    public override get length(): number
    {
        if (this.tokens.length == 0)
        {
            this.warnNonPreciseLengthGetting()
            return (this.label?.length ?? 0) + 1
                + this.operator.length + this.first_param.length + this.second_param.length
        }
        else { return this.getLengthByTokens() }
    }

    public override getOperandOfLabel()
    {
        let result = []
        if (this.first_param instanceof CanBeLabelNode)
        {
            const label = this.first_param.getLabel()
            if (label != null) { result.push([this.first_param, label] as const) }
        }
        if (this.second_param instanceof CanBeLabelNode)
        {
            const label = this.second_param.getLabel()
            if (label != null) { result.push([this.second_param, label] as const) }
        }
        return result
    }

    public override getOperands() { return [this.first_param, this.second_param] }

    constructor({ label, operator, first_param, second_param, pos_col, pos_row, tokens }: BinaryOpratorStmt_Param)
    {
        super({ label, operator, pos_col, pos_row, tokens })
        this.first_param = first_param
        this.second_param = second_param
    }
}

type BinaryOpratorStmt_Param = OperationStmt_Param & {
    first_param: OperandNode
    second_param: OperandNode
}