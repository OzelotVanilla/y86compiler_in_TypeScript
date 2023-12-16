import { OperandNode } from "./OperandNode"

export abstract class StmtNode
{
    private static id_counter = 0
    public readonly node_id
    public readonly label

    constructor({ label }: StmtNode_Param)
    {
        this.node_id = StmtNode.id_counter++
        this.label = label
    }
}

type StmtNode_Param = {
    label: string | null
}

export class LabelOnlyStmt extends StmtNode
{

    constructor({ label = null }: LabelStmt_Param) 
    {
        super({ label })
    }
}

type LabelStmt_Param = Partial<StmtNode_Param> & {
}

export class DirectiveStmt extends StmtNode
{
    public readonly directive
    public readonly param

    constructor({ directive, param, label = null }: DirectiveStmt_Param) 
    {
        super({ label })
        this.directive = directive
        this.param = param
    }
}

type DirectiveStmt_Param = Partial<StmtNode_Param> & {
    directive: string
    param?: OperandNode
}

export abstract class OperationStmt extends StmtNode
{
    public readonly operator

    constructor({ label = null, operator }: OperationStmt_Param) 
    {
        super({ label })
        this.operator = operator
    }
}

type OperationStmt_Param = StmtNode_Param & {
    operator: string
}

export class NullaryOpratorStmt extends OperationStmt
{
    constructor({ label, operator }: NullaryOpratorStmt_Param)
    {
        super({ label, operator })
    }
}

type NullaryOpratorStmt_Param = OperationStmt_Param & {}

export class UnaryOpratorStmt extends OperationStmt
{
    public readonly first_param

    constructor({ label, operator, first_param }: UnaryOpratorStmt_Param)
    {
        super({ label, operator })
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

    constructor({ label, operator, first_param, second_param }: BinaryOpratorStmt_Param)
    {
        super({ label, operator })
        this.first_param = first_param
        this.second_param = second_param
    }
}

type BinaryOpratorStmt_Param = OperationStmt_Param & {
    first_param: OperandNode
    second_param: OperandNode
}