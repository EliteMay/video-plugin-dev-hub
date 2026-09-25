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
const aviutlStatus = document.querySelector("#aviutlStatus");
const aviutlPathText = document.querySelector("#aviutlPathText");
const cmakeEnvironment = document.querySelector("#cmakeEnvironment");
const cppEnvironment = document.querySelector("#cppEnvironment");
const sdkEnvironment = document.querySelector("#sdkEnvironment");
const aviutlEnvironment = document.querySelector("#aviutlEnvironment");
const environmentMessage = document.querySelector("#environmentMessage");

function errorText(error) {
  const messages = {
    INVALID_GITHUB_REPOSITORY_URL: "GitHub Repository URLを確認してください。",
    INVALID_LOCAL_PATH: "PCのRepositoryフォルダを選んでください。",
    INVALID_DESTINATION: "Clone先フォルダを確認してください。",
    DESTINATION_NOT_EMPTY: "Clone先は空のフォルダを選んでください。",
    ALREADY_REGISTERED: "このRepositoryはすでに登録されています。",
    NOT_GIT_REPOSITORY: "選んだフォルダはGit Repositoryとして確認できません。",
    ORIGIN_MISMATCH: "PC側Repositoryと登録したGitHub URLが一致していません。",
    BRANCH_MISMATCH: "現在のBranchが登録時のBranchと違います。",
    WORKTREE_DIRTY: "PC側に未保存の変更があるため、安全同期を停止しました。",
    SYNC_FAILED: "GitHubとの安全同期に失敗しました。",
    CLONE_FAILED: "GitHubからCloneできませんでした。",
    NOTHING_TO_SAVE: "GitHubへ保存する変更はありません。",
    SENSITIVE_FILES: "秘密情報の可能性があるファイルを検出したため保存を停止しました。",
    GIT_IDENTITY_MISSING: "Gitの名前またはメール設定が見つからないためCommitできません。",
    COMMIT_MESSAGE_REQUIRED: "保存内容の説明を入力してください。",
    COMMIT_FAILED: "PC側へ変更履歴を保存できませんでした。",
    MERGE_CONFLICT: "GitHub側の変更と競合しました。PC側のCommitは保持しています。",
    PUSH_FAILED: "PC側へCommitしましたが、GitHubへの送信に失敗しました。",
    PROJECT_NOT_FOUND: "Projectが見つかりません。"
  };
  return messages[error] ?? "操作を完了できませんでした。";
}

function projectStateText(state) {
  if (!state?.validGitRepository) return "Git Repositoryとして確認できません";
  if (!state.clean) return "PC側に未保存の変更があります（" + state.changedCount + "件）";
  return "Git Repositoryは正常です";
}

function clearProjectForm() {
  projectName.value = "";
  repositoryUrl.value = "";
  localPath.value = "";
}

