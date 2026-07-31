const transcript = document.querySelector("#transcript");
const completeCheck = document.querySelector("#complete-check");
const activationDate = document.querySelector("#activation-date");
const submit = document.querySelector("#submit-job");
const errorBox = document.querySelector("#submit-error");
const charCount = document.querySelector("#char-count");
const idle = document.querySelector("#queue-idle");
const active = document.querySelector("#queue-active");
const result = document.querySelector("#agent-result");
let currentJob = localStorage.getItem("refundAgentJob") || "";
let currentReceipt = localStorage.getItem("refundAgentReceipt") || "";
let pollTimer;
let currentOutput = null;
let quotaBlocked = false;
let quotaResetAt = 0;

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "请求失败，请稍后再试。");
    error.data = data;
    throw error;
  }
  return data;
};

const updateSubmit = () => {
  charCount.textContent = `${transcript.value.length.toLocaleString("zh-CN")} 字`;
  submit.disabled = transcript.value.trim().length < 600 || !completeCheck.checked || !activationDate.value || Boolean(currentJob || currentReceipt) || quotaBlocked;
};

transcript.addEventListener("input", updateSubmit);
completeCheck.addEventListener("change", updateSubmit);
activationDate.addEventListener("change", updateSubmit);

submit.addEventListener("click", async () => {
  errorBox.textContent = "";
  submit.disabled = true;
  submit.querySelector("span").textContent = "正在提交…";
  try {
    const job = await api("/api/refund-agent/jobs", {
      method: "POST",
      body: JSON.stringify({ transcript: transcript.value, activationDate: activationDate.value })
    });
    currentJob = job.id;
    currentReceipt = job.receipt;
    localStorage.setItem("refundAgentJob", currentJob);
    localStorage.setItem("refundAgentReceipt", currentReceipt);
    showQueue(job);
    startPolling();
  } catch (error) {
    if (error.data?.jobId) {
      currentJob = error.data.jobId;
      currentReceipt = error.data.receipt || currentReceipt;
      localStorage.setItem("refundAgentJob", currentJob);
      if (currentReceipt) localStorage.setItem("refundAgentReceipt", currentReceipt);
      showQueue(error.data);
      startPolling();
    } else {
      if (error.data?.quotaResetAt) showQuotaNotice(error.data.quotaResetAt, error.data.quotaBlockType);
      errorBox.textContent = error.message;
    }
  } finally {
    submit.querySelector("span").textContent = "提交并进入排队";
    updateSubmit();
  }
});

function showQueue(job) {
  idle.hidden = true;
  active.hidden = false;
  active.dataset.status = job.status || "queued";
  document.querySelector("#job-id").textContent = `任务编号 ${job.id}`;
  document.querySelector("#receipt-code").textContent = job.receipt || currentReceipt || "正在生成";
  document.querySelector("#queue-position").textContent = job.queuePosition || "—";
  const title = document.querySelector("#job-status-title");
  const explanation = document.querySelector("#queue-explanation");
  const fill = document.querySelector("#queue-track-fill");
  const fastMatch = job.processingMode === "reuse_review";
  const matchPercent = Math.round(Number(job.matchSimilarity || 0) * 100);
  if (job.status === "queued") {
    title.textContent = "正在排队";
    explanation.textContent = job.ahead > 0
      ? `前方还有 ${job.ahead} 份记录。上一位完成后会自动开始，你可以保存回执后关闭页面。`
      : "你是下一位，正在等待当前任务释放通道。可以保存回执后稍晚回来领取。";
    document.querySelector("#generation-stage-label").textContent = fastMatch
      ? `已匹配 ${matchPercent}% 相似案例，等待快速复核`
      : "等待进入 AI 完整分析通道";
    fill.style.width = "32%";
  } else if (job.status === "processing") {
    title.textContent = fastMatch ? "AI 正在快速复核相似案例" : "AI 正在分析完整记录";
    explanation.textContent = fastMatch
      ? `案例库匹配度 ${matchPercent}%。AI 正在核对是否适用于本案，并校正日期、阶段和法律依据。`
      : "正在定位客服最新拒绝理由、核对法律依据并生成新的退款投诉回复。生成时间较长，请耐心等待，也可以凭回执稍后领取。";
    document.querySelector("#queue-position").textContent = "1";
    document.querySelector("#generation-stage-label").textContent = processingStage(job);
    fill.style.width = "72%";
  } else if (job.status === "failed") {
    title.textContent = "本次生成未完成";
    explanation.textContent = job.error || "接口处理失败，请稍后重新提交。";
    document.querySelector("#generation-stage-label").textContent = "本次任务已停止";
    fill.style.width = "100%";
    errorBox.textContent = job.error || "本次生成未完成。";
    finishJob(false);
  } else if (job.status === "completed") {
    title.textContent = "生成完成";
    explanation.textContent = job.reuseApplied
      ? "相似案例复核适用，已按本案事实校正并形成投诉文案。"
      : "已形成一份针对客服最新回复的新文案。";
    document.querySelector("#generation-stage-label").textContent = "文案已经可以领取";
    fill.style.width = "100%";
    renderResult(job.output);
    finishJob(true);
  }
  renderEta(job);
}

