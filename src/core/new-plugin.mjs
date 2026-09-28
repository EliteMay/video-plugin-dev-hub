import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FOUNDATION_REPOSITORY = "https://github.com/EliteMay/aviutl-plugin-foundation.git";

export const PLUGIN_PRESETS = {
  "native-filter": { pluginType: "auf2", extension: ".auf2", buildSystem: "cmake" },
  "native-input": { pluginType: "aui2", extension: ".aui2", buildSystem: "cmake" },
  "native-output": { pluginType: "auo2", extension: ".auo2", buildSystem: "cmake" },
  "native-module": { pluginType: "mod2", extension: ".mod2", buildSystem: "cmake" },
  "native-general": { pluginType: "aux2", extension: ".aux2", buildSystem: "cmake" },
  "script-animation": { pluginType: "anm2", extension: ".anm2", buildSystem: "none", foundationTemplate: "script" },
  "script-object": { pluginType: "obj2", extension: ".obj2", buildSystem: "none", foundationTemplate: "script" }
};

async function run(file, args, cwd = undefined, timeout = 120000) {
  try {
    const result = await execFileAsync(file, args, {
      cwd,
      windowsHide: true,
      timeout,
      maxBuffer: 8 * 1024 * 1024
    });
    return {
      ok: true,
      stdout: String(result.stdout ?? "").trim(),
      stderr: String(result.stderr ?? "").trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout ?? "").trim(),
      stderr: String(error?.stderr ?? "").trim(),
      message: error?.message ?? String(error)
    };
  }
}

export function validateRepositoryName(value) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 100) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return false;
  if (name === "." || name === "..") return false;
  return true;
}

export function normalizePluginId(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "aviutl2-plugin";
}

export function buildPluginManifest({ name, repositoryName, presetKey }) {
  const preset = PLUGIN_PRESETS[presetKey];
  if (!preset) throw new Error("INVALID_PLUGIN_PRESET");
  const pluginId = normalizePluginId(repositoryName);
  const artifactName = pluginId + preset.extension;
  const build = preset.buildSystem === "cmake"
    ? {
        system: "cmake",
        sourceDirectory: ".",
        buildDirectory: "build",
        configurations: ["Debug", "Release"],
        artifacts: [
          { configuration: "Debug", path: "build/Debug/" + artifactName },
          { configuration: "Release", path: "build/Release/" + artifactName }
        ]
      }
    : {
        system: "none",
        sourceDirectory: ".",
        buildDirectory: "build",
        configurations: [],
        artifacts: []
      };

  return {
    schemaVersion: 1,
    id: pluginId,
    name: String(name).trim(),
    target: {
      application: "aviutl2",
      pluginType: preset.pluginType,
      architecture: "x64",
      minimumVersion: null,
      testedVersions: []
    },
    sdk: {
      repository: "oov/aviutl2_plugin_sdk",
      commit: null
    },
    build,
    install: {
      kind: preset.buildSystem === "cmake" ? "plugin" : "script",
      subdirectory: preset.buildSystem === "cmake" ? "Plugin/" + pluginId : "Script/" + pluginId
    },
    verification: {
      roadmap: "docs/ROADMAP.md"
    }
  };
}

export function buildProjectReadme({ name, presetKey }) {
  const preset = PLUGIN_PRESETS[presetKey];
  return `# ${String(name).trim()}

AviUtl2向けPlugin / Script Projectです。

## 開発方法

このRepositoryを **Video Plugin Dev Hub** に登録し、Roadmapに沿って実装・Build・実機確認を進めます。

- Target: AviUtl2
- Type: \`${preset.pluginType}\`
- Architecture: x64
- Foundation: \`EliteMay/aviutl-plugin-foundation\`

## 現在状態

新規Projectの土台だけを生成した状態です。具体的なPlugin実装は \`docs/ROADMAP.md\` のタスクとして進めます。
`;
}

