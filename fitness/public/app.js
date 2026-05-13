// ============================================================
// Fitness Trainer — клиентская логика (vanilla JS).
// Один SPA: после логина показывает либо кабинет тренера, либо клиента.
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  user: null,
  cache: {},
};

const DOW_NAMES = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// -------------------- API helpers --------------------
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

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2400);
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// -------------------- Modal helpers --------------------
function openModal(title, bodyHtml) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = bodyHtml;
  $("#modal").hidden = false;
}
function closeModal() { $("#modal").hidden = true; $("#modal-body").innerHTML = ""; }

// -------------------- Screens routing --------------------
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

// -------------------- Login --------------------
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

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.matches("[data-action='logout']")) {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    showScreen("login-screen");
    $("#login-code").value = "";
  }
  if (t.matches("[data-action='close-modal']") || t === $("#modal")) closeModal();
});

// -------------------- Tabs --------------------
document.addEventListener("click", (e) => {
  if (!e.target.matches(".tab")) return;
  const tab = e.target.dataset.tab;
  const root = e.target.closest(".screen");
  $$(".tab", root).forEach((b) => b.classList.toggle("active", b === e.target));
  $$(".tab-panel", root).forEach((p) => p.classList.toggle("active", p.id === tab));
  // Лениво подгружаем содержимое
  if (tab === "t-programs") renderPrograms();
  if (tab === "t-assignments") renderAssignments();
  if (tab === "c-week") renderWeek();
  if (tab === "c-history") renderHistory();
});

// ============================================================
// ============= КАБИНЕТ ТРЕНЕРА ==============================
// ============================================================
function enterTrainer() {
  showScreen("trainer-screen");
  $("#trainer-name").textContent = state.user.name;
  renderClients();
}

// ----- Клиенты -----
async function renderClients() {
  const { clients } = await api("/api/clients");
  state.cache.clients = clients;
  const list = $("#clients-list");
  if (!clients.length) {
    list.innerHTML = `<p class="muted">Пока нет клиентов. Нажми «+ Клиент», чтобы добавить.</p>`;
    return;
  }
  list.innerHTML = clients.map((c) => `
    <div class="card" data-client="${c.id}">
      <div class="card-row">
        <div>
          <h3>${escape(c.name)}</h3>
          ${c.notes ? `<p>${escape(c.notes)}</p>` : ""}
          <div class="meta">с ${c.created_at?.slice(0,10) || "—"}</div>
        </div>
        <div style="display:flex; gap:6px; flex-direction:column;">
          <button class="small" data-action="open-client" data-id="${c.id}">Открыть</button>
          <button class="small ghost" data-action="edit-client" data-id="${c.id}">Изменить</button>
        </div>
      </div>
    </div>`).join("");
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.matches("[data-action='add-client']")) addClientModal();
  if (t.matches("[data-action='edit-client']")) editClientModal(+t.dataset.id);
  if (t.matches("[data-action='open-client']")) openClientSummary(+t.dataset.id);
  if (t.matches("[data-action='add-program']")) addProgramModal();
  if (t.matches("[data-action='open-program']")) openProgramEditor(+t.dataset.id);
  if (t.matches("[data-action='delete-program']")) deleteProgram(+t.dataset.id);
  if (t.matches("[data-action='add-exercise']")) addExerciseModal(+t.dataset.programId);
  if (t.matches("[data-action='edit-exercise']")) editExerciseModal(+t.dataset.id);
  if (t.matches("[data-action='delete-exercise']")) deleteExercise(+t.dataset.id, +t.dataset.programId);
  if (t.matches("[data-action='add-assignment']")) addAssignmentModal();
  if (t.matches("[data-action='toggle-assignment']")) toggleAssignment(+t.dataset.id, t.dataset.active === "1");
  if (t.matches("[data-action='delete-assignment']")) deleteAssignment(+t.dataset.id);
});

