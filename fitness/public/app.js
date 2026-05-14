// ============================================================
// Fitness Trainer — клиентская логика (vanilla JS).
// Один SPA, после логина показывает кабинет тренера или клиента.
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  user: null,
  cache: {},
  restTimer: null,
};

const DOW = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DIFFICULTY_LABEL = { beginner: "Новичок", intermediate: "Средний", advanced: "Продвинутый" };

// =================== Хелперы ===================
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + kind;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2600);
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}

function pluralize(n, forms) {
  // forms = ['тренировка', 'тренировки', 'тренировок']
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

// ====== Modal ======
function openModal(title, bodyHtml) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = bodyHtml;
  $("#modal").hidden = false;
}
function closeModal() { $("#modal").hidden = true; $("#modal-body").innerHTML = ""; }

// ====== Custom confirm ======
function confirmDlg(title, text, okText = "Удалить") {
  return new Promise((resolve) => {
    $("#confirm-title").textContent = title;
    $("#confirm-text").textContent = text || "";
    const okBtn = $('[data-action="confirm-ok"]');
    const cancelBtn = $('[data-action="confirm-cancel"]');
    okBtn.textContent = okText;
    $("#confirm").hidden = false;

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    function cleanup() {
      $("#confirm").hidden = true;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
    }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// ====== Screens ======
function showScreen(id) {
  ["login-screen", "trainer-screen", "client-screen"].forEach((s) => {
    $(`#${s}`).hidden = s !== id;
  });
}

async function bootstrap() {
  try {
    const { user } = await api("/api/me");
    if (!user) return showScreen("login-screen");
    state.user = user;
    if (user.role === "trainer") enterTrainer();
    else enterClient();
  } catch (e) {
    showScreen("login-screen");
  }
}

// =================== Login ===================
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#login-code").value.trim();
  const err = $("#login-error");
  err.hidden = true;
  try {
    const { user } = await api("/api/login", { method: "POST", body: { code } });
    state.user = user;
    if (user.role === "trainer") enterTrainer();
    else enterClient();
  } catch (e) {
    err.textContent = "Неверный код. Проверь и попробуй снова.";
    err.hidden = false;
  }
});

// =================== Глобальные клики ===================
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;

  if (a === "logout") {
    if (!(await confirmDlg("Выйти?", "Войти заново можно по коду.", "Выйти"))) return;
    await api("/api/logout", { method: "POST" });
    state.user = null;
    showScreen("login-screen");
    $("#login-code").value = "";
  }
  if (a === "close-modal") closeModal();
  if (a === "toggle-reveal") {
    const wrap = t.closest(".password-wrap");
    const inp = $("input", wrap);
    inp.type = inp.type === "password" ? "text" : "password";
    wrap.classList.toggle("revealed", inp.type === "text");
  }
  if (a === "rest-cancel") stopRestTimer();
  if (a === "rest-add") addRestTime(30);
  if (a === "toggle-theme") toggleTheme();
  if (a === "open-plate-calc") plateCalcModal();
  if (a === "add-goal") addGoalModal();
  if (a === "complete-goal") completeGoal(+t.dataset.id);
  if (a === "delete-goal") deleteGoal(+t.dataset.id);
  if (a === "bulk-assign") bulkAssignModal();
  if (a === "export-program") exportProgramModal(+t.dataset.id);
  if (a === "edit-profile") editProfileModal();
  if (a === "open-rate") rateProgramModal(+t.dataset.id);
  if (a === "reply-comment") {
    // тренер отвечает прямо из ленты
    const clientId = +t.dataset.clientId;
    const exerciseId = +t.dataset.ex;
    const text = prompt("Ответ:");
    if (!text) return;
    try {
      await api("/api/comments", { method: "POST", body: { exercise_id: exerciseId, client_id: clientId, body: text } });
      toast("Отправлено"); renderTrainerFeed();
    } catch (e) { toast(e.message); }
  }

  // --- Trainer actions ---
  if (a === "add-client") addClientModal();
  if (a === "edit-client") editClientModal(+t.dataset.id);
  if (a === "open-client") openClientSummary(+t.dataset.id);
  if (a === "add-program") addProgramModal();
  if (a === "open-program") openProgramEditor(+t.dataset.id);
  if (a === "delete-program") deleteProgram(+t.dataset.id);
  if (a === "duplicate-program") duplicateProgram(+t.dataset.id);
  if (a === "toggle-archive-program") toggleArchiveProgram(+t.dataset.id, +t.dataset.archived === 1);
  if (a === "edit-program-meta") editProgramMetaModal(+t.dataset.id);
  if (a === "add-exercise") addExerciseModal(+t.dataset.programId);
  if (a === "edit-exercise") editExerciseModal(+t.dataset.id);
  if (a === "delete-exercise") deleteExercise(+t.dataset.id, +t.dataset.programId);
  if (a === "move-exercise") moveExercise(+t.dataset.id, +t.dataset.programId, t.dataset.dir);
  if (a === "add-assignment") addAssignmentModal();
  if (a === "toggle-assignment") toggleAssignment(+t.dataset.id, t.dataset.active === "1");
  if (a === "delete-assignment") deleteAssignment(+t.dataset.id);
  if (a === "view-rating") viewRatingsModal(+t.dataset.id);

  // --- Client actions ---
  if (a === "log-done" || a === "log-quick") {
    const same = a === "log-quick";
    await logExercise(t.closest(".exercise"), same);
  }
  if (a === "toggle-chat") {
    const chat = $("[data-chat]", t.closest(".exercise"));
    chat.hidden = !chat.hidden;
    if (!chat.hidden) loadComments(+t.closest(".exercise").dataset.ex, chat);
  }
  if (a === "send-comment") {
    const chat = t.closest("[data-chat]");
    const input = $("input[data-comment]", chat);
    const card = t.closest(".exercise");
    const text = input.value.trim();
    if (!text) return;
    try {
      await api("/api/comments", { method: "POST", body: { exercise_id: +card.dataset.ex, body: text } });
      input.value = "";
      loadComments(+card.dataset.ex, chat);
    } catch (e) { toast(e.message); }
  }
  if (a === "toggle-rest-day") toggleRestDay();
  if (a === "start-program") startProgramFromCatalog(+t.dataset.id);
  if (a === "rate-program") rateProgramModal(+t.dataset.id);
  if (a === "add-bodylog") addBodyLogModal();
  if (a === "open-1rm") oneRMCalcModal();
  if (a === "open-rest-timer") startRestTimer(+t.dataset.seconds || 90);
});

// =================== Tabs ===================
document.addEventListener("click", (e) => {
  if (!e.target.matches(".tab")) return;
  const tab = e.target.dataset.tab;
  const root = e.target.closest(".screen");
  $$(".tab", root).forEach((b) => b.classList.toggle("active", b === e.target));
  $$(".tab-panel", root).forEach((p) => p.classList.toggle("active", p.id === tab));
  if (tab === "t-programs") renderPrograms();
  if (tab === "t-assignments") renderAssignments();
  if (tab === "t-feed") renderTrainerFeed();
  if (tab === "t-profile") renderTrainerProfile();
  if (tab === "c-week") renderWeek();
  if (tab === "c-history") renderHistory();
  if (tab === "c-catalog") renderCatalog();
  if (tab === "c-body") renderBody();
  if (tab === "c-goals") renderGoals();
});

// ====================================================
// =============== КАБИНЕТ ТРЕНЕРА ====================
// ====================================================
async function enterTrainer() {
  showScreen("trainer-screen");
  $("#trainer-name").textContent = state.user.name;
  await Promise.all([renderTrainerDashboard(), renderClients()]);
}

