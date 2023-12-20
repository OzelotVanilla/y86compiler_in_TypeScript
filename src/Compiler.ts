import { getASTFromTokens } from "./analyser/Analyser"
import { generateCodeFromAnnotatedAST } from "./generator/Generator"
import { ProofreadError, getProofreadedAST } from "./proofreader/Proofreader"
import { getTokenFromCode } from "./tokeniser/Tokeniser"
import { Result } from "./util/Result"
import { ParseFailResult } from "./util/util_type"

export class Compiler
{
    constructor({ }: Compiler_Args)
    {

    }

    public compile(source_code: string): Result<Uint8Array, ParseFailResult | ProofreadError>
    {
        return compileFromSourceCode(source_code)
    }
}

export type Compiler_Args = {

}

export function compileFromSourceCode(source_code: string)
{
    const tokenise_result = getTokenFromCode(source_code)
    if (tokenise_result.isErr()) { return Result.fromErr(tokenise_result) }

    const analyser_result = getASTFromTokens(tokenise_result.unwrapOk())
    if (analyser_result.isErr()) { return Result.fromErr(analyser_result) }

    const proofread_result = getProofreadedAST(analyser_result.unwrapOk())
    if (proofread_result.isErr()) { return Result.fromErr(proofread_result) }

    const generator_result = generateCodeFromAnnotatedAST(proofread_result.unwrapOk())
    if (generator_result.isErr()) { return Result.fromErr(generator_result) }
    return Result.fromOk(generator_result)
}