export function buildRoadmap({ presetKey }) {
  const preset = PLUGIN_PRESETS[presetKey];
  const buildTask = preset.buildSystem === "cmake"
    ? `- [ ] 最小構成のPluginを実装してDebug Buildを成功させる
  - 担当: ChatGPT
  - CMake / AviUtl2 SDKを使った最小構成を実装する
  - Debug Buildで ${preset.extension} を生成する
  - 完了条件: HubのDebug Buildが成功しArtifactを検出できる`
    : `- [ ] 最小構成のScriptを実装する
  - 担当: ChatGPT
  - AviUtl2で読み込める最小Scriptを実装する
  - 完了条件: Test EnvironmentでScriptを読み込める`;

  return `# Roadmap

- [ ] Pluginの目的と最初の機能を決める
  - 担当: User + ChatGPT
  - 実装する機能・入力・出力・対象画面を整理する
  - 完了条件: READMEまたは仕様書に最初の完成条件が記録されている

${buildTask}

- [ ] Test Environmentへ導入してAviUtl2で実機確認する
  - 担当: User
  - Hubの分離Test Environmentで読み込みと基本動作を確認する
  - 完了条件: Hubに実機確認結果と必要なEvidenceが保存されている

- [ ] Release準備を完了する
  - 担当: ChatGPT + User
  - Release Build・実機確認・READMEを最終確認する
  - 完了条件: Release Gateに必要な確認が完了している
`;
}

function buildProjectRules() {
  return `# Project Rules

1. このRepositoryがPlugin固有のコード・仕様・RoadmapのSource of Truthです。
2. 共通Foundationは \`EliteMay/aviutl-plugin-foundation\` を参照します。
3. Foundation更新でPlugin固有の \`src/\`, \`README.md\`, \`docs/ROADMAP.md\`, \`assets/\` を自動上書きしません。
4. Build成功だけで完成扱いにせず、AviUtl2実機確認を行います。
5. 破壊的なGit操作やforce pushを自動実行しません。
`;
}

export async function getGitHubCliState(commandRunner = run) {
  const version = await commandRunner("gh", ["--version"]);
  if (!version.ok) {
    return { available: false, authenticated: false, login: null, version: null };
  }

  const auth = await commandRunner("gh", ["auth", "status", "--hostname", "github.com"]);
  if (!auth.ok) {
    return {
      available: true,
      authenticated: false,
      login: null,
      version: version.stdout.split(/\r?\n/)[0] || "gh"
    };
  }

  const user = await commandRunner("gh", ["api", "user", "--jq", ".login"]);
  return {
    available: true,
    authenticated: user.ok && Boolean(user.stdout),
    login: user.ok ? user.stdout.trim() : null,
    version: version.stdout.split(/\r?\n/)[0] || "gh"
  };
}

async function hasGitIdentity(commandRunner, cwd) {
  const name = await commandRunner("git", ["config", "--get", "user.name"], cwd);
  const email = await commandRunner("git", ["config", "--get", "user.email"], cwd);
  return Boolean(name.ok && name.stdout && email.ok && email.stdout);
}

function removeGeneratedFoundationOnlyFiles(targetPath) {
  fs.rmSync(path.join(targetPath, "templates"), { recursive: true, force: true });
  fs.rmSync(path.join(targetPath, "plugin-project.example.json"), { force: true });
}