async function renderTrainerDashboard() {
  const el = $("#trainer-dashboard");
  el.innerHTML = skeletonStats(4);
  try {
    const d = await api("/api/dashboard");
    el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Клиенты</div><div class="stat-value">${d.clients_count}</div></div>
      <div class="stat-card"><div class="stat-label">Активные программы</div><div class="stat-value">${d.active_assignments}</div></div>
      <div class="stat-card accent"><div class="stat-label">Тренировок за 7 дн</div><div class="stat-value">${d.week_sessions}</div></div>
      <div class="stat-card"><div class="stat-label">Активны на неделе</div><div class="stat-value">${d.week_active_clients}<small>/${d.clients_count}</small></div></div>
    `;
    if (d.stale_clients?.length) {
      const list = d.stale_clients.map((c) => `<button class="tag-chip" data-action="open-client" data-id="${c.id}">${escape(c.name)} · ${c.last_log ? "был " + c.last_log : "ни разу"}</button>`).join(" ");
      el.insertAdjacentHTML("beforeend", `<div class="stat-card" style="grid-column: 1/-1"><div class="stat-label">Не тренировались 5+ дней</div><div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${list}</div></div>`);
    }
  } catch { el.innerHTML = ""; }
}

function skeletonStats(n) {
  return Array(n).fill(0).map(() => `<div class="stat-card"><div class="skeleton" style="height:10px;width:60px;margin-bottom:6px;"></div><div class="skeleton" style="height:24px;width:40px;"></div></div>`).join("");
}
function skeletonList(n) {
  return Array(n).fill(0).map(() => `<div class="skeleton-card"></div>`).join("");
}

// ----- Клиенты -----
async function renderClients() {
  const list = $("#clients-list");
  list.innerHTML = skeletonList(3);
  const { clients } = await api("/api/clients");
  state.cache.clients = clients;
  if (!clients.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">🤝</span><h4>Ещё нет клиентов</h4>Нажми «+ Добавить» — придумаешь имя и код доступа.</div>`;
    return;
  }
  list.innerHTML = clients.map((c) => `
    <div class="card" data-client="${c.id}">
      <div class="card-row">
        <div style="flex:1; min-width:0">
          <h3>${escape(c.name)}</h3>
          ${c.notes ? `<p>${escape(c.notes)}</p>` : ""}
          <div class="meta">с ${fmtDate(c.created_at)}</div>
        </div>
        <div class="actions-col">
          <button class="small" data-action="open-client" data-id="${c.id}">Открыть</button>
          <button class="small ghost" data-action="edit-client" data-id="${c.id}">Изменить</button>
        </div>
      </div>
    </div>`).join("");
}

function addClientModal() {
  openModal("Новый клиент", `
    <form id="form-client">
      <label>Имя клиента</label>
      <input name="name" required>
      <label>Код доступа (минимум 4 символа)</label>
      <input name="code" required minlength="4" autocomplete="off">
      <label>Заметка (необязательно)</label>
      <textarea name="notes" rows="2"></textarea>
      <div class="form-actions">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Создать</button>
      </div>
    </form>`);
  $("#form-client").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/clients", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
      closeModal(); toast("Клиент создан"); renderClients(); renderTrainerDashboard();
    } catch (e) { toast(e.message); }
  });
}

function editClientModal(id) {
  const c = state.cache.clients.find((x) => x.id === id);
  if (!c) return;
  openModal(`Изменить: ${c.name}`, `
    <form id="form-client-edit">
      <label>Имя</label><input name="name" value="${escape(c.name)}">
      <label>Новый код (пустое поле — без изменений)</label><input name="code" autocomplete="off">
      <label>Заметка</label><textarea name="notes" rows="2">${escape(c.notes || "")}</textarea>
      <div class="form-actions">
        <button class="danger" type="button" id="btn-del-client">Удалить клиента</button>
        <button type="submit">Сохранить</button>
      </div>
    </form>`);
  $("#form-client-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (!body.code) delete body.code;
    try {
      await api(`/api/clients/${id}`, { method: "PUT", body });
      closeModal(); toast("Сохранено"); renderClients();
    } catch (e) { toast(e.message); }
  });
  $("#btn-del-client").addEventListener("click", async () => {
    if (!(await confirmDlg(`Удалить «${c.name}»?`, "Журнал и назначения тоже удалятся. Это необратимо."))) return;
    await api(`/api/clients/${id}`, { method: "DELETE" });
    closeModal(); toast("Удалён"); renderClients(); renderTrainerDashboard();
  });
}

async function openClientSummary(id) {
  try {
    const { client, assignments, recent, daily } = await api(`/api/clients/${id}/summary`);
    const last30 = daily.length ? daily.map((d) => `${d.log_date.slice(5)}: ${d.done_count}`).join(" · ") : "пока пусто";
    openModal(`Клиент: ${escape(client.name)}`, `
      <div class="card"><strong>Активные программы</strong>
        <div class="group-list" style="margin-top:8px;">
          ${assignments.filter((a) => a.is_active).map((a) => `
            <div class="card-row">
              <div>
                <div>${escape(a.name)}</div>
                <div class="meta">с ${a.start_date}${a.end_date ? ` по ${a.end_date}` : ""}</div>
              </div>
            </div>`).join("") || `<p class="muted">Нет активных назначений.</p>`}
        </div>
      </div>
      <div class="card" style="margin-top:10px;">
        <strong>Тренировок за последние 30 дней</strong>
        <div class="meta" style="margin-top:6px;">${last30}</div>
      </div>
      <div class="card" style="margin-top:10px;">
        <strong>Последние записи</strong>
        <div class="group-list" style="margin-top:8px;">
          ${recent.length ? recent.map((r) => `
            <div class="card-row">
              <div style="flex:1; min-width:0;">
                <div>${escape(r.exercise_name)}</div>
                <div class="meta">${r.log_date} · ${r.done_sets ?? "?"}×${r.done_reps ?? "?"} ${r.done_weight ? `· ${r.done_weight} кг` : ""}</div>
                ${r.client_note ? `<div class="meta">📝 ${escape(r.client_note)}</div>` : ""}
              </div>
              <span class="tagline ${r.completed ? "ok" : "warn"}">${r.completed ? "✓" : "—"}</span>
            </div>`).join("") : `<p class="muted">Клиент ещё ничего не записал.</p>`}
        </div>
      </div>`);
  } catch (e) { toast(e.message); }
}

// ----- Программы -----
async function renderPrograms() {
  const list = $("#programs-list");
  list.innerHTML = skeletonList(3);
  const search = $("#programs-search").value.trim().toLowerCase();
  const includeArchived = $("#programs-include-archived").checked;
  const { programs } = await api(`/api/programs${includeArchived ? "?include_archived=1" : ""}`);
  state.cache.programs = programs;
  let filtered = programs;
  if (search) filtered = programs.filter((p) => p.name.toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search));
  if (!filtered.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">📋</span><h4>Программ нет</h4>Нажми «+ Добавить» и создай первую.</div>`;
    return;
  }
  list.innerHTML = filtered.map((p) => `
    <div class="card${p.is_archived ? " archived" : ""}">
      <div class="card-row">
        <div style="flex:1; min-width:0;">
          <h3>
            ${escape(p.name)}
            ${p.is_archived ? '<span class="tagline warn">архив</span>' : ""}
            ${p.is_public ? "" : '<span class="tagline">скрыта</span>'}
          </h3>
          ${p.description ? `<p>${escape(p.description)}</p>` : ""}
          <div class="tags-row" style="margin-top:6px;">
            ${p.difficulty ? `<span class="difficulty-pill ${p.difficulty}">${DIFFICULTY_LABEL[p.difficulty]}</span>` : ""}
            ${renderTags(p.tags)}
          </div>
          <div class="meta">
            ${p.exercises_count} упражнений · ${p.active_assignments} занимается
            ${p.avg_stars ? ` · <span class="rating-row">${renderStars(p.avg_stars)} ${p.avg_stars}</span> (${p.ratings_count})` : ""}
          </div>
        </div>
        <div class="actions-col">
          <button class="small" data-action="open-program" data-id="${p.id}">Упражнения</button>
          <button class="small ghost" data-action="edit-program-meta" data-id="${p.id}">Настроить</button>
          <button class="small ghost" data-action="duplicate-program" data-id="${p.id}">Копия</button>
          <button class="small ghost" data-action="toggle-archive-program" data-id="${p.id}" data-archived="${p.is_archived ? 0 : 1}">${p.is_archived ? "Из архива" : "В архив"}</button>
        </div>
      </div>
    </div>`).join("");
}

$("#programs-search").addEventListener("input", debounce(renderPrograms, 200));
$("#programs-include-archived").addEventListener("change", renderPrograms);

