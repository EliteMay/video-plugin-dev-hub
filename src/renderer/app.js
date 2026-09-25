const version = document.querySelector("#version");
const network = document.querySelector("#network");
const diagnostics = document.querySelector("#diagnostics");
const diagnosticsText = document.querySelector("#diagnosticsText");
const updateStatus = document.querySelector("#updateStatus");

async function init() {
  const status = await window.hub.getStatus();
  version.textContent = "v" + status.appVersion;
  network.textContent = status.online ? "オンライン" : "オフライン";
  network.classList.toggle("good", status.online);
}

document.querySelector("#diagnosticsButton").addEventListener("click", async () => {
  const data = await window.hub.getDiagnostics();
  diagnosticsText.textContent = JSON.stringify(data, null, 2);
  diagnostics.classList.remove("hidden");
});

document.querySelector("#closeDiagnostics").addEventListener("click", () => {
  diagnostics.classList.add("hidden");
});

document.querySelector("#updateButton").addEventListener("click", async () => {
  updateStatus.textContent = "確認しています…";
  const result = await window.hub.checkForUpdates();
  if (!result.ok) {
    updateStatus.textContent =
      result.reason === "development" ? "開発版では更新確認を行いません。" :
      result.reason === "offline" ? "オフラインのため確認できません。" :
      "更新確認を開始できませんでした。";
  }
});

window.hub.onUpdateStatus((state) => {
  const map = {
    checking: "更新を確認しています…",
    current: "最新版です。",
    available: `新しいバージョン ${state.version} があります。`,
    error: "更新確認に失敗しました。"
  };
  updateStatus.textContent = map[state.type] ?? state.type;
});

init().catch(error => {
  console.error(error);
});
