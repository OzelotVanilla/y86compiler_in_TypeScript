/**
 * Perform an `==` check on array elements.
 */
export function isTwoArrayEqual<EleType>(a: EleType[], b: EleType[])
{
    return (a ?? false) && (b ?? false) && a.length == b.length
        && a.every((v, i) => v == b[i])
}