function renderTags(tagsJson) {
  if (!tagsJson) return "";
  try {
    const tags = typeof tagsJson === "string" ? JSON.parse(tagsJson) : tagsJson;
    return tags.map((t) => `<span class="tag-chip">${escape(t)}</span>`).join("");
  } catch { return ""; }
}
function renderStars(avg, max = 5) {
  const filled = Math.round(avg || 0);
  return `<span class="stars">${Array(max).fill(0).map((_, i) => `<span class="star ${i < filled ? "filled" : ""}">★</span>`).join("")}</span>`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function addProgramModal() { editProgramMetaModal(null); }

async function editProgramMetaModal(id) {
  const p = id ? state.cache.programs.find((x) => x.id === id) : { name: "", description: "", difficulty: "", tags: null, duration_weeks: null, is_public: 1 };
  let tags = "";
  try { tags = (typeof p.tags === "string" ? JSON.parse(p.tags) : p.tags || []).join(", "); } catch { tags = ""; }
  openModal(id ? `Программа: ${p.name}` : "Новая программа", `
    <form id="form-program">
      <label>Название</label>
      <input name="name" value="${escape(p.name)}" required>
      <label>Описание</label>
      <textarea name="description" rows="3">${escape(p.description || "")}</textarea>
      <label>Сложность</label>
      <select name="difficulty" class="ios-select">
        <option value="">не указано</option>
        <option value="beginner" ${p.difficulty === "beginner" ? "selected" : ""}>Новичок</option>
        <option value="intermediate" ${p.difficulty === "intermediate" ? "selected" : ""}>Средний</option>
        <option value="advanced" ${p.difficulty === "advanced" ? "selected" : ""}>Продвинутый</option>
      </select>
      <label>Теги через запятую</label>
      <input name="tags" value="${escape(tags)}" placeholder="сила, масса, дома">
      <label>Длительность, недель</label>
      <input name="duration_weeks" type="number" min="1" value="${p.duration_weeks ?? ""}">
      <label class="checkbox-inline" style="margin-top:14px;">
        <input type="checkbox" name="is_public" ${p.is_public ? "checked" : ""}>
        Показывать клиентам в каталоге
      </label>
      <div class="form-actions">
        ${id ? `<button class="danger" type="button" id="btn-del-program">Удалить</button>` : `<button class="ghost" type="button" data-action="close-modal">Отмена</button>`}
        <button type="submit">${id ? "Сохранить" : "Создать"}</button>
      </div>
    </form>`);
  $("#form-program").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get("name"),
      description: fd.get("description"),
      difficulty: fd.get("difficulty") || null,
      tags: fd.get("tags") ? fd.get("tags").split(",").map((s) => s.trim()).filter(Boolean) : null,
      duration_weeks: fd.get("duration_weeks") ? +fd.get("duration_weeks") : null,
      is_public: fd.get("is_public") ? 1 : 0,
    };
    try {
      if (id) await api(`/api/programs/${id}`, { method: "PUT", body });
      else await api("/api/programs", { method: "POST", body });
      closeModal(); toast(id ? "Сохранено" : "Программа создана"); renderPrograms();
    } catch (e) { toast(e.message); }
  });
  if (id) {
    $("#btn-del-program").addEventListener("click", async () => {
      if (!(await confirmDlg("Удалить программу?", "Все упражнения и назначения удалятся. Может, лучше архивировать?"))) return;
      await api(`/api/programs/${id}`, { method: "DELETE" });
      closeModal(); toast("Удалено"); renderPrograms();
    });
  }
}

async function deleteProgram(id) {
  if (!(await confirmDlg("Удалить программу?", "Все упражнения и назначения удалятся."))) return;
  await api(`/api/programs/${id}`, { method: "DELETE" });
  toast("Удалено"); renderPrograms();
}

async function duplicateProgram(id) {
  try {
    await api(`/api/programs/${id}/duplicate`, { method: "POST" });
    toast("Копия создана"); renderPrograms();
  } catch (e) { toast(e.message); }
}

async function toggleArchiveProgram(id, makeArchived) {
  await api(`/api/programs/${id}`, { method: "PUT", body: { is_archived: makeArchived ? 1 : 0 } });
  toast(makeArchived ? "В архиве" : "Восстановлено"); renderPrograms();
}

async function openProgramEditor(programId) {
  state.cache.lastProgramId = programId;
  const data = await api(`/api/programs/${programId}`);
  state.cache.exercises = data.exercises;
  openModal(`Упражнения: ${data.program.name}`, `
    <p class="muted small">${escape(data.program.description || "")}</p>
    <div style="margin:10px 0;"><button data-action="add-exercise" data-program-id="${programId}">+ Упражнение</button></div>
    <div class="group-list" id="exercises-list">
      ${data.exercises.length
        ? data.exercises.map((e, i, all) => exerciseCardHtml(e, programId, i, all.length)).join("")
        : `<div class="empty"><span class="emoji">🏋️</span><h4>Упражнений нет</h4>Добавь первое — присед, жим, тяга.</div>`}
    </div>`);
}

function exerciseCardHtml(e, programId, idx, total) {
  return `
    <div class="card">
      <div class="card-row">
        <div style="flex:1; min-width:0;">
          <h3>
            ${e.day_of_week ? `<span class="dow">${DOW[e.day_of_week]}</span>` : `<span class="dow">любой</span>`}
            ${escape(e.name)}
          </h3>
          <div class="meta">
            ${e.target_sets ? `${e.target_sets}×` : ""}${escape(e.target_reps || "")}${e.target_weight ? ` · ${escape(e.target_weight)}` : ""}${e.rest_seconds ? ` · отдых ${e.rest_seconds}с` : ""}
          </div>
          ${e.description ? `<p>${escape(e.description)}</p>` : ""}
          ${e.video_url ? `<div class="meta"><a href="${escape(e.video_url)}" target="_blank">🎬 видео</a></div>` : ""}
        </div>
        <div class="actions-col">
          ${idx > 0 ? `<button class="icon-btn" data-action="move-exercise" data-id="${e.id}" data-program-id="${programId}" data-dir="up" title="Вверх">↑</button>` : ""}
          ${idx < total - 1 ? `<button class="icon-btn" data-action="move-exercise" data-id="${e.id}" data-program-id="${programId}" data-dir="down" title="Вниз">↓</button>` : ""}
          <button class="icon-btn" data-action="edit-exercise" data-id="${e.id}" title="Изменить">✎</button>
          <button class="icon-btn danger" data-action="delete-exercise" data-id="${e.id}" data-program-id="${programId}" title="Удалить">×</button>
        </div>
      </div>
    </div>`;
}

async function moveExercise(id, programId, dir) {
  const ex = state.cache.exercises.find((x) => x.id === id);
  if (!ex) return;
  const siblings = state.cache.exercises.filter((x) => x.day_of_week === ex.day_of_week);
  const i = siblings.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  const other = siblings[j];
  await api(`/api/exercises/${id}`, { method: "PUT", body: { order_index: other.order_index } });
  await api(`/api/exercises/${other.id}`, { method: "PUT", body: { order_index: ex.order_index } });
  openProgramEditor(programId);
}

function exerciseFormHtml(e = {}) {
  return `
    <label>Название</label>
    <input name="name" id="ex-name" value="${escape(e.name || "")}" autocomplete="off" required>
    <div id="ex-suggestions" class="ex-suggest"></div>
    <label>Описание / техника</label>
    <textarea name="description" rows="2">${escape(e.description || "")}</textarea>
    <label>Видео-ссылка</label>
    <input name="video_url" value="${escape(e.video_url || "")}" placeholder="https://youtube.com/...">
    <div class="row-inputs">
      <div><label>Подходы</label><input name="target_sets" type="number" min="1" value="${e.target_sets ?? ""}"></div>
      <div><label>Повторы</label><input name="target_reps" value="${escape(e.target_reps || "")}" placeholder="8-12"></div>
    </div>
    <div class="row-inputs">
      <div><label>Вес</label><input name="target_weight" value="${escape(e.target_weight || "")}" placeholder="60 кг"></div>
      <div><label>Отдых, сек</label><input name="rest_seconds" type="number" min="0" value="${e.rest_seconds ?? ""}"></div>
    </div>
    <div class="row-inputs">
      <div><label>День недели</label>
        <select name="day_of_week" class="ios-select">
          <option value="">любой день</option>
          ${[1,2,3,4,5,6,7].map((d) => `<option value="${d}" ${e.day_of_week === d ? "selected" : ""}>${DOW[d]}</option>`).join("")}
        </select>
      </div>
      <div><label>Порядок</label><input name="order_index" type="number" min="0" value="${e.order_index ?? 0}"></div>
    </div>`;
}

function addExerciseModal(programId) {
  openModal("Новое упражнение", `<form id="form-ex">${exerciseFormHtml()}
    <div class="form-actions">
      <button class="ghost" type="button" data-action="close-modal">Отмена</button>
      <button type="submit">Добавить</button>
    </div></form>`);
  wireExerciseAutocomplete();
  $("#form-ex").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = formToBody(e.target);
    try {
      await api(`/api/programs/${programId}/exercises`, { method: "POST", body });
      closeModal(); toast("Добавлено"); openProgramEditor(programId);
    } catch (e) { toast(e.message); }
  });
}

function editExerciseModal(id) {
  const ex = state.cache.exercises.find((x) => x.id === id);
  if (!ex) return;
  openModal(`Упражнение: ${ex.name}`, `<form id="form-ex">${exerciseFormHtml(ex)}
    <div class="form-actions">
      <button class="ghost" type="button" data-action="close-modal">Отмена</button>
      <button type="submit">Сохранить</button>
    </div></form>`);
  wireExerciseAutocomplete();
  $("#form-ex").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = formToBody(e.target);
    try {
      await api(`/api/exercises/${id}`, { method: "PUT", body });
      closeModal(); toast("Сохранено");
      if (state.cache.lastProgramId) openProgramEditor(state.cache.lastProgramId);
    } catch (e) { toast(e.message); }
  });
}