export async function createPluginProject(input, commandRunner = run) {
  const name = String(input?.name ?? "").trim();
  const repositoryName = String(input?.repositoryName ?? "").trim();
  const presetKey = String(input?.presetKey ?? "").trim();
  const visibility = input?.visibility === "private" ? "private" : "public";
  const parentDirectory = path.resolve(String(input?.parentDirectory ?? ""));

  if (!name) return { ok: false, error: "PLUGIN_NAME_REQUIRED" };
  if (!validateRepositoryName(repositoryName)) return { ok: false, error: "INVALID_REPOSITORY_NAME" };
  if (!PLUGIN_PRESETS[presetKey]) return { ok: false, error: "INVALID_PLUGIN_PRESET" };
  if (!input?.parentDirectory || !path.isAbsolute(String(input.parentDirectory))) {
    return { ok: false, error: "INVALID_PARENT_DIRECTORY" };
  }
  if (!fs.existsSync(parentDirectory) || !fs.statSync(parentDirectory).isDirectory()) {
    return { ok: false, error: "INVALID_PARENT_DIRECTORY" };
  }

  const github = await getGitHubCliState(commandRunner);
  if (!github.available) return { ok: false, error: "GITHUB_CLI_NOT_FOUND", github };
  if (!github.authenticated || !github.login) return { ok: false, error: "GITHUB_NOT_AUTHENTICATED", github };

  if (!(await hasGitIdentity(commandRunner, parentDirectory))) {
    return { ok: false, error: "GIT_IDENTITY_MISSING" };
  }

  const targetPath = path.join(parentDirectory, repositoryName);
  if (fs.existsSync(targetPath)) return { ok: false, error: "DESTINATION_ALREADY_EXISTS", targetPath };

  const remoteCheck = await commandRunner(
    "gh",
    ["repo", "view", github.login + "/" + repositoryName, "--json", "name"],
    parentDirectory
  );
  if (remoteCheck.ok) {
    return {
      ok: false,
      error: "GITHUB_REPOSITORY_EXISTS",
      repositoryUrl: "https://github.com/" + github.login + "/" + repositoryName
    };
  }

  const cloned = await commandRunner("git", ["clone", "--depth", "1", FOUNDATION_REPOSITORY, targetPath], parentDirectory);
  if (!cloned.ok) return { ok: false, error: "FOUNDATION_CLONE_FAILED", message: cloned.stderr || cloned.message };

  let remoteCreated = false;
  try {
    const foundationCommit = await commandRunner("git", ["rev-parse", "HEAD"], targetPath);
    const templateFile = path.join(targetPath, "foundation-template.json");
    const template = JSON.parse(fs.readFileSync(templateFile, "utf8"));

    fs.rmSync(path.join(targetPath, ".git"), { recursive: true, force: true });
    removeGeneratedFoundationOnlyFiles(targetPath);

    fs.writeFileSync(
      path.join(targetPath, "plugin-project.json"),
      JSON.stringify(buildPluginManifest({ name, repositoryName, presetKey }), null, 2) + "\n",
      "utf8"
    );
    fs.writeFileSync(path.join(targetPath, "README.md"), buildProjectReadme({ name, presetKey }), "utf8");
    fs.writeFileSync(path.join(targetPath, "PROJECT_RULES.md"), buildProjectRules(), "utf8");
    fs.mkdirSync(path.join(targetPath, "docs"), { recursive: true });
    fs.writeFileSync(path.join(targetPath, "docs", "ROADMAP.md"), buildRoadmap({ presetKey }), "utf8");
    fs.writeFileSync(
      path.join(targetPath, "foundation-lock.json"),
      JSON.stringify({
        schemaVersion: 1,
        repository: "EliteMay/aviutl-plugin-foundation",
        version: template.foundationVersion ?? null,
        commit: foundationCommit.ok ? foundationCommit.stdout : null,
        template: PLUGIN_PRESETS[presetKey].foundationTemplate ?? presetKey,
        generatedAt: new Date().toISOString()
      }, null, 2) + "\n",
      "utf8"
    );

    const initialized = await commandRunner("git", ["init", "-b", "main"], targetPath);
    if (!initialized.ok) return { ok: false, error: "GIT_INIT_FAILED", localPath: targetPath };

    if (!(await hasGitIdentity(commandRunner, targetPath))) {
      return { ok: false, error: "GIT_IDENTITY_MISSING", localPath: targetPath };
    }

    const added = await commandRunner("git", ["add", "-A"], targetPath);
    if (!added.ok) return { ok: false, error: "GIT_ADD_FAILED", localPath: targetPath };

    const committed = await commandRunner("git", ["commit", "-m", "Initialize AviUtl2 plugin project"], targetPath);
    if (!committed.ok) {
      return { ok: false, error: "INITIAL_COMMIT_FAILED", message: committed.stderr || committed.message, localPath: targetPath };
    }

    const created = await commandRunner(
      "gh",
      [
        "repo", "create", github.login + "/" + repositoryName,
        visibility === "private" ? "--private" : "--public",
        "--source", targetPath,
        "--remote", "origin",
        "--push"
      ],
      parentDirectory,
      180000
    );

    if (!created.ok) {
      return {
        ok: false,
        error: "GITHUB_CREATE_FAILED",
        message: created.stderr || created.message,
        localPath: targetPath,
        repositoryUrl: "https://github.com/" + github.login + "/" + repositoryName
      };
    }
    remoteCreated = true;

    return {
      ok: true,
      name,
      repositoryName,
      repositoryUrl: "https://github.com/" + github.login + "/" + repositoryName,
      repositorySlug: github.login + "/" + repositoryName,
      localPath: targetPath,
      presetKey,
      visibility,
      foundationVersion: template.foundationVersion ?? null,
      foundationCommit: foundationCommit.ok ? foundationCommit.stdout : null
    };
  } catch (error) {
    return {
      ok: false,
      error: "PLUGIN_CREATE_FAILED",
      message: error?.message ?? String(error),
      localPath: targetPath,
      remoteCreated
    };
  }
}
