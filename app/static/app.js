// ---------- Auth ----------
let TOKEN = localStorage.getItem("token");
let isRegister = false;

const $ = (id) => document.getElementById(id);

function showAuth() { $("authScreen").classList.remove("hidden"); }
function hideAuth() { $("authScreen").classList.add("hidden"); }

const origFetch = window.fetch;
window.fetch = function(url, opts = {}) {
  if (typeof url === "string" && url.startsWith("/api/") && TOKEN) {
    opts.headers = opts.headers || {};
    if (opts.headers instanceof Headers) {
      opts.headers.set("Authorization", "Bearer " + TOKEN);
    } else {
      opts.headers["Authorization"] = "Bearer " + TOKEN;
    }
  }
  return origFetch(url, opts);
};

async function checkAuth() {
  if (!TOKEN) { showAuth(); return; }
  try {
    const r = await fetch("/api/auth/me");
    if (!r.ok) throw new Error();
    const user = await r.json();
    hideAuth();
    if (user.is_admin) {
      const link = $("adminLink");
      if (link) link.style.display = "block";
    }
    loadConversations();
  } catch {
    TOKEN = null;
    localStorage.removeItem("token");
    showAuth();
  }
}

$("authToggle").onclick = (e) => {
  e.preventDefault();
  isRegister = !isRegister;
  $("authTitle").textContent = isRegister ? "📝 ثبت‌نام" : "🔐 ورود به حساب";
  $("authEmail").style.display = isRegister ? "block" : "none";
  $("authSubmit").textContent = isRegister ? "ثبت‌نام" : "ورود";
  $("authToggleText").textContent = isRegister ? "حساب داری؟" : "حساب نداری؟";
  $("authToggle").textContent = isRegister ? "وارد شو" : "ثبت‌نام کن";
};

$("authSubmit").onclick = async () => {
  const username = $("authUsername").value.trim();
  const password = $("authPassword").value;
  const email = $("authEmail").value.trim();
  const err = $("authError");
  err.classList.remove("show");

  if (!username || !password) {
    err.textContent = "نام کاربری و رمز عبور الزامی است";
    err.classList.add("show");
    return;
  }
  if (isRegister && !email) {
    err.textContent = "ایمیل الزامی است";
    err.classList.add("show");
    return;
  }

  try {
    let r;
    if (isRegister) {
      r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
    } else {
      const fd = new FormData();
      fd.append("username", username);
      fd.append("password", password);
      r = await fetch("/api/auth/login", { method: "POST", body: fd });
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "خطا در ورود");
    TOKEN = data.access_token;
    localStorage.setItem("token", TOKEN);
    hideAuth();
    $("chat").innerHTML = "";
    checkAuth();
  } catch (e) {
    err.textContent = e.message;
    err.classList.add("show");
  }
};

function logout() {
  TOKEN = null;
  localStorage.removeItem("token");
  $("chat").innerHTML = "";
  $("convList").innerHTML = "";
  $("adminLink").style.display = "none";
  showAuth();
}
$("logoutBtn").onclick = logout;

// ---------- Theme ----------
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
$("themeToggle").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const nxt = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nxt);
  localStorage.setItem("theme", nxt);
};

// ---------- Sidebar ----------
$("menuBtn").onclick = () => $("sidebar").classList.toggle("hidden");

// ---------- Conversations ----------
let currentConvId = null;

async function loadConversations() {
  const list = await fetch("/api/chat/conversations").then(r => r.json());
  const el = $("convList");
  el.innerHTML = "";
  list.forEach(c => {
    const d = document.createElement("div");
    d.className = "conv-item" + (c.id === currentConvId ? " active" : "");
    d.innerHTML = `<span>${escapeHtml(c.title)}</span><span class="del" data-id="${c.id}">✕</span>`;
    d.onclick = (e) => {
      if (e.target.classList.contains("del")) return deleteConv(c.id);
      openConversation(c.id);
    };
    el.appendChild(d);
  });
}

async function deleteConv(id) {
  await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
  if (id === currentConvId) {
    currentConvId = null;
    $("chat").innerHTML = "";
  }
  loadConversations();
}

async function openConversation(id) {
  currentConvId = id;
  const msgs = await fetch(`/api/chat/conversations/${id}/messages`).then(r => r.json());
  $("chat").innerHTML = "";
  msgs.forEach(m => addMessage(m.role, m.content));
  loadConversations();
  $("sidebar").classList.add("hidden");
}