function wireExerciseAutocomplete() {
  const inp = $("#ex-name");
  const box = $("#ex-suggestions");
  if (!inp || !box) return;
  inp.addEventListener("input", debounce(async () => {
    const q = inp.value.trim();
    if (q.length < 2) { box.innerHTML = ""; return; }
    try {
      const { items } = await api(`/api/exercise-library?q=${encodeURIComponent(q)}`);
      box.innerHTML = items.slice(0, 6).map((x) =>
        `<button type="button" class="suggest-item" data-name="${escape(x.name)}" data-desc="${escape(x.description || "")}" data-video="${escape(x.video_url || "")}">${escape(x.name)} <span class="muted small">· ${escape(x.muscle_group || "")}</span></button>`
      ).join("");
    } catch {}
  }, 200));
  box.addEventListener("click", (e) => {
    const btn = e.target.closest(".suggest-item");
    if (!btn) return;
    inp.value = btn.dataset.name;
    const desc = $('textarea[name="description"]');
    const video = $('input[name="video_url"]');
    if (desc && !desc.value && btn.dataset.desc) desc.value = btn.dataset.desc;
    if (video && !video.value && btn.dataset.video) video.value = btn.dataset.video;
    box.innerHTML = "";
  });
}

async function deleteExercise(id, programId) {
  if (!(await confirmDlg("Удалить упражнение?", "Журнал по нему тоже сотрётся."))) return;
  await api(`/api/exercises/${id}`, { method: "DELETE" });
  toast("Удалено"); openProgramEditor(programId);
}

function formToBody(form) {
  const obj = Object.fromEntries(new FormData(form));
  ["target_sets", "rest_seconds", "day_of_week", "order_index"].forEach((k) => {
    if (obj[k] === "" || obj[k] === undefined) obj[k] = null;
    else obj[k] = Number(obj[k]);
  });
  return obj;
}

// ----- Назначения -----
async function renderAssignments() {
  const list = $("#assignments-list");
  list.innerHTML = skeletonList(3);
  const { assignments } = await api("/api/assignments");
  state.cache.assignments = assignments;
  if (!assignments.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">🔗</span><h4>Нет назначений</h4>Привяжи программу к клиенту, и она появится у него во вкладке «Сегодня».</div>`;
    return;
  }
  list.innerHTML = assignments.map((a) => `
    <div class="card">
      <div class="card-row">
        <div style="flex:1; min-width:0;">
          <h3>${escape(a.program_name)} → ${escape(a.client_name)}</h3>
          <div class="meta">с ${a.start_date}${a.end_date ? ` по ${a.end_date}` : ""} · <span class="tagline ${a.is_active ? "ok" : "warn"}">${a.is_active ? "активно" : "архив"}</span></div>
        </div>
        <div class="actions-col">
          <button class="small ghost" data-action="toggle-assignment" data-id="${a.id}" data-active="${a.is_active ? 0 : 1}">${a.is_active ? "Снять" : "Возобновить"}</button>
          <button class="icon-btn danger" data-action="delete-assignment" data-id="${a.id}">×</button>
        </div>
      </div>
    </div>`).join("");
}

async function addAssignmentModal() {
  const [progs, cls] = await Promise.all([
    api("/api/programs"),
    api("/api/clients"),
  ]);
  if (!progs.programs.length || !cls.clients.length) {
    return toast("Сначала создай хотя бы одну программу и одного клиента");
  }
  openModal("Назначить программу", `
    <form id="form-asg">
      <label>Программа</label>
      <select name="program_id" class="ios-select" required>${progs.programs.filter((p) => !p.is_archived).map((p) => `<option value="${p.id}">${escape(p.name)}</option>`).join("")}</select>
      <label>Клиент</label>
      <select name="client_id" class="ios-select" required>${cls.clients.map((c) => `<option value="${c.id}">${escape(c.name)}</option>`).join("")}</select>
      <div class="row-inputs">
        <div><label>Дата начала</label><input name="start_date" type="date"></div>
        <div><label>Дата окончания</label><input name="end_date" type="date"></div>
      </div>
      <div class="form-actions">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Назначить</button>
      </div>
    </form>`);
  $("#form-asg").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.program_id = +body.program_id; body.client_id = +body.client_id;
    if (!body.start_date) delete body.start_date;
    if (!body.end_date) delete body.end_date;
    try {
      await api("/api/assignments", { method: "POST", body });
      closeModal(); toast("Назначено"); renderAssignments(); renderTrainerDashboard();
    } catch (e) { toast(e.message); }
  });
}

async function toggleAssignment(id, makeActive) {
  await api(`/api/assignments/${id}`, { method: "PATCH", body: { is_active: makeActive } });
  toast("Готово"); renderAssignments();
}

async function deleteAssignment(id) {
  if (!(await confirmDlg("Удалить назначение?"))) return;
  await api(`/api/assignments/${id}`, { method: "DELETE" });
  toast("Удалено"); renderAssignments();
}

async function viewRatingsModal(programId) {
  try {
    const { ratings } = await api(`/api/programs/${programId}/ratings`);
    if (!ratings.length) return toast("Оценок пока нет");
    openModal("Отзывы о программе", ratings.map((r) => `
      <div class="card" style="margin-bottom:8px;">
        <div class="card-row">
          <div>${escape(r.client_name)}</div>
          <div>${renderStars(r.stars)}</div>
        </div>
        ${r.review ? `<p style="margin-top:6px;">${escape(r.review)}</p>` : ""}
        <div class="meta">${r.created_at.slice(0, 10)}</div>
      </div>`).join(""));
  } catch (e) { toast(e.message); }
}

// ====================================================
// =============== КАБИНЕТ КЛИЕНТА ====================
// ====================================================
async function enterClient() {
  showScreen("client-screen");
  $("#client-name").textContent = state.user.name;
  await Promise.all([renderClientStats(), renderToday()]);
}

async function renderClientStats() {
  const el = $("#client-stats");
  el.innerHTML = skeletonStats(3);
  try {
    const s = await api("/api/stats?days=120");
    el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Серия</div><div class="stat-value">${s.streak}<small> ${pluralize(s.streak, ["день", "дня", "дней"])}</small></div></div>
      <div class="stat-card"><div class="stat-label">Всего тренировок</div><div class="stat-value">${s.total_sessions}</div></div>
      <div class="stat-card accent"><div class="stat-label">Личные рекорды</div><div class="stat-value">${s.prs}</div></div>
    `;
    state.cache.heatmap = s.heatmap;
  } catch { el.innerHTML = ""; }
}

async function renderToday() {
  const list = $("#today-list");
  list.innerHTML = skeletonList(2);
  const data = await api("/api/today");
  $("#today-title").textContent = `${DOW[data.day_of_week]} · ${data.date}`;
  if (data.rest_day) {
    list.innerHTML = `<div class="rest-day-banner">
      <span class="icon">🌴</span>
      <div><strong>День отдыха</strong><br><span class="small">${escape(data.rest_day.reason || "Восстановление — тоже часть программы.")}</span></div>
    </div>`;
    return;
  }
  if (!data.items.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">🛌</span><h4>На сегодня упражнений нет</h4>Можешь выбрать программу в Каталоге или отметить день отдыха.</div>`;
    return;
  }
  list.innerHTML = data.items.map(todayItemHtml).join("");
  data.items.forEach((it) => loadComments(it.exercise_id));
}

function todayItemHtml(it) {
  const log = it.today_log ? JSON.parse(it.today_log) : null;
  const last = it.last_log ? JSON.parse(it.last_log) : null;
  const done = !!(log && log.completed);
  const isPR = log && log.done_weight != null && it.pr_weight != null && +log.done_weight >= +it.pr_weight;
  return `
    <div class="exercise ${done ? "done" : ""}" data-ex="${it.exercise_id}" data-asg="${it.assignment_id}">
      <h3>
        ${it.day_of_week ? `<span class="dow">${DOW[it.day_of_week]}</span>` : `<span class="dow">любой</span>`}
        ${escape(it.name)}
        ${done ? `<span class="tagline ok">✓</span>` : ""}
        ${isPR ? `<span class="pr-badge">PR</span>` : ""}
      </h3>
      <div class="target">
        ${it.target_sets ? `${it.target_sets}×` : ""}${escape(it.target_reps || "")}${it.target_weight ? ` · ${escape(it.target_weight)}` : ""}${it.rest_seconds ? ` · отдых ${it.rest_seconds}с` : ""}
      </div>
      ${it.description ? `<p class="small">${escape(it.description)}</p>` : ""}
      ${videoEmbed(it.video_url)}
      <div class="inputs">
        <input type="number" inputmode="numeric" min="0" placeholder="подходы" data-field="done_sets" value="${log?.done_sets ?? ""}" ${last && !log ? `data-suggest="${last.done_sets ?? ""}"` : ""}>
        <input type="text" placeholder="повторы" data-field="done_reps" value="${log?.done_reps ?? ""}" ${last && !log ? `data-suggest="${last.done_reps ?? ""}"` : ""}>
        <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="вес, кг" data-field="done_weight" value="${log?.done_weight ?? ""}" ${last && !log ? `data-suggest="${last.done_weight ?? ""}"` : ""}>
      </div>
      ${last && !log ? `<div class="meta" style="margin-top:6px;">В прошлый раз (${last.log_date}): ${last.done_sets ?? "?"}×${last.done_reps ?? "?"} ${last.done_weight ? `· ${last.done_weight} кг` : ""}</div>` : ""}
      <textarea rows="1" placeholder="заметка" data-field="client_note">${escape(log?.client_note || "")}</textarea>
      <div class="actions">
        <button data-action="log-done">${done ? "Перезаписать" : "Готово ✓"}</button>
        ${last && !log ? `<button class="ghost" data-action="log-quick" title="Записать те же значения, что в прошлый раз">↻ как в прошлый</button>` : ""}
        ${it.rest_seconds ? `<button class="ghost" data-action="open-rest-timer" data-seconds="${it.rest_seconds}">⏱ Отдых ${it.rest_seconds}с</button>` : ""}
        <button class="ghost" data-action="toggle-chat">💬 Чат</button>
      </div>
      <div class="chat" data-chat hidden></div>
    </div>`;
}