function addClientModal() {
  openModal("Новый клиент", `
    <form id="form-client">
      <label>Имя клиента</label>
      <input name="name" required>
      <label>Код доступа (минимум 4 символа)</label>
      <input name="code" required minlength="4" autocomplete="off">
      <label>Заметка (необязательно)</label>
      <textarea name="notes" rows="2"></textarea>
      <div class="row" style="margin-top:14px;">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Создать</button>
      </div>
    </form>
  `);
  $("#form-client").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/api/clients", { method: "POST", body: Object.fromEntries(fd) });
      closeModal(); toast("Клиент создан"); renderClients();
    } catch (e) { toast(e.message); }
  });
}

function editClientModal(id) {
  const c = state.cache.clients.find((x) => x.id === id);
  if (!c) return;
  openModal(`Изменить: ${c.name}`, `
    <form id="form-client-edit">
      <label>Имя</label><input name="name" value="${escape(c.name)}">
      <label>Новый код (оставить пустым — без изменений)</label><input name="code" autocomplete="off">
      <label>Заметка</label><textarea name="notes" rows="2">${escape(c.notes || "")}</textarea>
      <div class="row" style="margin-top:14px;">
        <button class="danger" type="button" id="btn-del-client">Удалить</button>
        <button type="submit">Сохранить</button>
      </div>
    </form>
  `);
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
    if (!confirm(`Удалить клиента «${c.name}»? Журнал и назначения тоже удалятся.`)) return;
    await api(`/api/clients/${id}`, { method: "DELETE" });
    closeModal(); toast("Удалён"); renderClients();
  });
}

async function openClientSummary(id) {
  try {
    const { client, assignments, recent, daily } = await api(`/api/clients/${id}/summary`);
    const last30 = daily.length ? daily.map((d) => `${d.log_date.slice(5)}: ${d.done_count}`).join(" · ") : "пока пусто";
    openModal(`Клиент: ${escape(client.name)}`, `
      <div class="card"><strong>Активные программы</strong><div class="list" style="margin-top:8px;">
        ${assignments.filter(a=>a.is_active).map(a=>`
          <div class="card-row">
            <div>
              <div>${escape(a.name)}</div>
              <div class="meta">с ${a.start_date}${a.end_date?` по ${a.end_date}`:""}</div>
            </div>
          </div>`).join("") || `<p class="muted">Нет активных назначений.</p>`}
      </div></div>
      <div class="card" style="margin-top:10px;">
        <strong>За последние 30 дней:</strong>
        <div class="meta" style="margin-top:6px;">${last30}</div>
      </div>
      <div class="card" style="margin-top:10px;">
        <strong>Последние тренировки</strong>
        <div class="list" style="margin-top:8px;">
          ${recent.length ? recent.map(r=>`
            <div class="card-row">
              <div>
                <div>${escape(r.exercise_name)}</div>
                <div class="meta">${r.log_date} · ${r.done_sets ?? "?"}×${r.done_reps ?? "?"} ${r.done_weight ? `· ${r.done_weight} кг`:""}</div>
                ${r.client_note ? `<div class="meta">📝 ${escape(r.client_note)}</div>` : ""}
              </div>
              <span class="tagline ${r.completed?"ok":"warn"}">${r.completed?"✓":"—"}</span>
            </div>
          `).join("") : `<p class="muted">Клиент ещё ничего не записал.</p>`}
        </div>
      </div>
    `);
  } catch (e) { toast(e.message); }
}

// ----- Программы -----
async function renderPrograms() {
  const { programs } = await api("/api/programs");
  state.cache.programs = programs;
  const list = $("#programs-list");
  if (!programs.length) {
    list.innerHTML = `<p class="muted">Нет программ. Создай первую — добавишь туда упражнения.</p>`;
    return;
  }
  list.innerHTML = programs.map((p) => `
    <div class="card">
      <div class="card-row">
        <div>
          <h3>${escape(p.name)}</h3>
          ${p.description ? `<p>${escape(p.description)}</p>` : ""}
          <div class="meta">упражнений: ${p.exercises_count} · активных назначений: ${p.active_assignments}</div>
        </div>
        <div style="display:flex; gap:6px; flex-direction:column;">
          <button class="small" data-action="open-program" data-id="${p.id}">Упражнения</button>
          <button class="small ghost danger" data-action="delete-program" data-id="${p.id}">Удалить</button>
        </div>
      </div>
    </div>`).join("");
}