function processingStage(job) {
  if (job.processingMode === "reuse_review") return "正在核对相似案例的适用条件";
  const stages = ["正在读取从头到尾的沟通记录", "正在定位客服最新拒绝理由", "正在匹配法律与运营商条款", "正在组织递进投诉策略", "正在压缩为 1950 字符以内"];
  return stages[Math.floor(Date.now() / 6500) % stages.length];
}

function formatDuration(milliseconds) {
  const minutes = Math.max(1, Math.ceil(Number(milliseconds || 0) / 60000));
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `约 ${hours} 小时${rest ? ` ${rest} 分钟` : ""}`;
}

function renderEta(job) {
  const eta = document.querySelector("#eta-primary");
  const basis = document.querySelector("#eta-basis");
  if (job.status === "completed") {
    eta.textContent = "已生成，可以立即领取";
    basis.textContent = job.reuseApplied ? "本次使用了相似案例快速复核" : "本次完成了完整 AI 分析";
    return;
  }
  if (job.status === "failed") {
    eta.textContent = "本次生成已结束";
    basis.textContent = "请保留回执，必要时联系站长查看失败原因";
    return;
  }
  const wait = Number(job.estimatedWaitMs || 0);
  const readyClock = job.estimatedReadyAt
    ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(job.estimatedReadyAt))
    : "";
  eta.textContent = `${formatDuration(wait)}完成${readyClock ? ` · 预计 ${readyClock}` : ""}`;
  basis.textContent = Number(job.averageSampleSize || 0) > 0
    ? `按最近 ${job.averageSampleSize} 份同类报告的平均耗时动态估算`
    : `同类样本正在积累，当前按 ${formatDuration(job.averageDurationMs)} 的系统基准估算`;
}

function finishJob(success) {
  clearTimeout(pollTimer);
  if (!success) {
    currentJob = "";
    currentReceipt = "";
    localStorage.removeItem("refundAgentJob");
    localStorage.removeItem("refundAgentReceipt");
    updateSubmit();
  }
}

function renderResult(output) {
  currentOutput = output;
  document.querySelector("#english-reply").textContent = output.englishReply;
  document.querySelector("#english-count").textContent = `${[...output.englishReply].length} / 1950 字符`;
  document.querySelector("#chinese-summary").textContent = output.chineseSummary;
  document.querySelector("#next-action").textContent = output.nextAction;
  document.querySelector(".english-output").hidden = output.outputType === "ombudsman_complaint";
  renderOmbudsman(output);
  result.hidden = false;
  setTimeout(() => result.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

const fieldDefinitions = {
  full_name: ["投诉人姓名", "text"],
  contact_email: ["联系邮箱", "email"],
  phone_number: ["联系电话", "tel"],
  service_number: ["争议手机号码", "text"],
  complaint_reference: ["运营商投诉编号", "text"],
  original_complaint_date: ["首次正式投诉日期", "date"],
  final_response_date: ["最终回复日期", "date"],
  deactivation_date: ["号码停用日期", "date"],
  remaining_paid_balance: ["要求退还的付费余额", "text"]
};

function renderOmbudsman(output) {
  const builder = document.querySelector("#ombudsman-builder");
  if (output.outputType !== "ombudsman_complaint") {
    builder.hidden = true;
    return;
  }
  builder.hidden = false;
  document.querySelector("#ombudsman-eligibility").textContent = output.ombudsman.eligibilityReason;
  const container = document.querySelector("#missing-fields");
  container.innerHTML = output.ombudsman.missingFields.map((key) => {
    const [label, type] = fieldDefinitions[key] || [key, "text"];
    return `<label>${label}<input type="${type}" data-ombudsman-field="${key}" autocomplete="off"></label>`;
  }).join("");
  container.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateOmbudsmanDraft));
  updateOmbudsmanDraft();
}