function videoEmbed(url) {
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `<div class="video"><iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe></div>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return `<div class="video"><video controls src="${escape(url)}"></video></div>`;
  }
  return `<div class="meta"><a href="${escape(url)}" target="_blank">🎬 Открыть видео</a></div>`;
}

async function logExercise(card, useLast = false) {
  if (!card) return;
  const get = (f) => $(`[data-field="${f}"]`, card);
  const gv = (f) => {
    const el = get(f);
    if (useLast && !el.value && el.dataset.suggest) return el.dataset.suggest;
    return el.value || null;
  };
  const numOrNull = (v) => (v === null || v === "" ? null : (Number.isFinite(+v) ? +v : v));
  const body = {
    assignment_id: +card.dataset.asg,
    exercise_id: +card.dataset.ex,
    done_sets: numOrNull(gv("done_sets")),
    done_reps: gv("done_reps") || null,
    done_weight: numOrNull(gv("done_weight")),
    client_note: gv("client_note") || null,
    completed: true,
  };
  try {
    await api("/api/workouts", { method: "POST", body });
    toast("Отмечено ✓");
    // авто-таймер отдыха
    const restSec = +card.querySelector("[data-action='open-rest-timer']")?.dataset.seconds || 0;
    if (restSec) startRestTimer(restSec);
    renderToday(); renderClientStats();
  } catch (e) { toast(e.message); }
}

async function loadComments(exerciseId, chatEl) {
  if (state.user.role !== "client") return;
  const cards = $$(`.exercise[data-ex="${exerciseId}"]`);
  if (!cards.length) return;
  let comments = [];
  try {
    const data = await api(`/api/comments?exercise_id=${exerciseId}`);
    comments = data.comments || [];
  } catch {}
  cards.forEach((card) => {
    const el = chatEl || $("[data-chat]", card);
    if (!el) return;
    el.innerHTML = `
      ${comments.length ? comments.map((c) => `
        <div class="bubble ${c.author_id === state.user.id ? "mine" : ""}">
          <div class="who">${escape(c.author_name)} · ${c.created_at.slice(0, 16).replace("T", " ")}</div>
          ${escape(c.body)}
        </div>`).join("") : `<p class="muted small">Сообщений пока нет.</p>`}
      <div class="chat-form">
        <input data-comment placeholder="Написать тренеру…">
        <button class="small" data-action="send-comment">→</button>
      </div>`;
  });
}

// ----- День отдыха -----
async function toggleRestDay() {
  const today = new Date().toISOString().slice(0, 10);
  const exists = state.cache.restToday;
  if (exists) {
    await api(`/api/rest-days?date=${today}`, { method: "DELETE" });
    state.cache.restToday = false;
    toast("Отметка снята");
  } else {
    const reason = prompt("Причина (необязательно):") || "";
    await api("/api/rest-days", { method: "POST", body: { reason } });
    state.cache.restToday = true;
    toast("День отдыха отмечен");
  }
  renderToday();
}

// ----- Каталог -----
async function renderCatalog() {
  const list = $("#catalog-list");
  list.innerHTML = skeletonList(3);
  const { programs } = await api("/api/catalog");
  state.cache.catalog = programs;
  const search = $("#catalog-search").value.trim().toLowerCase();
  const sort = $("#catalog-sort").value;
  let arr = programs.slice();
  if (search) arr = arr.filter((p) => p.name.toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search));
  arr.sort((a, b) => {
    if (sort === "new") return new Date(b.created_at) - new Date(a.created_at);
    if (sort === "popular") return (b.active_users || 0) - (a.active_users || 0);
    return (b.avg_stars || 0) - (a.avg_stars || 0) || (b.ratings_count || 0) - (a.ratings_count || 0);
  });
  if (!arr.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">📚</span><h4>Каталог пуст</h4>Тренер ещё не добавил программы. Напиши ему в чате.</div>`;
    return;
  }
  list.innerHTML = arr.map(catalogCardHtml).join("");
}
$("#catalog-search").addEventListener("input", debounce(renderCatalog, 200));
$("#catalog-sort").addEventListener("change", renderCatalog);

function catalogCardHtml(p) {
  return `
    <div class="catalog-card">
      <div class="header">
        <div style="flex:1; min-width:0;">
          <h3>${escape(p.name)}</h3>
          ${p.description ? `<p class="description">${escape(p.description)}</p>` : ""}
          <div class="tags-row">
            ${p.difficulty ? `<span class="difficulty-pill ${p.difficulty}">${DIFFICULTY_LABEL[p.difficulty]}</span>` : ""}
            ${renderTags(p.tags)}
          </div>
        </div>
      </div>
      <div class="meta">
        ${p.avg_stars ? `${renderStars(p.avg_stars)} <strong>${p.avg_stars}</strong> (${p.ratings_count})` : `<span class="muted">пока без оценок</span>`}
        · ${p.exercises_count} ${pluralize(p.exercises_count, ["упражнение", "упражнения", "упражнений"])}
        · ${p.active_users || 0} ${pluralize(p.active_users || 0, ["занимается", "занимаются", "занимаются"])}
        ${p.duration_weeks ? ` · ${p.duration_weeks} ${pluralize(p.duration_weeks, ["неделя", "недели", "недель"])}` : ""}
      </div>
      <div class="actions">
        ${p.is_mine
          ? `<button class="ghost" disabled>✓ Активна</button><button class="ghost" data-action="rate-program" data-id="${p.id}">${p.my_stars ? `Изменить оценку (${p.my_stars}★)` : "Поставить оценку"}</button>`
          : `<button data-action="start-program" data-id="${p.id}">Начать программу</button>`}
      </div>
    </div>`;
}

async function startProgramFromCatalog(programId) {
  const p = state.cache.catalog?.find((x) => x.id === programId);
  if (!(await confirmDlg(`Начать «${p?.name || "программу"}»?`, "Программа появится во вкладке «Сегодня». Прошлые активные программы остановятся.", "Начать"))) return;
  try {
    await api(`/api/catalog/${programId}/start`, { method: "POST" });
    toast("Программа запущена 💪");
    renderCatalog();
    renderToday();
    renderClientStats();
  } catch (e) { toast(e.message); }
}

function rateProgramModal(programId) {
  const p = state.cache.catalog?.find((x) => x.id === programId);
  const myStars = p?.my_stars || 0;
  openModal(`Оценить: ${p?.name || ""}`, `
    <p class="muted small">Помоги тренеру и другим клиентам — поделись впечатлением.</p>
    <div class="stars interactive" id="rate-stars" style="margin: 14px 0;">
      ${[1,2,3,4,5].map((n) => `<span class="star ${n <= myStars ? "filled" : ""}" data-stars="${n}">★</span>`).join("")}
    </div>
    <label>Отзыв (необязательно)</label>
    <textarea id="rate-review" rows="3" placeholder="Что понравилось, что нет, как себя ощущал…"></textarea>
    <div class="form-actions">
      <button class="ghost" type="button" data-action="close-modal">Отмена</button>
      <button id="rate-submit">Сохранить</button>
    </div>`);
  let chosen = myStars;
  $$(".star", $("#rate-stars")).forEach((el) => {
    el.addEventListener("click", () => {
      chosen = +el.dataset.stars;
      $$(".star", $("#rate-stars")).forEach((s) => s.classList.toggle("filled", +s.dataset.stars <= chosen));
    });
  });
  $("#rate-submit").addEventListener("click", async () => {
    if (chosen < 1) return toast("Выбери от 1 до 5 звёзд");
    try {
      await api(`/api/programs/${programId}/ratings`, { method: "POST", body: { stars: chosen, review: $("#rate-review").value.trim() || null } });
      closeModal(); toast("Спасибо за оценку"); renderCatalog();
    } catch (e) { toast(e.message); }
  });
}

