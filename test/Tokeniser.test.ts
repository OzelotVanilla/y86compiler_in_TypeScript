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
