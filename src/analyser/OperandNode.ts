import { Token } from "../tokeniser/Tokeniser"

export abstract class OperandNode
{
    private static id_counter = 0
    public readonly node_id

    /** The row index of the statement starting, exactly same with index. */
    public readonly pos_row
    /** The coloum index of the statement starting, exactly same with index. */
    public readonly pos_col

    public get length(): number { throw ReferenceError(`Should not call this on abstract class.`) }

    constructor({ pos_row, pos_col }: OperandNode_Param)
    {
        this.node_id = OperandNode.id_counter++
        this.pos_row = pos_row
        this.pos_col = pos_col
    }
}

type OperandNode_Param = {
    pos_row: number
    pos_col: number
}

export abstract class CanBeLabelNode extends OperandNode
{
    public readonly label

    public get length(): number { throw ReferenceError(`Should not call this on abstract class.`) }

    /** Try to get the label if this operand is using label as its content. */
    public abstract getLabel(): string | null

    public set location(value: bigint) { throw ReferenceError(`Should not call this on abstract class.`) }
    public get location() { throw ReferenceError(`Should not call this on abstract class.`) }

    constructor({ label, pos_row, pos_col }: CanWithLabelNode_Param)
    {
        super({ pos_row, pos_col })
        this.label = label
    }
}

type CanWithLabelNode_Param = OperandNode_Param & {
    label?: string
}

export class RegisterNode extends OperandNode
{
    public readonly name
    public get length() { return this.name.length }

    constructor({ name, pos_row, pos_col }: RegisterNode_Param)
    {
        super({ pos_row, pos_col })
        this.name = name
    }
}

type RegisterNode_Param = OperandNode_Param & {
    name: string
}


/**
 * The node refers to operand like `4(%rax)` which contains a memory location.
 */
export class AddressNode extends OperandNode
{
    public readonly base_register
    public readonly offset
    private readonly tokens

    protected getLengthByTokens()
    {
        const last_token = this.tokens.at(-1)!
        return last_token.position_col + last_token.content.length - this.tokens[0].position_col
    }

    public get length()
    {
        if (this.tokens.length == 0)
        {
            console.warn(
                `Getting length from a \`AddressNode\` ("${this.offset}(${this.base_register})" here)`
                + `that is not created from tokens, might result in length that is not precise.`
                + `The whitespace and number representation might influence the result.`
            )
            return this.offset.toString().length + 2 + this.base_register.length
        }
        else
        {
            return this.getLengthByTokens()
        }
    }

    constructor({ base_register, offset = 0, pos_row, pos_col, tokens = [] }: AddressNode_Param)
    {
        super({ pos_row, pos_col })
        this.base_register = base_register
        this.offset = offset
        this.tokens = tokens
    }
}

type AddressNode_Param = OperandNode_Param & {
    base_register: string
    offset?: number
    tokens?: Token[]
}

export class IntConstantNode extends OperandNode
{
    /** The `number` (which is `f64`) type in JS is sometimes not capable for `u64`, so `bigint` is needed. */
    public readonly value: bigint
    public readonly original_text: string
    public get length() { return this.original_text.length }

    constructor({ from_text, pos_row, pos_col }: IntConstantNode_Param)
    {
        super({ pos_row, pos_col })
        this.value = BigInt(from_text)
        this.original_text = from_text
    }
}

type IntConstantNode_Param = OperandNode_Param & {
    from_text: string
}

/**
 * The node refers to operand like `0x1234` which directly denotas a memory location.
 */
export class DestinationNode extends CanBeLabelNode
{
    private value: bigint = -1n
    public override get location()
    {
        if (!this.isInited()) { throw RangeError(`Not initialised destination node.`) }
        return this.value
    }
    public override set location(value: bigint) { this.value = value }

    private stored__original_text: string
    public get original_text() { return this.stored__original_text }
    protected set original_text(value: string) { this.stored__original_text = value }

    public isInited() { return this.value >= 0 }
    public toIntConstantNode()
    {
        return new IntConstantNode({ from_text: this.original_text, pos_row: this.pos_row, pos_col: this.pos_col })
    }

    public get length() { return this.original_text.length }

    public override getLabel() { return this.isInited() ? null : this.original_text }

    constructor({ label, from_text, pos_row, pos_col }: DestinationNode_Param)
    {
        super({ label, pos_row, pos_col })
        this.stored__original_text = from_text
        if (!Number.isNaN(parseInt(from_text)))
        {
            this.value = BigInt(from_text)
        }
    }
}

type DestinationNode_Param = CanWithLabelNode_Param & {
    from_text: string
}

export enum OperandType
{
    register = "register",
    constant = "constant",
    address = "address",
    numeric = "numeric"
}