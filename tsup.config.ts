import type { Options } from 'tsup';

const tsup_config: Options = {
    splitting: false,
    clean: true,
    dts: true,
    format: ["esm", "cjs"],
    bundle: true,
    skipNodeModulesBundle: true,
    target: 'esnext',
    outDir: 'dist',
    entry: ['src/**/*.ts'],
};

export default tsup_config