function updateOmbudsmanDraft() {
  if (!currentOutput?.ombudsman) return;
  const values = { activation_date: activationDate.value };
  document.querySelectorAll("[data-ombudsman-field]").forEach((input) => { values[input.dataset.ombudsmanField] = input.value.trim(); });
  const replace = (template) => String(template || "").replace(/\{\{([a-z_]+)\}\}/g, (all, key) => values[key] || all);
  const subject = replace(currentOutput.ombudsman.subjectTemplate);
  const body = replace(currentOutput.ombudsman.bodyTemplate);
  document.querySelector("#ombudsman-subject").value = subject;
  document.querySelector("#ombudsman-body").value = body;
  const bodyLength = [...body].length;
  document.querySelector("#ombudsman-count").textContent = `${bodyLength} / 1950 字符`;
  const unresolved = (subject + body).match(/\{\{[a-z_]+\}\}/g) || [];
  const copyButton = document.querySelector("#copy-ombudsman");
  const emailLink = document.querySelector("#open-email");
  const tooLong = bodyLength > 1950;
  copyButton.disabled = unresolved.length > 0 || tooLong;
  emailLink.setAttribute("aria-disabled", unresolved.length > 0 || tooLong ? "true" : "false");
  emailLink.href = unresolved.length || tooLong ? "#" : `mailto:${encodeURIComponent(currentOutput.ombudsman.toEmail || "enquiry@commsombudsman.org")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.querySelector("#ombudsman-error").textContent = tooLong
    ? `补全后的正文为 ${bodyLength} 个字符，请重新生成更短版本。`
    : unresolved.length ? "请先填写上方全部必要资料，完成后即可复制或打开邮箱。" : "";
}

async function pollJob() {
  if (!currentJob && !currentReceipt) return;
  try {
    const job = currentReceipt
      ? await api("/api/refund-agent/receipts/lookup", {
          method: "POST",
          body: JSON.stringify({ receipt: currentReceipt })
        })
      : await api(`/api/refund-agent/jobs/${currentJob}`);
    currentJob = job.id || currentJob;
    currentReceipt = job.receipt || currentReceipt;
    if (currentJob) localStorage.setItem("refundAgentJob", currentJob);
    if (currentReceipt) localStorage.setItem("refundAgentReceipt", currentReceipt);
    showQueue(job);
    if (["queued", "processing"].includes(job.status)) pollTimer = setTimeout(pollJob, 1800);
  } catch (error) {
    currentJob = "";
    currentReceipt = "";
    localStorage.removeItem("refundAgentJob");
    localStorage.removeItem("refundAgentReceipt");
    active.hidden = true;
    idle.hidden = false;
    errorBox.textContent = error.message.includes("不存在或已过期") ? "" : error.message;
    updateSubmit();
  }
}

function startPolling() {
  clearTimeout(pollTimer);
  pollJob();
}

async function refreshHealth() {
  try {
    const health = await api("/api/refund-agent/health");
    showQuotaNotice(health.quotaBlocked ? health.quotaResetAt : 0, health.quotaBlockType);
    document.querySelector("#service-state").textContent = health.quotaBlocked
      ? "额度恢复中"
      : health.enabled && health.configured && !health.paused ? "开放" : "暂停";
    document.querySelector("#service-processing").textContent = health.processing ? "1 份" : "0 份";
    document.querySelector("#service-queued").textContent = `${health.queued} 人`;
    document.querySelector("#service-average").textContent = health.averageSampleSize > 0
      ? formatDuration(health.averageDurationMs)
      : `${formatDuration(health.averageDurationMs)}（基准）`;
  } catch {
    document.querySelector("#service-state").textContent = "离线";
  }
}

function showQuotaNotice(resetAt, blockType = "five_hour") {
  quotaResetAt = Number(resetAt) || 0;
  quotaBlocked = quotaResetAt > Date.now();
  const notice = document.querySelector("#quota-notice");
  notice.hidden = !quotaBlocked;
  if (quotaBlocked) {
    document.querySelector("#quota-notice-title").textContent = blockType === "weekly"
      ? "周额度窗口正在恢复"
      : "5 小时额度窗口正在恢复";
    const remainingMinutes = Math.max(1, Math.ceil((quotaResetAt - Date.now()) / 60000));
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    const remaining = [hours ? `${hours} 小时` : "", minutes ? `${minutes} 分钟` : ""].filter(Boolean).join(" ");
    const clock = new Intl.DateTimeFormat("zh-CN", {
      ...(remainingMinutes >= 24 * 60 ? { month: "numeric", day: "numeric" } : {}),
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(quotaResetAt));
    document.querySelector("#quota-reset-time").textContent = `约 ${remaining}后 · ${clock} 恢复`;
  }
  updateSubmit();
}

const receiptForm = document.querySelector("#receipt-form");
const receiptInput = document.querySelector("#receipt-input");
receiptInput.addEventListener("input", () => {
  receiptInput.value = receiptInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 23);
});
receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const receiptError = document.querySelector("#receipt-error");
  receiptError.textContent = "";
  const button = receiptForm.querySelector("button");
  button.disabled = true;
  button.textContent = "查询中…";
  try {
    const job = await api("/api/refund-agent/receipts/lookup", {
      method: "POST",
      body: JSON.stringify({ receipt: receiptInput.value })
    });
    currentJob = job.id;
    currentReceipt = job.receipt;
    localStorage.setItem("refundAgentJob", currentJob);
    localStorage.setItem("refundAgentReceipt", currentReceipt);
    receiptInput.value = currentReceipt;
    result.hidden = true;
    showQueue(job);
    if (["queued", "processing"].includes(job.status)) startPolling();
    setTimeout(() => active.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    updateSubmit();
  } catch (error) {
    receiptError.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "查询并领取 →";
  }
});

document.querySelector("#copy-receipt").addEventListener("click", async () => {
  const value = document.querySelector("#receipt-code").textContent.trim();
  if (!value.startsWith("RF-")) return;
  await navigator.clipboard.writeText(value);
  const toast = document.querySelector("#agent-toast");
  toast.textContent = "回执编号已复制，请妥善保存";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
});

document.querySelector("#copy-english").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#english-reply").textContent);
  const toast = document.querySelector("#agent-toast");
  toast.textContent = "投诉文案已复制，现在可打开投诉页粘贴";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
});

document.querySelector("#copy-refund-follow").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#refund-follow-script").textContent);
  const toast = document.querySelector("#agent-toast");
  toast.textContent = "两天后追问文案已复制";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
});

document.querySelector("#copy-ombudsman").addEventListener("click", async () => {
  if (document.querySelector("#copy-ombudsman").disabled) return;
  const subject = document.querySelector("#ombudsman-subject").value;
  const body = document.querySelector("#ombudsman-body").value;
  await navigator.clipboard.writeText(`To: enquiry@commsombudsman.org\nSubject: ${subject}\n\n${body}`);
  const toast = document.querySelector("#agent-toast");
  toast.textContent = "完整监察公署投诉邮件已复制";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
});

document.querySelector("#new-round").addEventListener("click", () => {
  currentJob = "";
  currentReceipt = "";
  localStorage.removeItem("refundAgentJob");
  localStorage.removeItem("refundAgentReceipt");
  result.hidden = true;
  active.hidden = true;
  idle.hidden = false;
  transcript.value = "";
  activationDate.value = "";
  completeCheck.checked = false;
  receiptInput.value = "";
  updateSubmit();
  window.scrollTo({ top: document.querySelector(".agent-workspace").offsetTop - 20, behavior: "smooth" });
});

updateSubmit();
refreshHealth();
setInterval(refreshHealth, 5000);
if (currentJob || currentReceipt) startPolling();
