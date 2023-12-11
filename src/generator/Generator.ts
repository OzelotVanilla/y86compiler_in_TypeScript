export class Generator
{
    public static operator_to_bin = new Map<string, number>([
        ["halt", 0x00], ["nop", 0x10],
        ["rrmovq", 0x20], ["cmovle", 0x21], ["cmovl", 0x22], ["cmove", 0x23], ["cmovne", 0x24], ["cmovge", 0x25], ["cmovg", 0x26],
        ["irmovq", 0x30], ["rmmovq", 0x40], ["mrmovq", 0x50],
        ["addq", 0x60], ["subq", 0x61], ["andq", 0x62], ["xorq", 0x63],
        ["jmp", 0x70], ["jle", 0x71], ["jl", 0x72], ["je", 0x73], ["jne", 0x74], ["jge", 0x75], ["jg", 0x76],
        ["call", 0x80], ["ret", 0x90], ["pushq", 0xa0], ["popq", 0xb0]
    ])
}