function addProgramModal() {
  openModal("Новая программа", `
    <form id="form-program">
      <label>Название</label><input name="name" required>
      <label>Описание</label><textarea name="description" rows="3"></textarea>
      <div class="row" style="margin-top:14px;">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Создать</button>
      </div>
    </form>
  `);
  $("#form-program").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      await api("/api/programs", { method: "POST", body });
      closeModal(); toast("Программа создана"); renderPrograms();
    } catch (e) { toast(e.message); }
  });
}

async function deleteProgram(id) {
  if (!confirm("Удалить программу со всеми упражнениями и назначениями?")) return;
  await api(`/api/programs/${id}`, { method: "DELETE" });
  toast("Удалено"); renderPrograms();
}

async function openProgramEditor(programId) {
  const data = await api(`/api/programs/${programId}`);
  state.cache.exercises = data.exercises;
  const body = `
    <p class="muted">${escape(data.program.description || "")}</p>
    <div class="row"><button data-action="add-exercise" data-program-id="${programId}">+ Упражнение</button></div>
    <div class="list" id="exercises-list" style="margin-top:10px;">
      ${data.exercises.map((e) => exerciseCardHtml(e, programId)).join("") || `<p class="muted">Пока нет упражнений.</p>`}
    </div>
  `;
  openModal(`Программа: ${escape(data.program.name)}`, body);
}

function exerciseCardHtml(e, programId) {
  return `
    <div class="card">
      <div class="card-row">
        <div>
          <h3>
            ${e.day_of_week ? `<span class="dow">${DOW_NAMES[e.day_of_week]}</span>` : `<span class="dow">любой день</span>`}
            ${escape(e.name)}
          </h3>
          <div class="meta">
            ${e.target_sets ? `${e.target_sets}×` : ""}${escape(e.target_reps || "")}${e.target_weight ? ` · ${escape(e.target_weight)}` : ""}${e.rest_seconds ? ` · отдых ${e.rest_seconds}с` : ""}
          </div>
          ${e.description ? `<p>${escape(e.description)}</p>` : ""}
          ${e.video_url ? `<div class="meta"><a href="${escape(e.video_url)}" target="_blank">🎬 видео</a></div>` : ""}
        </div>
        <div style="display:flex; gap:6px; flex-direction:column;">
          <button class="small ghost" data-action="edit-exercise" data-id="${e.id}">Изменить</button>
          <button class="small danger" data-action="delete-exercise" data-id="${e.id}" data-program-id="${programId}">×</button>
        </div>
      </div>
    </div>`;
}

