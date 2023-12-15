export class Result<OkType, ErrType>
{
    private whether_ok: boolean
    private value: OkType | ErrType

    public static createOk<ValueType, ErrType = any>(value: ValueType): Result<ValueType, ErrType>
    {
        return new Result(true, value)
    }

    public static createErr<ValueType, OkType = any>(value: ValueType): Result<OkType, ValueType>
    {
        return new Result(false, value)
    }

    public isOk(): boolean { return this.whether_ok }

    public isErr(): boolean { return !this.whether_ok }

    public unwarpOk(): OkType
    {
        if (this.isErr()) { throw TypeError(`The result is Err.`) }

        return this.value as OkType
    }

    public unwarpErr(): ErrType
    {
        if (this.isOk()) { throw TypeError(`The result is Ok.`) }

        return this.value as ErrType
    }

    constructor(whether_ok: true, value: OkType)
    constructor(whether_ok: false, value: ErrType)
    constructor(whether_ok: boolean, value: OkType | ErrType)
    {
        this.whether_ok = whether_ok
        this.value = value
    }
}