import os from "node:os";

export function redactText(value) {
  let text = String(value ?? "");
  const home = os.homedir();
  if (home) {
    text = text.split(home).join("<HOME>");
    text = text.split(home.replace(/\\/g, "/")).join("<HOME>");
  }

  text = text.replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "<REDACTED_GITHUB_TOKEN>");
  text = text.replace(/github_pat_[A-Za-z0-9_]{20,}/g, "<REDACTED_GITHUB_TOKEN>");
  text = text.replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, "<REDACTED_PRIVATE_KEY>");
  return text;
}

export function sanitizeValue(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|password|secret|credential/i.test(key)) {
        next[key] = "<REDACTED>";
      } else {
        next[key] = sanitizeValue(item);
      }
    }
    return next;
  }
  return value;
}

export function createHandoffInstructions(report) {
  const lines = [
    "Video Plugin Dev Hub 共有パック",
    "",
    "対象: " + (report.project?.name ?? "不明"),
    "Repository: " + (report.project?.repositorySlug ?? "不明"),
    "Commit: " + (report.repository?.commit ?? "不明"),
    "Branch: " + (report.repository?.branch ?? "不明"),
    "",
    "現在のタスク:",
    report.currentTask?.text ?? "未選択",
    "",
    "役割分担:",
    "- GitHub Repositoryだけで完了できるコード・文書・Roadmapの変更はChatGPT側で実行する。",
    "- Windows実機操作、AviUtl2の目視、操作感やPreview確認はUser側の確認として扱う。",
    "- 共有JSONとCurrent Repositoryから判断できる内容をUserへ不要に聞き返さない。",
    "",
    "確認結果:",
  ];

  const verification = report.verification?.tasks ?? [];
  if (!verification.length) {
    lines.push("- まだ実機確認結果はありません。");
  } else {
    for (const item of verification) {
      lines.push("- " + item.taskText);
      const results = Object.values(item.stepResults ?? {});
      if (results.length) lines.push("  結果: " + results.join(", "));
      if (item.memo) lines.push("  メモ: " + item.memo);
    }
  }

  lines.push(
    "",
    "添付内容:",
    "- plugin-dev-hub-report.json",
    "- hub-screenshot.png",
    "- screenshots/（追加済みの場合）",
    "- recent-log.txt",
    "",
    "Source code本文はこのPackへ自動コピーしていません。GitHub Repositoryを正本として確認してください。"
  );

  return redactText(lines.join("\n"));
}