function actionButton(label, handler, kind = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = kind;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function showChanges(project) {
  const result = await window.hub.previewSave(project.id);
  if (!result.ok && result.error !== "SENSITIVE_FILES") {
    projectMessage.textContent = errorText(result.error);
    return null;
  }

  const lines = (result.changes ?? []).map(item => item.label + "  " + item.path);
  const sensitive = (result.sensitive ?? []).map(item => item.path);
  let message = lines.length ? lines.join("\n") : "変更はありません。";
  if (sensitive.length) {
    message += "\n\n保存停止対象:\n" + sensitive.join("\n");
  }
  window.alert(message);
  return result;
}

async function saveProject(project) {
  const preview = await window.hub.previewSave(project.id);
  if (!preview.ok) {
    projectMessage.textContent = errorText(preview.error);
    if (preview.error === "SENSITIVE_FILES") {
      const files = (preview.sensitive ?? []).map(item => item.path).join("\n");
      window.alert("GitHubへ保存しません。\n\n秘密情報の可能性があるファイル:\n" + files);
    }
    return;
  }

  const summary = preview.changes.map(item => item.label + "  " + item.path).join("\n");
  const confirmed = window.confirm("次の変更をGitHubへ保存します。\n\n" + summary + "\n\n続けますか？");
  if (!confirmed) return;

  const message = window.prompt("保存内容の説明を入力してください。", "Update plugin development files");
  if (!message?.trim()) {
    projectMessage.textContent = "GitHubへの保存をキャンセルしました。";
    return;
  }

  projectMessage.textContent = project.name + " をGitHubへ保存しています…";
  const result = await window.hub.saveProject(project.id, message.trim());
  projectMessage.textContent = result.ok
    ? project.name + " をGitHubへ保存しました。"
    : errorText(result.error);
  await renderProjects();
}

async function syncProject(project) {
  projectMessage.textContent = project.name + " を安全に同期しています…";
  const result = await window.hub.syncProject(project.id);
  projectMessage.textContent = result.ok
    ? project.name + " を最新状態にしました。"
    : errorText(result.error);
  await renderProjects();
}

async function renderProjects() {
  const projects = await window.hub.listProjects();
  projectCount.textContent = projects.length + "件";
  projectList.replaceChildren();

  if (projects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "まだPlugin Repositoryは登録されていません。";
    projectList.append(empty);
    return;
  }

  for (const project of projects) {
    const item = document.createElement("article");
    item.className = "project-item";

    const info = document.createElement("div");
    info.className = "project-info";
    const title = document.createElement("strong");
    title.textContent = project.name;
    const repo = document.createElement("span");
    repo.className = "muted";
    repo.textContent = project.repositorySlug;
    const branch = document.createElement("span");
    branch.className = "project-meta";
    branch.textContent = "Branch: " + (project.gitState?.branch || project.defaultBranch || "不明");

    const pluginMeta = document.createElement("span");
    pluginMeta.className = "project-meta";
    if (project.manifestSummary?.valid) {
      const sdk = project.manifestSummary.sdkCommit
        ? " / SDK " + project.manifestSummary.sdkCommit.slice(0, 8)
        : "";
      pluginMeta.textContent =
        "Type: " + (project.manifestSummary.pluginType ?? "不明") +
        " / " + (project.manifestSummary.architecture ?? "不明") + sdk;
    } else {
      pluginMeta.textContent = project.manifestSummary?.found
        ? "plugin-project.json に問題があります"
        : "plugin-project.json 未作成";
    }

    const taskSelect = document.createElement("select");
    taskSelect.className = "task-select";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = project.roadmapSummary?.found
      ? "今やるタスクを選択"
      : "Roadmapが見つかりません";
    taskSelect.append(placeholder);

    if (project.roadmapSummary?.found) {
      const roadmapResult = await window.hub.getRoadmap(project.id);
      for (const task of roadmapResult.roadmap?.tasks ?? []) {
        if (task.completed) continue;
        const option = document.createElement("option");
        option.value = task.key;
        option.textContent = task.text;
        option.selected = task.key === (roadmapResult.currentTaskKey ?? project.currentTask?.key);
        taskSelect.append(option);
      }
      taskSelect.addEventListener("change", async () => {
        if (!taskSelect.value) return;
        const result = await window.hub.setCurrentTask(project.id, taskSelect.value);
        projectMessage.textContent = result.ok
          ? project.name + " の今やるタスクを変更しました。"
          : "タスクを選択できませんでした。";
        await renderProjects();
      });
    } else {
      taskSelect.disabled = true;
    }

    const trustState = document.createElement("span");
    trustState.className = project.trusted ? "state-ok" : "state-warn";
    trustState.textContent = project.trusted
      ? "実行許可: 信頼済み"
      : "実行許可: 未信頼（Build/実行は停止）";

    const compatibility = document.createElement("span");
    const compatStatus = project.compatibility?.status ?? "unknown";
    compatibility.className = compatStatus === "ready-for-runtime-test"
      ? "state-ok"
      : compatStatus === "blocked"
        ? "state-error"
        : "state-warn";
    const compatText = {
      "ready-for-runtime-test": "互換性: 実機確認へ進めます",
      "needs-version-check": "互換性: AviUtl2 Version確認が必要",
      "blocked": "互換性: 現在の設定では対象外",
      "unknown": "互換性: 未確認"
    };
    compatibility.textContent = compatText[compatStatus] ?? "互換性: 未確認";

    info.append(title, repo, branch, pluginMeta, trustState, compatibility, taskSelect);

    const state = document.createElement("div");
    state.className = "project-state";
    const stateText = document.createElement("span");
    stateText.className = project.gitState?.clean ? "state-ok" : "state-warn";
    stateText.textContent = projectStateText(project.gitState);
    const pathText = document.createElement("span");
    pathText.className = "project-meta";
    pathText.textContent = project.localPath;
    state.append(stateText, pathText);

    const actions = document.createElement("div");
    actions.className = "project-actions";
    const trustButton = actionButton(
      project.trusted ? "信頼を解除" : "このRepositoryを信頼する",
      async () => {
        if (!project.trusted) {
          const confirmed = window.confirm(
            "このRepositoryのBuildやPlugin実行を許可します。\n\n" +
            project.repositorySlug +
            "\n\n内容を確認したRepositoryだけ信頼してください。"
          );
          if (!confirmed) return;
        }
        const result = await window.hub.setProjectTrust(project.id, !project.trusted);
        projectMessage.textContent = result.ok
          ? (result.trusted ? "Repositoryを信頼済みにしました。" : "Repositoryの信頼を解除しました。")
          : "信頼設定を変更できませんでした。";
        await renderProjects();
      }
    );

    actions.append(
      actionButton("安全に同期", () => syncProject(project)),
      actionButton("変更を見る", () => showChanges(project)),
      trustButton,
      actionButton("GitHubに保存", () => saveProject(project), "primary")
    );

    item.append(info, state, actions);
    projectList.append(item);
  }
}

async function renderEnvironment() {
  environmentMessage.textContent = "開発環境を確認しています…";
  const environment = await window.hub.getEnvironment();

  const aviutl = environment.aviutl2;
  aviutlStatus.textContent = aviutl.available ? "● 検出済み" : "● 見つかりません";
  aviutlStatus.className = "status " + (aviutl.available ? "ok" : "pending");
  aviutlPathText.textContent = aviutl.available ? aviutl.path : "AviUtl2.exeを選択してください。";
  aviutlEnvironment.textContent = aviutl.available ? "利用可能" : "未設定";
  aviutlEnvironment.className = aviutl.available ? "env-ok" : "env-warn";

  cmakeEnvironment.textContent = environment.cmake.available
    ? "利用可能 " + (environment.cmake.version ?? "")
    : "見つかりません";
  cmakeEnvironment.className = environment.cmake.available ? "env-ok" : "env-warn";

  cppEnvironment.textContent = environment.visualCpp.available
    ? "利用可能 " + (environment.visualCpp.version ?? "")
    : "見つかりません";
  cppEnvironment.className = environment.visualCpp.available ? "env-ok" : "env-warn";

  sdkEnvironment.textContent = environment.windowsSdk.available
    ? "利用可能 " + (environment.windowsSdk.version ?? "")
    : "見つかりません";
  sdkEnvironment.className = environment.windowsSdk.available ? "env-ok" : "env-warn";

  const missing = [];
  if (!aviutl.available) missing.push("AviUtl2");
  if (!environment.cmake.available) missing.push("CMake");
  if (!environment.visualCpp.available) missing.push("Visual C++ Build Tools");
  if (!environment.windowsSdk.available) missing.push("Windows SDK");

  environmentMessage.textContent = missing.length
    ? "不足または未設定: " + missing.join(" / ")
    : "AviUtl2 Plugin開発に必要な基本環境を確認できました。";
}

async function init() {
  const status = await window.hub.getStatus();
  version.textContent = "v" + status.appVersion;
  network.textContent = status.online ? "オンライン" : "オフライン";
  network.classList.toggle("good", status.online);
  gitStatus.textContent = status.gitVersion ? "● " + status.gitVersion : "● Gitが見つかりません";
  gitStatus.className = "status " + (status.gitVersion ? "ok" : "pending");
  await Promise.all([renderProjects(), renderEnvironment()]);
}

document.querySelector("#refreshEnvironment").addEventListener("click", async () => {
  await renderEnvironment();
});

document.querySelector("#chooseAviUtl2").addEventListener("click", async () => {
  const result = await window.hub.chooseAviUtl2();
  if (result?.ok) {
    environmentMessage.textContent = "AviUtl2.exeを保存しました。";
    await renderEnvironment();
  }
});

document.querySelector("#projectsButton").addEventListener("click", () => {
  document.querySelector("#projectsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#chooseFolder").addEventListener("click", async () => {
  const selected = await window.hub.chooseProjectFolder();
  if (selected) localPath.value = selected;
});

document.querySelector("#addProject").addEventListener("click", async () => {
  projectMessage.textContent = "Repositoryを確認しています…";
  const result = await window.hub.addProject({
    name: projectName.value,
    repositoryUrl: repositoryUrl.value,
    localPath: localPath.value
  });

  if (!result.ok) {
    projectMessage.textContent = errorText(result.error);
    return;
  }

  projectMessage.textContent = "既存Repositoryを登録しました。";
  clearProjectForm();
  await renderProjects();
});

document.querySelector("#cloneProject").addEventListener("click", async () => {
  projectMessage.textContent = "GitHubからCloneしています…";
  const result = await window.hub.cloneProject({
    name: projectName.value,
    repositoryUrl: repositoryUrl.value,
    localPath: localPath.value
  });

  if (!result.ok) {
    projectMessage.textContent = errorText(result.error);
    return;
  }

  projectMessage.textContent = "Cloneして登録しました。";
  clearProjectForm();
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
