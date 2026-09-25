import path from "node:path";

export function describeStatusCode(code) {
  const value = String(code ?? "").padEnd(2, " ");
  if (value === "??") return "新しく作成";
  if (value.includes("A")) return "新しく追加";
  if (value.includes("D")) return "削除";
  if (value.includes("R")) return "名前を変更";
  if (value.includes("M")) return "内容が変更";
  if (value.includes("U")) return "競合";
  return "変更あり";
}

export function looksSensitivePath(filePath) {
  const normalized = String(filePath ?? "").replace(/\\/g, "/").toLowerCase();
  const base = path.posix.basename(normalized);
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (base === "credentials.json" || base === "credentials.yml" || base === "credentials.yaml") return true;
  if (/\.(pem|p12|pfx|key)$/i.test(base)) return true;
  return false;
}

export function parsePorcelain(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const code = line.slice(0, 2);
      const rawPath = line.slice(3).trim();
      const filePath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) : rawPath;
      return {
        code,
        path: filePath,
        label: describeStatusCode(code),
        sensitive: looksSensitivePath(filePath)
      };
    });
}