// ----- Неделя -----
async function renderWeek() {
  const wrap = $("#week-list");
  wrap.innerHTML = skeletonList(2);
  const { assignments } = await api("/api/assignments");
  const active = assignments.filter((a) => a.is_active);
  if (!active.length) {
    wrap.innerHTML = `<div class="empty"><span class="emoji">📅</span><h4>Нет активных программ</h4>Выбери одну в Каталоге.</div>`;
    return;
  }
  const programs = await Promise.all(active.map((a) => api(`/api/programs/${a.program_id}`)));
  const byDay = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], any: [] };
  programs.forEach((p, i) => {
    p.exercises.forEach((e) => {
      const dow = e.day_of_week || "any";
      byDay[dow].push({ ...e, program_name: active[i].program_name });
    });
  });
  wrap.innerHTML = [1,2,3,4,5,6,7,"any"].map((d) => {
    const items = byDay[d];
    if (!items.length) return "";
    const title = d === "any" ? "Любой день" : DOW[d];
    return `<div class="card">
      <h3>${title}</h3>
      <div class="group-list" style="margin-top:8px;">
        ${items.map((e) => `<div class="card-row">
          <div>
            <div>${escape(e.name)} <span class="meta">· ${escape(e.program_name)}</span></div>
            <div class="meta">${e.target_sets ? `${e.target_sets}×` : ""}${escape(e.target_reps || "")}${e.target_weight ? ` · ${escape(e.target_weight)}` : ""}</div>
          </div>
        </div>`).join("")}
      </div>
    </div>`;
  }).join("");
}

// ----- История -----
async function renderHistory() {
  const { assignments } = await api("/api/assignments");
  const active = assignments.filter((a) => a.is_active);
  const programs = active.length ? await Promise.all(active.map((a) => api(`/api/programs/${a.program_id}`))) : [];
  const exs = [];
  programs.forEach((p, i) => p.exercises.forEach((e) => exs.push({ id: e.id, name: `${e.name} (${active[i].program_name})` })));
  const sel = $("#history-exercise");
  if (!exs.length) {
    sel.innerHTML = `<option>Нет упражнений</option>`;
    $("#history-table").innerHTML = `<div class="empty">Сначала выбери программу в Каталоге.</div>`;
    drawHistoryChart([]);
  } else {
    sel.innerHTML = exs.map((e) => `<option value="${e.id}">${escape(e.name)}</option>`).join("");
    sel.onchange = () => loadHistory(+sel.value);
    loadHistory(+sel.value);
  }
  renderHeatmap();
}

async function loadHistory(exerciseId) {
  const { history } = await api(`/api/progress?exercise_id=${exerciseId}`);
  drawHistoryChart(history);
  const tbl = $("#history-table");
  tbl.innerHTML = history.length
    ? history.slice().reverse().map((h) => `
      <div class="card">
        <div class="card-row">
          <div>
            <div><strong>${h.log_date}</strong></div>
            <div class="meta">${h.done_sets ?? "?"}×${h.done_reps ?? "?"} ${h.done_weight ? `· ${h.done_weight} кг` : ""}</div>
            ${h.client_note ? `<div class="meta">📝 ${escape(h.client_note)}</div>` : ""}
          </div>
          <span class="tagline ${h.completed ? "ok" : "warn"}">${h.completed ? "✓" : "—"}</span>
        </div>
      </div>`).join("")
    : `<div class="empty">Записей пока нет. Сходи на тренировку и отметь — здесь появится история.</div>`;
}

function drawHistoryChart(history) {
  const cnv = $("#history-chart");
  const ctx = cnv.getContext("2d");
  const w = cnv.width = cnv.clientWidth;
  const h = cnv.height = 240;
  ctx.clearRect(0, 0, w, h);
  const pts = history.filter((x) => x.done_weight != null).map((x) => ({ d: x.log_date, v: +x.done_weight }));
  if (pts.length < 1) {
    ctx.fillStyle = "#94a3b8"; ctx.font = "13px -apple-system, system-ui, sans-serif";
    ctx.fillText("Введи фактический вес — здесь появится график.", 14, 30);
    return;
  }
  const pad = 36, padR = 14, padT = 18, padB = 24;
  const minV = Math.min(...pts.map((p) => p.v));
  const maxV = Math.max(...pts.map((p) => p.v));
  const rangeV = Math.max(1, maxV - minV);
  // оси
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (h - padT - padB) * (i / 4);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - padR, y); ctx.stroke();
  }
  // grad fill
  const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
  grad.addColorStop(0, "rgba(220, 38, 38, 0.25)");
  grad.addColorStop(1, "rgba(220, 38, 38, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad - padR);
    const y = (h - padB) - ((p.v - minV) / rangeV) * (h - padT - padB);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(w - padR, h - padB); ctx.lineTo(pad, h - padB); ctx.closePath(); ctx.fill();
  // линия
  ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad - padR);
    const y = (h - padB) - ((p.v - minV) / rangeV) * (h - padT - padB);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // точки
  ctx.fillStyle = "#dc2626";
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad - padR);
    const y = (h - padB) - ((p.v - minV) / rangeV) * (h - padT - padB);
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill();
  });
  // подписи
  ctx.fillStyle = "#94a3b8"; ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillText(`${maxV} кг`, 6, padT + 4);
  ctx.fillText(`${minV} кг`, 6, h - padB);
  ctx.fillText(pts[0].d.slice(5), pad, h - 6);
  ctx.fillText(pts[pts.length - 1].d.slice(5), w - padR - 30, h - 6);
}

function renderHeatmap() {
  const el = $("#heatmap");
  const hm = state.cache.heatmap || [];
  const days = 120;
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - days + 1);
  const map = {};
  hm.forEach((r) => (map[r.d] = r.c));
  const cells = [];
  // выравнивание: пн = 0
  const startDow = ((start.getDay() + 6) % 7);
  for (let i = 0; i < startDow; i++) cells.push(`<div class="cell" style="opacity:0;"></div>`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const c = map[ds] || 0;
    const lvl = c >= 3 ? "l3" : c >= 2 ? "l2" : c >= 1 ? "l1" : "";
    cells.push(`<div class="cell ${lvl}" title="${ds}: ${c} ${pluralize(c, ["упр", "упр", "упр"])}"></div>`);
  }
  el.innerHTML = cells.join("");
}

// ----- Замеры -----
async function renderBody() {
  const list = $("#body-list");
  list.innerHTML = skeletonList(2);
  const { logs } = await api("/api/bodylogs");
  state.cache.body = logs;
  drawBodyChart(logs);
  if (!logs.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">⚖️</span><h4>Замеров пока нет</h4>Добавь первый — вес, обхват талии, груди. Тренер увидит динамику.</div>`;
    return;
  }
  list.innerHTML = logs.slice().reverse().map((b) => `
    <div class="card">
      <div class="card-row">
        <div>
          <div><strong>${b.log_date}</strong></div>
          <div class="meta">${b.weight_kg != null ? `${b.weight_kg} кг` : ""}${b.waist_cm != null ? ` · талия ${b.waist_cm} см` : ""}${b.chest_cm != null ? ` · грудь ${b.chest_cm} см` : ""}${b.arm_cm != null ? ` · рука ${b.arm_cm} см` : ""}</div>
          ${b.note ? `<div class="meta">📝 ${escape(b.note)}</div>` : ""}
        </div>
      </div>
    </div>`).join("");
}

function drawBodyChart(logs) {
  const cnv = $("#bodyweight-chart");
  const ctx = cnv.getContext("2d");
  const w = cnv.width = cnv.clientWidth;
  const h = cnv.height = 200;
  ctx.clearRect(0, 0, w, h);
  const pts = logs.filter((x) => x.weight_kg != null).map((x) => ({ d: x.log_date, v: +x.weight_kg }));
  if (pts.length < 2) {
    ctx.fillStyle = "#94a3b8"; ctx.font = "13px -apple-system, system-ui, sans-serif";
    ctx.fillText("Добавь минимум 2 замера веса — здесь появится график.", 14, 30);
    return;
  }
  const pad = 36, padR = 14, padT = 14, padB = 24;
  const minV = Math.min(...pts.map((p) => p.v));
  const maxV = Math.max(...pts.map((p) => p.v));
  const rangeV = Math.max(1, maxV - minV);
  ctx.strokeStyle = "#13b981"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad - padR);
    const y = (h - padB) - ((p.v - minV) / rangeV) * (h - padT - padB);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#13b981";
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad - padR);
    const y = (h - padB) - ((p.v - minV) / rangeV) * (h - padT - padB);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
  });
  ctx.fillStyle = "#94a3b8"; ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillText(`${maxV} кг`, 6, padT + 4);
  ctx.fillText(`${minV} кг`, 6, h - padB);
}

