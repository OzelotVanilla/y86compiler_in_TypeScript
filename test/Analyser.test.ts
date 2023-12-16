import { Analyser } from "../src/analyser/Analyser"
import { IntConstantNode } from "../src/analyser/OperandNode"
import { Tokeniser, getTokenFromCode } from "../src/tokeniser/Tokeniser"

const test_program = `
    irmovq $42, %rax
    addq %rax, %rbx
    mrmovq (%rcx), %rax
    mrmovq 10(%rdx), %rcx
`

test(
    "Check `Analyser.getOperandNode` correctness of text read",
    function ()
    {
        const tokeniser = new Tokeniser()
        const tokens = tokeniser.parse(test_program.trim()).unwarpOk().tokens
        expect(Analyser.getOperandNode(tokens.slice(1, 2)).unwarpOk()).toBeInstanceOf(IntConstantNode)
    }
)

test(
    "Check `Analyser.readOperationStmt` correctness",
    function ()
    {
        expect(
            Analyser.readOperationStmt(getTokenFromCode("addq %rax, %rbx").unwarpOk().tokens, 0)
                .isOk()
        ).toBe(true)

    }
)