$("newChat").onclick = () => {
  currentConvId = null;
  $("chat").innerHTML = "";
  loadConversations();
};

// ---------- Messages ----------
function addMessage(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  d.innerHTML = renderMarkdown(text);
  $("chat").appendChild(d);
  $("chat").scrollTop = $("chat").scrollHeight;
}

function renderMarkdown(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  return safe;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Send ----------
async function send() {
  const text = $("input").value.trim();
  if (!text && attachedFiles.length === 0) return;

  addMessage("user", text + (attachedFiles.length ? `\n📎 ${attachedFiles.length} فایل` : ""));
  $("input").value = "";
  autoResize();

  const btn = $("sendBtn");
  btn.disabled = true;
  $("status").textContent = "در حال فکر کردن...";

  try {
    const st = await fetch(`/api/chat/agent-state?q=${encodeURIComponent(text)}`).then(r => r.json());
    $("agentSteps").textContent = st.steps.join("\n");

    const r = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: currentConvId,
        message: text,
        file_ids: attachedFiles.map(f => f.id),
      }),
    });
    const data = await r.json();
    currentConvId = data.conversation_id;
    addMessage("assistant", data.reply);
    speak(data.reply);
    attachedFiles = [];
    renderAttached();
    loadConversations();
  } catch (e) {
    addMessage("assistant", "❌ خطا: " + e.message);
  } finally {
    btn.disabled = false;
    $("status").textContent = "آماده";
  }
}

$("sendBtn").onclick = send;
$("input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

function autoResize() {
  const t = $("input");
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, 200) + "px";
}
$("input").addEventListener("input", autoResize);

// ---------- Files ----------
let attachedFiles = [];
$("fileBtn").onclick = () => $("fileInput").click();
$("fileInput").onchange = async (e) => {
  for (const f of e.target.files) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await fetch("/api/files/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (data.id) attachedFiles.push(data);
    } catch (err) { console.error(err); }
  }
  e.target.value = "";
  renderAttached();
};

function renderAttached() {
  const el = $("attached");
  el.innerHTML = "";
  attachedFiles.forEach((f, i) => {
    const c = document.createElement("div");
    c.className = "chip";
    c.innerHTML = `📎 ${escapeHtml(f.filename)} <button data-i="${i}">✕</button>`;
    c.querySelector("button").onclick = () => {
      attachedFiles.splice(i, 1);
      renderAttached();
    };
    el.appendChild(c);
  });
}

// ---------- Voice (Speech-to-Text) ----------
let recognition = null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  recognition = new SR();
  recognition.lang = "fa-IR";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (e) => {
    let txt = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      txt += e.results[i][0].transcript;
    }
    $("input").value = txt;
    autoResize();
  };
  recognition.onend = () => $("micBtn").classList.remove("recording");
  recognition.onerror = () => $("micBtn").classList.remove("recording");
}

$("micBtn").onclick = () => {
  if (!recognition) {
    alert("مرورگر شما از ضبط صدا پشتیبانی نمی‌کند. از Chrome استفاده کن.");
    return;
  }
  if ($("micBtn").classList.contains("recording")) {
    recognition.stop();
  } else {
    recognition.start();
    $("micBtn").classList.add("recording");
  }
};

// ---------- Voice (Text-to-Speech) ----------
function speak(text) {
  if (!window.speechSynthesis) return;
  const clean = text.replace(/```[\s\S]*?```/g, " (کد) ").slice(0, 500);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "fa-IR";
  u.rate = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ---------- Settings ----------
$("openSettings").onclick = async () => {
  const s = await fetch("/api/settings/").then(r => r.json());
  $("setKey").value = "";
  $("setUrl").value = s.base_url;
  $("setModel").value = s.model;
  $("settingsModal").classList.add("open");
};
$("closeSettings").onclick = () => $("settingsModal").classList.remove("open");
$("saveSettings").onclick = async () => {
  const body = {
    base_url: $("setUrl").value,
    model: $("setModel").value,
  };
  if ($("setKey").value) body.api_key = $("setKey").value;
  await fetch("/api/settings/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  $("settingsModal").classList.remove("open");
};

// ---------- Init ----------
checkAuth();