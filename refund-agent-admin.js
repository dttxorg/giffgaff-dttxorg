const loginView = document.querySelector("#login-view");
const adminView = document.querySelector("#admin-view");
const configForm = document.querySelector("#config-form");
let currentConfig = {};

const api = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败。");
  return data;
};

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = document.querySelector("#login-error");
  errorBox.textContent = "";
  try {
    await api("/api/refund-agent/admin/login", { method: "POST", body: JSON.stringify({ password: document.querySelector("#admin-password").value }) });
    await openAdmin();
  } catch (error) {
    errorBox.textContent = error.message;
  }
});

async function openAdmin() {
  try {
    currentConfig = await api("/api/refund-agent/admin/config");
    loginView.hidden = true;
    adminView.hidden = false;
    fillConfig(currentConfig);
    await loadJobs();
  } catch {
    loginView.hidden = false;
    adminView.hidden = true;
  }
}

document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-panel]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".admin-panel").forEach((panel) => panel.classList.remove("active"));
    document.querySelector(`#panel-${button.dataset.panel}`).classList.add("active");
    document.querySelector("#panel-title").textContent = button.dataset.panel === "config" ? "AI接口设置" : "队列总览";
  });
});

function fillConfig(data) {
  document.querySelector("#base-url").value = data.baseUrl || "https://api.openai.com/v1";
  document.querySelector("#api-mode").value = data.apiMode || "auto";
  document.querySelector("#model").value = data.model || "";
  document.querySelector("#max-output-tokens").value = data.maxOutputTokens || 65536;
  document.querySelector("#retries").value = data.retries ?? 2;
  document.querySelector("#enabled").checked = Boolean(data.enabled);
  document.querySelector("#api-key-state").textContent = data.apiKeySet ? `已保存：${data.apiKeyMasked}` : "尚未保存";
}

const configPayload = () => ({
  baseUrl: document.querySelector("#base-url").value.trim(),
  apiMode: document.querySelector("#api-mode").value,
  apiKey: document.querySelector("#api-key").value.trim(),
  model: document.querySelector("#model").value.trim(),
  maxOutputTokens: Number(document.querySelector("#max-output-tokens").value),
  retries: Number(document.querySelector("#retries").value),
  enabled: document.querySelector("#enabled").checked,
  paused: Boolean(currentConfig.paused)
});

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#config-message");
  message.textContent = "正在保存…";
  try {
    await api("/api/refund-agent/admin/config", { method: "PUT", body: JSON.stringify(configPayload()) });
    currentConfig = await api("/api/refund-agent/admin/config");
    fillConfig(currentConfig);
    document.querySelector("#api-key").value = "";
    message.textContent = "设置已加密保存，队列将使用新配置。";
    await loadJobs();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#test-config").addEventListener("click", async () => {
  const message = document.querySelector("#config-message");
  message.textContent = "正在连接接口…";
  try {
    const data = await api("/api/refund-agent/admin/config/test", { method: "POST", body: JSON.stringify(configPayload()) });
    message.textContent = data.message;
  } catch (error) {
    message.textContent = error.message;
  }
});

async function loadJobs() {
  const data = await api("/api/refund-agent/admin/jobs");
  const h = data.health;
  document.querySelector("#metric-processing").textContent = h.processing;
  document.querySelector("#metric-queued").textContent = h.queued;
  document.querySelector("#metric-completed").textContent = h.completed;
  document.querySelector("#metric-failed").textContent = h.failed;
  document.querySelector("#metric-experience").textContent = h.experienceCount || 0;
  document.querySelector("#metric-library").textContent = data.librarySize || 0;
  document.querySelector("#metric-library-note").textContent = `相似度≥${Math.round((data.reuseThreshold || 0.9) * 100)}%快速复核`;
  document.querySelector("#channel-state").textContent = h.paused ? "已暂停" : h.enabled && h.configured ? "运行中 · 单通道" : "等待接口配置";
  document.querySelector("#toggle-pause").textContent = h.paused ? "恢复队列" : "暂停队列";
  currentConfig.paused = h.paused;
  const list = document.querySelector("#job-list");
  list.innerHTML = data.jobs.length ? data.jobs.map((job) => `
    <tr>
      <td><span class="status ${job.status}">${statusLabel(job.status)}</span></td>
      <td class="job-meta">
        <code>${escapeHtml(job.receipt || "—")}</code>
        <span class="${job.processingMode === "reuse_review" ? "reuse" : ""}">${modeLabel(job)}</span>
        ${job.durationMs ? `<small>耗时 ${formatDuration(job.durationMs)}</small>` : ""}
      </td>
      <td>${new Date(job.createdAt).toLocaleString("zh-CN", { hour12: false })}</td>
      <td class="preview">${escapeHtml(job.error || job.preview)}</td>
      <td>${job.queuePosition || "—"}</td>
      <td>${job.status === "failed" ? `<button class="row-action" data-retry="${job.id}">重试</button>` : ""} ${job.status !== "processing" ? `<button class="row-action" data-delete="${job.id}">删除</button>` : ""}</td>
    </tr>`).join("") : `<tr><td colspan="6">暂无任务</td></tr>`;
  list.querySelectorAll("[data-retry]").forEach((button) => button.addEventListener("click", async () => {
    await api(`/api/refund-agent/admin/jobs/${button.dataset.retry}/retry`, { method: "POST" }); await loadJobs();
  }));
  list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("删除此任务及完整投诉记录？")) return;
    await api(`/api/refund-agent/admin/jobs/${button.dataset.delete}`, { method: "DELETE" }); await loadJobs();
  }));
}

document.querySelector("#toggle-pause").addEventListener("click", async () => {
  currentConfig = await api("/api/refund-agent/admin/config");
  await api("/api/refund-agent/admin/config", {
    method: "PUT",
    body: JSON.stringify({ ...currentConfig, paused: !currentConfig.paused, apiKey: "" })
  });
  await loadJobs();
});
document.querySelector("#refresh-jobs").addEventListener("click", loadJobs);
document.querySelector("#logout").addEventListener("click", async () => {
  await api("/api/refund-agent/admin/logout", { method: "POST" });
  location.reload();
});

function statusLabel(status) { return ({ queued: "排队中", processing: "生成中", completed: "已完成", failed: "失败" })[status] || status; }
function modeLabel(job) {
  if (job.processingMode !== "reuse_review") return "完整生成";
  const similarity = Math.round(Number(job.matchSimilarity || 0) * 100);
  if (job.status === "completed" && job.reuseApplied) return `案例复用成功 · ${similarity}%`;
  return `相似案例快审 · ${similarity}%`;
}
function formatDuration(milliseconds) {
  const seconds = Math.max(1, Math.round(Number(milliseconds || 0) / 1000));
  return seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

openAdmin();
setInterval(() => { if (!adminView.hidden) loadJobs().catch(() => {}); }, 5000);
