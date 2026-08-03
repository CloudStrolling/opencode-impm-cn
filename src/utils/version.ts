/**
 * 版本号工具：解析、比较、自增与文件名提取。
 */

/** 解析版本号字符串为 [major, minor, patch] */
export function parseVersion(version: string): [number, number, number] {
    const v = version.replace(/^[vV]/, "").trim();
    const parts = v.split(".").map((p) => parseInt(p, 10) || 0);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** 格式化版本号 */
export function formatVersion(major: number, minor: number, patch: number): string {
    return `${major}.${minor}.${patch}`;
}

/** 比较两个版本号：a > b 返回 1，a < b 返回 -1，相等返回 0 */
export function compareVersions(a: string, b: string): number {
    const [am, ai, ap] = parseVersion(a);
    const [bm, bi, bp] = parseVersion(b);
    if (am !== bm) {
        return am > bm ? 1 : -1;
    }
    if (ai !== bi) {
        return ai > bi ? 1 : -1;
    }
    if (ap !== bp) {
        return ap > bp ? 1 : -1;
    }
    return 0;
}

/** 版本号 patch +1 */
export function incrementPatch(version: string): string {
    const [m, i, p] = parseVersion(version);
    return formatVersion(m, i, p + 1);
}

/** 从文件名提取版本号，如 impm-urs-v0.1.2.md → 0.1.2 */
export function extractVersionFromFileName(fileName: string): string | null {
    const m = /-v(\d+\.\d+\.\d+)/.exec(fileName);
    return m ? m[1] : null;
}

/** 校验版本号格式 */
export function isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version.replace(/^[vV]/, "").trim());
}