function exerciseFormHtml(e = {}) {
  return `
    <label>Название</label><input name="name" value="${escape(e.name || "")}" required>
    <label>Описание / техника</label><textarea name="description" rows="2">${escape(e.description || "")}</textarea>
    <label>Видео-ссылка (YouTube, mp4, и т.п.)</label><input name="video_url" value="${escape(e.video_url || "")}" placeholder="https://...">
    <div class="row">
      <div>
        <label>Подходы</label><input name="target_sets" type="number" min="1" value="${e.target_sets ?? ""}">
      </div>
      <div>
        <label>Повторы</label><input name="target_reps" value="${escape(e.target_reps || "")}" placeholder="8-12 / до отказа">
      </div>
    </div>
    <div class="row">
      <div>
        <label>Вес</label><input name="target_weight" value="${escape(e.target_weight || "")}" placeholder="60 кг / своим весом">
      </div>
      <div>
        <label>Отдых, сек</label><input name="rest_seconds" type="number" min="0" value="${e.rest_seconds ?? ""}">
      </div>
    </div>
    <div class="row">
      <div>
        <label>День недели</label>
        <select name="day_of_week">
          <option value="">любой день</option>
          ${[1,2,3,4,5,6,7].map(d=>`<option value="${d}" ${e.day_of_week===d?"selected":""}>${DOW_NAMES[d]}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Порядок</label><input name="order_index" type="number" min="0" value="${e.order_index ?? 0}">
      </div>
    </div>
  `;
}

function addExerciseModal(programId) {
  openModal("Новое упражнение", `
    <form id="form-ex">${exerciseFormHtml()}
      <div class="row" style="margin-top:14px;">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Добавить</button>
      </div>
    </form>`);
  $("#form-ex").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = formToBody(e.target);
    try {
      await api(`/api/programs/${programId}/exercises`, { method: "POST", body });
      closeModal(); toast("Упражнение добавлено"); openProgramEditor(programId);
    } catch (e) { toast(e.message); }
  });
}

function editExerciseModal(id) {
  const ex = state.cache.exercises.find((x) => x.id === id);
  if (!ex) return;
  openModal(`Изменить: ${ex.name}`, `
    <form id="form-ex">${exerciseFormHtml(ex)}
      <div class="row" style="margin-top:14px;">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Сохранить</button>
      </div>
    </form>`);
  $("#form-ex").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = formToBody(e.target);
    try {
      const programId = state.cache.exercises.find(x=>x.id===id) ? null : null;
      await api(`/api/exercises/${id}`, { method: "PUT", body });
      closeModal(); toast("Сохранено");
      // Перерисуем редактор программы (узнаём program_id через закрытие/повторное открытие).
      // Простой путь — если знаем program_id из state (мы знаем из cache), но cache.exercises не содержит program_id.
      // Перезагрузим текущее состояние: открыта последняя программа.
      if (state.cache.lastProgramId) openProgramEditor(state.cache.lastProgramId);
    } catch (e) { toast(e.message); }
  });
}

async function deleteExercise(id, programId) {
  if (!confirm("Удалить упражнение?")) return;
  await api(`/api/exercises/${id}`, { method: "DELETE" });
  toast("Удалено"); openProgramEditor(programId);
}

function formToBody(form) {
  const obj = Object.fromEntries(new FormData(form));
  // числовые поля
  ["target_sets", "rest_seconds", "day_of_week", "order_index"].forEach((k) => {
    if (obj[k] === "" || obj[k] === undefined) obj[k] = null;
    else if (obj[k] != null) obj[k] = Number(obj[k]);
  });
  return obj;
}

// Запоминаем, какая программа открыта в редакторе, чтобы перерисовать список упражнений после правки.
const _openProgramEditor = openProgramEditor;
openProgramEditor = async function (id) {
  state.cache.lastProgramId = id;
  return _openProgramEditor(id);
};

// ----- Назначения -----
async function renderAssignments() {
  const { assignments } = await api("/api/assignments");
  state.cache.assignments = assignments;
  const list = $("#assignments-list");
  if (!assignments.length) {
    list.innerHTML = `<p class="muted">Нет назначений. Нажми «+ Назначить», чтобы связать программу с клиентом.</p>`;
    return;
  }
  list.innerHTML = assignments.map((a) => `
    <div class="card">
      <div class="card-row">
        <div>
          <h3>${escape(a.program_name)} → ${escape(a.client_name)}</h3>
          <div class="meta">с ${a.start_date}${a.end_date?` по ${a.end_date}`:""} ·
            <span class="tagline ${a.is_active?"ok":"warn"}">${a.is_active?"активно":"архив"}</span>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-direction:column;">
          <button class="small ghost" data-action="toggle-assignment" data-id="${a.id}" data-active="${a.is_active?0:1}">
            ${a.is_active?"Снять":"Возобновить"}
          </button>
          <button class="small danger" data-action="delete-assignment" data-id="${a.id}">×</button>
        </div>
      </div>
    </div>`).join("");
}

async function addAssignmentModal() {
  const [progs, cls] = await Promise.all([
    state.cache.programs ? Promise.resolve({ programs: state.cache.programs }) : api("/api/programs"),
    state.cache.clients ? Promise.resolve({ clients: state.cache.clients }) : api("/api/clients"),
  ]);
  if (!progs.programs.length || !cls.clients.length) {
    return toast("Сначала создай хотя бы одну программу и одного клиента.");
  }
  openModal("Назначить программу", `
    <form id="form-asg">
      <label>Программа</label>
      <select name="program_id" required>${progs.programs.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join("")}</select>
      <label>Клиент</label>
      <select name="client_id" required>${cls.clients.map(c=>`<option value="${c.id}">${escape(c.name)}</option>`).join("")}</select>
      <div class="row">
        <div><label>Дата начала</label><input name="start_date" type="date"></div>
        <div><label>Дата окончания (опционально)</label><input name="end_date" type="date"></div>
      </div>
      <div class="row" style="margin-top:14px;">
        <button class="ghost" type="button" data-action="close-modal">Отмена</button>
        <button type="submit">Назначить</button>
      </div>
    </form>
  `);
  $("#form-asg").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.program_id = +body.program_id;
    body.client_id = +body.client_id;
    if (!body.start_date) delete body.start_date;
    if (!body.end_date) delete body.end_date;
    try {
      await api("/api/assignments", { method: "POST", body });
      closeModal(); toast("Назначено"); renderAssignments();
    } catch (e) { toast(e.message); }
  });
}

async function toggleAssignment(id, makeActive) {
  await api(`/api/assignments/${id}`, { method: "PATCH", body: { is_active: makeActive } });
  toast("Готово"); renderAssignments();
}

async function deleteAssignment(id) {
  if (!confirm("Удалить назначение?")) return;
  await api(`/api/assignments/${id}`, { method: "DELETE" });
  toast("Удалено"); renderAssignments();
}

// ============================================================
// ============= КАБИНЕТ КЛИЕНТА ==============================
// ============================================================
function enterClient() {
  showScreen("client-screen");
  $("#client-name").textContent = state.user.name;
  renderToday();
}

async function renderToday() {
  const { date, day_of_week, items } = await api("/api/today");
  $("#today-title").textContent = `Сегодня — ${DOW_NAMES[day_of_week]}, ${date}`;
  const list = $("#today-list");
  if (!items.length) {
    list.innerHTML = `<p class="muted">На сегодня упражнений нет. Если ждёшь программу — напиши тренеру.</p>`;
    return;
  }
  list.innerHTML = items.map(todayItemHtml).join("");
  // подгружаем комментарии для каждой плитки
  items.forEach((it) => loadComments(it.exercise_id));
}

function todayItemHtml(it) {
  const log = it.today_log ? JSON.parse(it.today_log) : null;
  const done = !!(log && log.completed);
  return `
    <div class="exercise ${done?"done":""}" data-ex="${it.exercise_id}" data-asg="${it.assignment_id}">
      <h3>
        ${it.day_of_week ? `<span class="dow">${DOW_NAMES[it.day_of_week]}</span>` : `<span class="dow">любой день</span>`}
        ${escape(it.name)}
        ${done ? `<span class="tagline ok">✓ выполнено</span>` : ""}
      </h3>
      <div class="target">
        ${it.target_sets?`${it.target_sets}×`:""}${escape(it.target_reps||"")}${it.target_weight?` · ${escape(it.target_weight)}`:""}${it.rest_seconds?` · отдых ${it.rest_seconds}с`:""}
      </div>
      ${it.description ? `<p class="small">${escape(it.description)}</p>` : ""}
      ${videoEmbed(it.video_url)}
      <div class="inputs">
        <input type="number" min="0" step="1" placeholder="подходы" data-field="done_sets" value="${log?.done_sets ?? ""}">
        <input type="text" placeholder="повторы" data-field="done_reps" value="${log?.done_reps ?? ""}">
        <input type="number" min="0" step="0.5" placeholder="вес, кг" data-field="done_weight" value="${log?.done_weight ?? ""}">
      </div>
      <textarea rows="1" placeholder="заметка (как себя чувствовал, что заметил)" data-field="client_note">${escape(log?.client_note || "")}</textarea>
      <div class="actions">
        <button data-action="log-done">${done?"Перезаписать":"Отметить выполненным"}</button>
        <button class="ghost" data-action="toggle-chat">💬 Чат с тренером</button>
      </div>
      <div class="chat" data-chat hidden></div>
    </div>`;
}

function videoEmbed(url) {
  if (!url) return "";
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `<div class="video"><iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe></div>`;
  // прямое mp4
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return `<div class="video"><video controls src="${escape(url)}" style="width:100%; border-radius:10px;"></video></div>`;
  }
  return `<div class="meta"><a href="${escape(url)}" target="_blank">🎬 Открыть видео</a></div>`;
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  const card = t.closest(".exercise");
  if (!card) return;
  if (t.matches("[data-action='log-done']")) {
    const body = {
      assignment_id: +card.dataset.asg,
      exercise_id: +card.dataset.ex,
      done_sets: numOrNull($("[data-field='done_sets']", card).value),
      done_reps: $("[data-field='done_reps']", card).value || null,
      done_weight: numOrNull($("[data-field='done_weight']", card).value),
      client_note: $("[data-field='client_note']", card).value || null,
      completed: true,
    };
    try {
      await api("/api/workouts", { method: "POST", body });
      toast("Отмечено"); renderToday();
    } catch (e) { toast(e.message); }
  }
  if (t.matches("[data-action='toggle-chat']")) {
    const chat = $("[data-chat]", card);
    chat.hidden = !chat.hidden;
    if (!chat.hidden) loadComments(+card.dataset.ex, chat);
  }
  if (t.matches("[data-action='send-comment']")) {
    const chat = t.closest("[data-chat]");
    const input = $("input[data-comment]", chat);
    const text = input.value.trim();
    if (!text) return;
    const exId = +card.dataset.ex;
    try {
      await api("/api/comments", { method: "POST", body: { exercise_id: exId, body: text } });
      input.value = "";
      loadComments(exId, chat);
    } catch (e) { toast(e.message); }
  }
});

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

async function loadComments(exerciseId, chatEl) {
  const cards = $$(`.exercise[data-ex="${exerciseId}"]`);
  const params = new URLSearchParams({ exercise_id: exerciseId });
  if (state.user.role === "trainer") return; // в "сегодня" для клиента
  let comments = [];
  try {
    const data = await api(`/api/comments?${params}`);
    comments = data.comments || [];
  } catch {}
  cards.forEach((card) => {
    const el = chatEl || $("[data-chat]", card);
    if (!el) return;
    el.innerHTML = `
      ${comments.length ? comments.map(c => `
        <div class="bubble ${c.author_id === state.user.id ? "mine" : ""}">
          <div class="who">${escape(c.author_name)} · ${c.created_at.slice(0,16).replace("T"," ")}</div>
          ${escape(c.body)}
        </div>`).join("") : `<p class="muted small">Сообщений пока нет.</p>`}
      <div class="row" style="margin-top:6px;">
        <input data-comment placeholder="Написать тренеру…" autocomplete="off">
        <button class="small" data-action="send-comment">→</button>
      </div>`;
  });
}

// ----- Неделя (клиент) -----
async function renderWeek() {
  // Возьмём все активные программы клиента и разложим упражнения по дням.
  const { assignments } = await api("/api/assignments");
  const active = assignments.filter(a => a.is_active);
  const wrap = $("#week-list");
  if (!active.length) {
    wrap.innerHTML = `<p class="muted">У тебя пока нет активных программ.</p>`;
    return;
  }
  // Подтянем упражнения каждой программы
  const programs = await Promise.all(active.map(a => api(`/api/programs/${a.program_id}`)));
  // Группируем по дню недели
  const byDay = { 1:[],2:[],3:[],4:[],5:[],6:[],7:[],"any":[] };
  programs.forEach((p, i) => {
    p.exercises.forEach((e) => {
      const dow = e.day_of_week || "any";
      byDay[dow].push({ ...e, program_name: active[i].program_name });
    });
  });
  wrap.innerHTML = [1,2,3,4,5,6,7,"any"].map((d) => {
    const items = byDay[d];
    if (!items.length) return "";
    const title = d === "any" ? "Любой день" : DOW_NAMES[d];
    return `<div class="card">
      <h3>${title}</h3>
      <div class="list" style="margin-top:8px;">
        ${items.map(e => `<div class="card-row">
          <div>
            <div>${escape(e.name)} <span class="meta">· ${escape(e.program_name)}</span></div>
            <div class="meta">${e.target_sets?`${e.target_sets}×`:""}${escape(e.target_reps||"")}${e.target_weight?` · ${escape(e.target_weight)}`:""}</div>
          </div>
        </div>`).join("")}
      </div>
    </div>`;
  }).join("");
}

// ----- История + график (клиент) -----
async function renderHistory() {
  // соберём список упражнений из активных программ
  const { assignments } = await api("/api/assignments");
  const active = assignments.filter(a => a.is_active);
  const programs = await Promise.all(active.map(a => api(`/api/programs/${a.program_id}`)));
  const exs = [];
  programs.forEach((p, i) => p.exercises.forEach(e => exs.push({ id: e.id, name: `${e.name} (${active[i].program_name})` })));
  const sel = $("#history-exercise");
  if (!exs.length) {
    sel.innerHTML = `<option>Нет упражнений</option>`;
    $("#history-table").innerHTML = `<p class="muted">Активных программ нет.</p>`;
    drawChart([]);
    return;
  }
  sel.innerHTML = exs.map(e => `<option value="${e.id}">${escape(e.name)}</option>`).join("");
  sel.onchange = () => loadHistory(+sel.value);
  loadHistory(+sel.value);
}

async function loadHistory(exerciseId) {
  const { history } = await api(`/api/progress?exercise_id=${exerciseId}`);
  drawChart(history);
  const tbl = $("#history-table");
  tbl.innerHTML = history.length ? history.slice().reverse().map(h => `
    <div class="card-row">
      <div>
        <div>${h.log_date}</div>
        <div class="meta">${h.done_sets ?? "?"}×${h.done_reps ?? "?"} ${h.done_weight ? `· ${h.done_weight} кг` : ""}</div>
        ${h.client_note ? `<div class="meta">📝 ${escape(h.client_note)}</div>` : ""}
      </div>
      <span class="tagline ${h.completed?"ok":"warn"}">${h.completed?"✓":"—"}</span>
    </div>
  `).join("") : `<p class="muted">Записей пока нет.</p>`;
}

function drawChart(history) {
  const cnv = $("#history-chart");
  const ctx = cnv.getContext("2d");
  const w = cnv.width = cnv.clientWidth;
  const h = cnv.height = 240;
  ctx.clearRect(0, 0, w, h);
  const pts = history.filter(x => x.done_weight != null).map(x => ({ d: x.log_date, v: +x.done_weight }));
  if (pts.length < 1) {
    ctx.fillStyle = "#8da0c2";
    ctx.font = "14px -apple-system, system-ui, sans-serif";
    ctx.fillText("Введи фактический вес хотя бы раз — и здесь появится график.", 16, 30);
    return;
  }
  const pad = 28;
  const minV = Math.min(...pts.map(p => p.v));
  const maxV = Math.max(...pts.map(p => p.v));
  const rangeV = Math.max(1, maxV - minV);
  // оси
  ctx.strokeStyle = "#243352"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h - pad); ctx.lineTo(w - pad, h - pad); ctx.stroke();
  // линия
  ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.v - minV) / rangeV) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // точки + подписи
  ctx.fillStyle = "#22c55e";
  pts.forEach((p, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.v - minV) / rangeV) * (h - pad * 2);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
  });
  ctx.fillStyle = "#8da0c2"; ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillText(`${maxV} кг`, 4, pad + 4);
  ctx.fillText(`${minV} кг`, 4, h - pad);
  ctx.fillText(pts[0].d.slice(5), pad, h - 8);
  ctx.fillText(pts[pts.length - 1].d.slice(5), w - pad - 30, h - 8);
}

// поехали
bootstrap();