function addBodyLogModal() {
  openModal("Новый замер", `
    <form id="form-body">
      <label>Дата</label><input type="date" name="log_date" value="${new Date().toISOString().slice(0, 10)}">
      <div class="row-inputs">
        <div><label>Вес, кг</label><input type="number" step="0.1" name="weight_kg"></div>
        <div><label>Талия, см</label><input type="number" step="0.5" name="waist_cm"></div>
      </div>
      <div class="row-inputs">
        <div><label>Грудь, см</label><input type="number" step="0.5" name="chest_cm"></div>
        <div><label>Рука, см</label><input type="number" step="0.5" name="arm_cm"></div>
      </div>
      <label>Заметка</label><textarea name="note" rows="2"></textarea>
      <div class="form-actions">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Сохранить</button>
      </div>
    </form>`);
  $("#form-body").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    ["log_date", "note"].forEach((k) => { if (fd.get(k)) body[k] = fd.get(k); });
    ["weight_kg", "waist_cm", "chest_cm", "arm_cm"].forEach((k) => {
      const v = fd.get(k);
      if (v !== "" && v != null) body[k] = +v;
    });
    try {
      await api("/api/bodylogs", { method: "POST", body });
      closeModal(); toast("Замер записан"); renderBody();
    } catch (e) { toast(e.message); }
  });
}

// ----- 1RM Calculator -----
function oneRMCalcModal() {
  openModal("Калькулятор 1ПМ", `
    <p class="muted small">Считаем по формуле Эпли: 1ПМ = вес × (1 + повторы / 30)</p>
    <div class="row-inputs">
      <div><label>Вес, кг</label><input type="number" id="rm-w" step="0.5"></div>
      <div><label>Повторы</label><input type="number" id="rm-r" min="1" max="20"></div>
    </div>
    <div class="card" style="margin-top:14px; text-align:center;">
      <div class="hero-eyebrow">Ваш 1ПМ</div>
      <div class="stat-value" id="rm-result" style="font-size:36px; margin-top:6px;">—</div>
      <div class="meta" id="rm-table" style="margin-top:8px;"></div>
    </div>`);
  const calc = () => {
    const w = +$("#rm-w").value, r = +$("#rm-r").value;
    if (!w || !r) return;
    const rm = w * (1 + r / 30);
    $("#rm-result").textContent = `${rm.toFixed(1)} кг`;
    $("#rm-table").innerHTML = [50, 60, 70, 80, 85, 90, 95].map((pct) => `${pct}%: <strong>${(rm * pct / 100).toFixed(1)}</strong>`).join(" · ");
  };
  $("#rm-w").addEventListener("input", calc);
  $("#rm-r").addEventListener("input", calc);
}

// ----- Таймер отдыха -----
function startRestTimer(seconds) {
  stopRestTimer();
  state.restTimer = { remaining: seconds };
  $("#rest-timer").hidden = false;
  updateRestTimer();
  state.restTimer.iv = setInterval(() => {
    state.restTimer.remaining -= 1;
    updateRestTimer();
    if (state.restTimer.remaining <= 0) {
      stopRestTimer();
      toast("⏰ Отдых закончился");
      try { navigator.vibrate?.([200, 100, 200]); } catch {}
    }
  }, 1000);
}
function stopRestTimer() {
  if (state.restTimer?.iv) clearInterval(state.restTimer.iv);
  state.restTimer = null;
  $("#rest-timer").hidden = true;
}
function addRestTime(s) {
  if (!state.restTimer) return;
  state.restTimer.remaining += s;
  updateRestTimer();
}
function updateRestTimer() {
  if (!state.restTimer) return;
  const r = Math.max(0, state.restTimer.remaining);
  const m = Math.floor(r / 60);
  const s = r % 60;
  $("#rest-timer-time").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// =================== Goals (Цели клиента) ===================
async function renderGoals() {
  const list = $("#goals-list");
  list.innerHTML = skeletonList(2);
  const { goals } = await api("/api/goals");
  state.cache.goals = goals;
  if (!goals.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">🎯</span><h4>Целей пока нет</h4>Поставь конкретную цель — «Жим 100 кг к 1 декабря», «Минус 5 кг к лету».</div>`;
    return;
  }
  list.innerHTML = goals.map(goalCardHtml).join("");
}

function goalCardHtml(g) {
  const current = currentGoalValue(g);
  const start = g.start_value;
  const target = g.target_value;
  let progress = null;
  if (target != null && start != null && current != null) {
    const total = target - start;
    const done = current - start;
    progress = total === 0 ? 0 : Math.max(0, Math.min(100, (done / total) * 100));
  }
  const isDone = !!g.achieved_at;
  return `
    <div class="card goal-card ${isDone ? "done" : ""}">
      <div class="card-row">
        <div style="flex:1; min-width:0;">
          <h3>${isDone ? "✓ " : "🎯 "}${escape(g.title)}</h3>
          <div class="meta">
            ${g.kind === "exercise_1rm" || g.kind === "exercise_weight" ? `${escape(g.exercise_name || "")} · ` : ""}
            ${start != null ? `с <strong>${start}${g.unit || ""}</strong>` : ""}
            ${target != null ? ` → <strong>${target}${g.unit || ""}</strong>` : ""}
            ${current != null ? ` · сейчас <strong>${current}${g.unit || ""}</strong>` : ""}
            ${g.target_date ? ` · до ${g.target_date}` : ""}
          </div>
          ${progress != null ? `<div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div><div class="meta">${Math.round(progress)}%</div>` : ""}
          ${g.note ? `<p>${escape(g.note)}</p>` : ""}
        </div>
        <div class="actions-col">
          ${!isDone ? `<button class="small primary" data-action="complete-goal" data-id="${g.id}">Достиг</button>` : ""}
          <button class="icon-btn danger" data-action="delete-goal" data-id="${g.id}">×</button>
        </div>
      </div>
    </div>`;
}

function currentGoalValue(g) {
  if (g.kind === "body_weight") return g.current_body_weight ?? null;
  if (g.kind === "exercise_weight" || g.kind === "exercise_1rm") return g.current_max_weight ?? null;
  return null;
}

async function addGoalModal() {
  // нужны упражнения из активных программ
  const { assignments } = await api("/api/assignments");
  const active = assignments.filter((a) => a.is_active);
  const programs = active.length ? await Promise.all(active.map((a) => api(`/api/programs/${a.program_id}`))) : [];
  const exs = [];
  programs.forEach((p) => p.exercises.forEach((e) => exs.push({ id: e.id, name: e.name })));

  openModal("Новая цель", `
    <form id="form-goal">
      <label>Тип цели</label>
      <select name="kind" class="ios-select" id="goal-kind">
        <option value="exercise_weight">Поднять вес в упражнении</option>
        <option value="body_weight">Достичь веса тела</option>
        <option value="custom">Произвольная цель</option>
      </select>
      <div id="goal-ex-wrap">
        <label>Упражнение</label>
        <select name="exercise_id" class="ios-select">
          ${exs.map((e) => `<option value="${e.id}">${escape(e.name)}</option>`).join("") || `<option value="">— нет активных программ —</option>`}
        </select>
      </div>
      <label>Название</label>
      <input name="title" required placeholder="Жим 100 кг">
      <div class="row-inputs">
        <div><label>Начальное</label><input type="number" step="0.5" name="start_value" placeholder="80"></div>
        <div><label>Целевое</label><input type="number" step="0.5" name="target_value" placeholder="100"></div>
      </div>
      <div class="row-inputs">
        <div><label>Единица</label><input name="unit" value="кг"></div>
        <div><label>Дата</label><input type="date" name="target_date"></div>
      </div>
      <label>Заметка</label><textarea name="note" rows="2"></textarea>
      <div class="form-actions">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Создать</button>
      </div>
    </form>`);
  $("#goal-kind").addEventListener("change", (e) => {
    $("#goal-ex-wrap").hidden = e.target.value !== "exercise_weight" && e.target.value !== "exercise_1rm";
  });
  $("#form-goal").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    for (const [k, v] of fd.entries()) body[k] = v || null;
    ["start_value", "target_value"].forEach((k) => { if (body[k] != null) body[k] = +body[k]; });
    if (body.exercise_id) body.exercise_id = +body.exercise_id;
    if (body.kind !== "exercise_weight" && body.kind !== "exercise_1rm") delete body.exercise_id;
    try {
      await api("/api/goals", { method: "POST", body });
      closeModal(); toast("Цель поставлена 🎯"); renderGoals();
    } catch (e) { toast(e.message); }
  });
}

async function completeGoal(id) {
  await api(`/api/goals/${id}`, { method: "PATCH", body: { achieved_at: new Date().toISOString() } });
  toast("🎉 Поздравляю!"); renderGoals();
}

