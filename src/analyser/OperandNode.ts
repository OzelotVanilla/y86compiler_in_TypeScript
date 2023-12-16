export abstract class OperandNode
{

}

export abstract class CanBeLabelNode extends OperandNode
{
    public readonly label

    constructor({ label }: CanWithLabelNode_Param)
    {
        super()
        this.label = label
    }
}

type CanWithLabelNode_Param = {
    label?: string
}

export class RegisterNode extends OperandNode
{
    public readonly name

    constructor({ name }: RegisterNode_Param)
    {
        super()
        this.name = name
    }
}

type RegisterNode_Param = {
    name: string
}


/**
 * The node refers to operand like `4(%rax)` which contains a memory location.
 */
export class AddressNode extends OperandNode
{
    public readonly base_register
    public readonly offset

    constructor({ base_register, offset = 0 }: AddressNode_Param)
    {
        super()
        this.base_register = base_register
        this.offset = offset
    }
}

type AddressNode_Param = {
    base_register: string
    offset?: number
}

export class IntConstantNode extends OperandNode
{
    public readonly value

    constructor({ value }: IntConstantNode_Param)
    {
        super()
        this.value = value
    }
}

type IntConstantNode_Param = {
    /** The `number` (which is `f64`) type in JS is sometimes not capable for `u64`, so `bigint` is needed. */
    value: bigint
}

/**
 * The node refers to operand like `0x1234` which directly denotas a memory location.
 */
export class DestinationNode extends CanBeLabelNode
{
    private value: bigint = -1n
    public get location() { return this.value }
    public setLocation(value: bigint) { this.value = value }
    public toIntConstantNode()
    {
        return new IntConstantNode({ value: this.location })
    }

    constructor({ label, location }: DestinationNode_Param)
    {
        super({ label })
        if (location != undefined) { this.value = location }
    }
}

type DestinationNode_Param = CanWithLabelNode_Param & {
    location?: bigint
}

export enum OperandType
{
    register = "register",
    constant = "constant",
    address = "address",
    numeric = "numeric"
}