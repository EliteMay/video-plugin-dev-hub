const version = document.querySelector("#version");
const network = document.querySelector("#network");
const gitStatus = document.querySelector("#gitStatus");
const diagnostics = document.querySelector("#diagnostics");
const diagnosticsText = document.querySelector("#diagnosticsText");
const updateStatus = document.querySelector("#updateStatus");
const projectList = document.querySelector("#projectList");
const projectCount = document.querySelector("#projectCount");
const projectMessage = document.querySelector("#projectMessage");
const projectName = document.querySelector("#projectName");
const repositoryUrl = document.querySelector("#repositoryUrl");
const localPath = document.querySelector("#localPath");

function projectStateText(state) {
  if (!state?.validGitRepository) return "Git Repositoryとして確認できません";
  if (!state.clean) return "PC側に未保存の変更があります（" + state.changedCount + "件）";
  return "Git Repositoryは正常です";
}

async function renderProjects() {
  const projects = await window.hub.listProjects();
  projectCount.textContent = projects.length + "件";
  projectList.replaceChildren();

  for (const project of projects) {
    const item = document.createElement("article");
    item.className = "project-item";
    const title = document.createElement("strong");
    title.textContent = project.name;
    const repo = document.createElement("span");
    repo.className = "muted";
    repo.textContent = project.repositorySlug;
    const state = document.createElement("span");
    state.className = project.gitState?.clean ? "state-ok" : "state-warn";
    state.textContent = projectStateText(project.gitState);
    item.append(title, repo, state);
    projectList.append(item);
  }
}

async function init() {
  const status = await window.hub.getStatus();
  version.textContent = "v" + status.appVersion;
  network.textContent = status.online ? "オンライン" : "オフライン";
  network.classList.toggle("good", status.online);
  gitStatus.textContent = status.gitVersion ? "● " + status.gitVersion : "● Gitが見つかりません";
  gitStatus.className = "status " + (status.gitVersion ? "ok" : "pending");
  await renderProjects();
}

document.querySelector("#projectsButton").addEventListener("click", () => {
  document.querySelector("#projectsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#chooseFolder").addEventListener("click", async () => {
  const selected = await window.hub.chooseProjectFolder();
  if (selected) localPath.value = selected;
});

document.querySelector("#addProject").addEventListener("click", async () => {
  projectMessage.textContent = "確認しています…";
  const result = await window.hub.addProject({
    name: projectName.value,
    repositoryUrl: repositoryUrl.value,
    localPath: localPath.value
  });

  if (!result.ok) {
    const messages = {
      INVALID_GITHUB_REPOSITORY_URL: "GitHub Repository URLを確認してください。",
      INVALID_LOCAL_PATH: "PCのRepositoryフォルダを選んでください。",
      ALREADY_REGISTERED: "このRepositoryはすでに登録されています。",
      NOT_GIT_REPOSITORY: "選んだフォルダはGit Repositoryとして確認できません。",
      ORIGIN_MISMATCH: "PC側RepositoryとGitHub URLが一致していません。"
    };
    projectMessage.textContent = messages[result.error] ?? "登録できませんでした。";
    return;
  }

  projectMessage.textContent = "登録しました。";
  projectName.value = "";
  repositoryUrl.value = "";
  localPath.value = "";
  await renderProjects();
});

document.querySelector("#diagnosticsButton").addEventListener("click", async () => {
  const data = await window.hub.getDiagnostics();
  diagnosticsText.textContent = JSON.stringify(data, null, 2);
  diagnostics.classList.remove("hidden");
  diagnostics.scrollIntoView({ behavior: "smooth" });
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
    available: "新しいバージョン " + state.version + " があります。",
    error: "更新確認に失敗しました。"
  };
  updateStatus.textContent = map[state.type] ?? state.type;
});

init().catch(error => {
  console.error(error);
});