async function deleteGoal(id) {
  if (!(await confirmDlg("Удалить цель?"))) return;
  await api(`/api/goals/${id}`, { method: "DELETE" });
  toast("Удалено"); renderGoals();
}

// =================== Trainer feed (лента активности) ===================
async function renderTrainerFeed() {
  const list = $("#feed-list");
  list.innerHTML = skeletonList(3);
  const { comments, workouts } = await api("/api/trainer-feed");
  const events = [];
  comments.forEach((c) => events.push({ type: "comment", t: c.created_at, data: c }));
  workouts.forEach((w) => events.push({ type: "workout", t: w.created_at, data: w }));
  events.sort((a, b) => (a.t < b.t ? 1 : -1));
  if (!events.length) {
    list.innerHTML = `<div class="empty"><span class="emoji">📰</span><h4>Активности нет</h4>Когда клиенты начнут тренироваться и писать — появится здесь.</div>`;
    return;
  }
  list.innerHTML = events.slice(0, 60).map((e) => {
    if (e.type === "comment") {
      const c = e.data;
      const fromClient = c.author_role === "client";
      return `<div class="card feed-card ${fromClient ? "feed-new" : ""}">
        <div class="meta"><strong>${escape(c.client_name)}</strong> · ${escape(c.exercise_name)} · ${formatTime(c.created_at)}</div>
        <p style="margin:6px 0;">${escape(c.body)}</p>
        ${fromClient ? `<button class="small" data-action="reply-comment" data-client-id="${c.client_id}" data-ex="${c.exercise_id}">Ответить</button>` : `<div class="meta">ответ от ${escape(c.author_name)}</div>`}
      </div>`;
    }
    const w = e.data;
    return `<div class="card">
      <div class="meta"><strong>${escape(w.client_name)}</strong> · ${escape(w.exercise_name)} · ${formatTime(w.created_at)}</div>
      <div style="margin-top:4px;">${w.done_sets ?? "?"}×${w.done_reps ?? "?"} ${w.done_weight ? `· ${w.done_weight} кг` : ""}</div>
      ${w.client_note ? `<div class="meta">📝 ${escape(w.client_note)}</div>` : ""}
    </div>`;
  }).join("");
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T") + "Z");
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `сегодня ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

// =================== Trainer profile ===================
async function renderTrainerProfile() {
  const el = $("#profile-block");
  const me = await api("/api/me");
  const u = me.user;
  el.innerHTML = `
    <div class="card">
      <h3>${escape(u.name)}</h3>
      <p class="muted">${escape(u.bio || "Расскажи о себе — клиенты увидят в каталоге.")}</p>
      ${u.avatar_url ? `<img src="${escape(u.avatar_url)}" alt="" style="max-width:120px;border-radius:50%;margin-top:10px;">` : ""}
      <div class="actions" style="margin-top:14px;">
        <button data-action="edit-profile">Изменить</button>
      </div>
    </div>`;
}

function editProfileModal() {
  api("/api/me").then(({ user: u }) => {
    openModal("Профиль", `
      <form id="form-profile">
        <label>Имя</label><input name="name" value="${escape(u.name)}" required>
        <label>Био</label><textarea name="bio" rows="4">${escape(u.bio || "")}</textarea>
        <label>Аватар (URL)</label><input name="avatar_url" value="${escape(u.avatar_url || "")}" placeholder="https://...">
        <div class="form-actions">
          <button class="ghost" type="button" data-action="close-modal">Отмена</button>
          <button type="submit">Сохранить</button>
        </div>
      </form>`);
    $("#form-profile").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("/api/me-profile", { method: "PATCH", body: Object.fromEntries(new FormData(e.target)) });
        closeModal(); toast("Сохранено"); renderTrainerProfile();
      } catch (e) { toast(e.message); }
    });
  });
}

// =================== Bulk-assign ===================
async function bulkAssignModal() {
  const [{ programs }, { clients }] = await Promise.all([api("/api/programs"), api("/api/clients")]);
  if (!programs.length || !clients.length) return toast("Нужны хотя бы одна программа и один клиент");
  openModal("Назначить нескольким клиентам", `
    <form id="form-bulk">
      <label>Программа</label>
      <select name="program_id" class="ios-select" required>${programs.filter((p) => !p.is_archived).map((p) => `<option value="${p.id}">${escape(p.name)}</option>`).join("")}</select>
      <label>Клиенты (можно несколько)</label>
      <div class="bulk-clients">
        ${clients.map((c) => `<label class="checkbox-row"><input type="checkbox" name="client" value="${c.id}"> ${escape(c.name)}</label>`).join("")}
      </div>
      <label>Дата начала</label>
      <input type="date" name="start_date">
      <div class="form-actions">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Назначить всем</button>
      </div>
    </form>`);
  $("#form-bulk").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      program_id: +fd.get("program_id"),
      client_ids: fd.getAll("client").map(Number),
      start_date: fd.get("start_date") || undefined,
    };
    if (!body.client_ids.length) return toast("Выбери хотя бы одного клиента");
    try {
      const r = await api("/api/assignments/bulk", { method: "POST", body });
      closeModal(); toast(`Назначено ${r.created}`); renderAssignments();
    } catch (e) { toast(e.message); }
  });
}

// =================== Plate calculator ===================
function plateCalcModal() {
  openModal("Блины на штангу", `
    <p class="muted small">Сколько блинов навешать на штангу. Стандартные диски: 20, 15, 10, 5, 2.5, 1.25, 0.5 кг.</p>
    <div class="row-inputs">
      <div><label>Целевой вес</label><input type="number" id="plate-target" step="0.5" placeholder="80"></div>
      <div><label>Гриф, кг</label><input type="number" id="plate-bar" value="20"></div>
    </div>
    <div id="plate-result" class="card" style="margin-top:14px; text-align:center;"></div>`);
  const calc = () => {
    const target = +$("#plate-target").value;
    const bar = +$("#plate-bar").value || 20;
    if (!target) { $("#plate-result").innerHTML = ""; return; }
    const perSide = (target - bar) / 2;
    if (perSide < 0) { $("#plate-result").innerHTML = `<p class="muted">Целевой вес меньше грифа.</p>`; return; }
    const plates = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
    let remain = perSide;
    const usage = {};
    plates.forEach((p) => {
      const n = Math.floor(remain / p);
      if (n) usage[p] = n;
      remain = +(remain - n * p).toFixed(2);
    });
    const list = Object.entries(usage).map(([p, n]) => `${n} × <strong>${p} кг</strong>`).join(" + ") || "—";
    const total = bar + 2 * (perSide - remain);
    $("#plate-result").innerHTML = `
      <div class="hero-eyebrow">На каждую сторону</div>
      <div class="stat-value" style="font-size:30px; margin:6px 0;">${list}</div>
      ${remain > 0 ? `<p class="muted small">Не хватает ${remain} кг — таких дисков нет.</p>` : `<p class="muted small">Итого: ${total} кг на штанге.</p>`}
      <div class="plate-vis">${plateVis(usage)}</div>`;
  };
  $("#plate-target").addEventListener("input", calc);
  $("#plate-bar").addEventListener("input", calc);
}

function plateVis(usage) {
  const colors = { 25: "#ef4444", 20: "#2563eb", 15: "#fbbf24", 10: "#16a34a", 5: "#fff", 2.5: "#0ea5e9", 1.25: "#a3a3a3", 0.5: "#6b7280" };
  const sizes = { 25: 56, 20: 50, 15: 44, 10: 38, 5: 30, 2.5: 26, 1.25: 22, 0.5: 18 };
  let html = `<div class="plates-row">`;
  // mirror layout: outer to inner
  const order = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
  const left = [];
  for (const p of order.slice().reverse()) {
    if (usage[p]) for (let i = 0; i < usage[p]; i++) left.push(p);
  }
  html += left.map((p) => `<span class="plate" style="background:${colors[p]};width:14px;height:${sizes[p]}px;"></span>`).join("");
  html += `<span class="bar"></span>`;
  // right mirrored
  html += left.slice().reverse().map((p) => `<span class="plate" style="background:${colors[p]};width:14px;height:${sizes[p]}px;"></span>`).join("");
  html += `</div>`;
  return html;
}

// =================== Theme toggle ===================
const THEME_KEY = "fit-theme";
function applyTheme(t) {
  document.documentElement.dataset.theme = t === "auto" ? "" : t;
  document.documentElement.style.colorScheme = t === "auto" ? "light dark" : t;
}
function toggleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || "auto";
  const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  toast(next === "auto" ? "Системная тема" : next === "light" ? "Светлая" : "Тёмная");
}
applyTheme(localStorage.getItem(THEME_KEY) || "auto");

// =================== Export program ===================
function exportProgramModal(programId) {
  const url = `/api/programs/${programId}/export?format=`;
  window.open(url + "csv", "_blank");
}

// =================== SW registration ===================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// =================== Boot ===================
bootstrap();
