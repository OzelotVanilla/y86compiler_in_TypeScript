import { Tokeniser } from "../src/tokeniser/Tokeniser"

test(
    "Check `Tokeniser.readLetterGreedly` correctness of text read",
    function ()
    {
        expect(
            Tokeniser.readLetterGreedly("#abc0", 1)
        ).toBe("abc")
        expect(
            Tokeniser.readLetterGreedly("!@#$%^^", 2)
        ).toBe("")
    }
)

test(
    "Check `Tokeniser.readNumberGreedly` correctness of text read",
    function ()
    {
        // Well formed number `42`.
        expect(Tokeniser.readNumberGreedly("42", 0)).toBe("42")

        // Well formed number `0x64c`.
        expect(Tokeniser.readNumberGreedly("0x64c", 0)).toBe("0x64c")
        expect(Tokeniser.readNumberGreedly("0x64C", 0)).toBe("0x64C")

        // Well formed negative number `-12`.
        expect(Tokeniser.readNumberGreedly("-12", 0)).toBe("-12")

        // Well formed negative number `-0b1100`
        expect(Tokeniser.readNumberGreedly("-0b1100", 0)).toBe("-0b1100")

        // In-the-wild number `42`
        expect(Tokeniser.readNumberGreedly("42abc", 0)).toBe("42")
        expect(Tokeniser.readNumberGreedly("42#", 0)).toBe("42")

        // Mal formed string `-0x`
        expect(Tokeniser.readNumberGreedly("-0x", 0)).toBe("-0x")
        expect(Tokeniser.readNumberGreedly("-0xp", 0)).toBe("-0x")
    }
)

test(
    "Check Tokeniser works or not",
    function ()
    {
        let parser_1 = new Tokeniser()
        let parser_1_result = parser_1.parse("addq %rax, %rbx\nsubq %rbx, %rcx\nhalt")
        expect(parser_1_result.unwrapOk().tokens).toEqual([
            { type: 'operator', content: 'addq', position_col: 1, position_row: 1 },
            { type: 'register', content: '%rax', position_col: 6, position_row: 1 },
            { type: 'comma', content: ',', position_col: 9, position_row: 1 },
            { type: 'register', content: '%rbx', position_col: 11, position_row: 1 },
            { type: 'new_line', content: '\n', position_col: 14, position_row: 1 },
            { type: 'operator', content: 'subq', position_col: 1, position_row: 2 },
            { type: "register", content: "%rbx", position_col: 6, position_row: 2 },
            { type: 'comma', content: ',', position_col: 9, position_row: 2 },
            { type: 'register', content: '%rcx', position_col: 11, position_row: 2 },
            { type: 'new_line', content: '\n', position_col: 14, position_row: 2 },
            { type: 'operator', content: 'halt', position_col: 1, position_row: 3 }
        ])

        let parser_2 = new Tokeniser()
        let parser_2_result = parser_2.parse("irmovq $0x")
        expect(parser_2_result.isOk()).toBe(false)
    }
)