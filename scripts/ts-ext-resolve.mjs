/**
 * Node test helper: resolve extensionless relative imports to .ts
 * so `node --experimental-strip-types --test` can load lib modules.
 */
export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        try {
            return await nextResolve(`${specifier}.ts`, context);
        } catch {
            // fall through
        }
    }
    return nextResolve(specifier, context);
}
