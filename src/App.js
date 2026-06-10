import { useState, useEffect, useCallback } from "react";

// ─── 设计令牌 ──────────────────────────────────────────────────────
const C = {
  bg: "#F5F7FA",
  card: "#FFFFFF",
  primary: "#1B6CF2",
  primaryLight: "#E8F0FE",
  primaryDark: "#1456C8",
  accent: "#FF5A5A",
  accentLight: "#FFF0F0",
  success: "#10B97B",
  successLight: "#E6FAF3",
  warn: "#F59E0B",
  warnLight: "#FFFBEB",
  purple: "#8B5CF6",
  purpleLight: "#F3EFFE",
  gray: "#6B7A99",
  grayLight: "#F0F2F7",
  border: "#E4E9F2",
  text: "#111827",
  textSub: "#6B7A99",
  shadow: "0 2px 12px rgba(0,0,0,0.07)",
  shadowMd: "0 4px 24px rgba(0,0,0,0.11)",
};

const STATUS = {
  success: { label: "已成交", color: C.success, bg: C.successLight, icon: "✅" },
  following: { label: "跟进中", color: C.warn, bg: C.warnLight, icon: "🔔" },
  failed: { label: "营销失败", color: C.accent, bg: C.accentLight, icon: "❌" },
  pending: { label: "待联系", color: C.purple, bg: C.purpleLight, icon: "⏳" },
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { if (!d) return ""; const [, m, day] = d.split("-"); return `${m}/${day}`; };
const pct = (a, b) => (b === 0 ? "0%" : Math.round((a / b) * 100) + "%");

// ─── 默认数据 ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  cardTypes: ["京贝体验会员卡", "京贝年度会员卡"],
  teams: [
    { id: "t1", name: "红队", members: ["王小明", "李华"] },
    { id: "t2", name: "蓝队", members: ["张芳", "赵磊"] },
    { id: "t3", name: "绿队", members: ["陈静", "刘阳"] },
  ],
};

const SAMPLE = [
  { id: 1, name: "张小宝", phone: "13800001111", staff: "王小明", teamId: "t1", date: today(), card: "京贝体验会员卡", status: "success", failReason: "", followNote: "", followStaff: "王小明" },
  { id: 2, name: "李彤彤", phone: "13900002222", staff: "张芳", teamId: "t2", date: today(), card: "京贝体验会员卡", status: "following", failReason: "", followNote: "已发微信，等回复", followStaff: "张芳" },
  { id: 3, name: "王大毛", phone: "13700003333", staff: "陈静", teamId: "t3", date: today(), card: "京贝年度会员卡", status: "failed", failReason: "价格太贵，暂不考虑", followNote: "", followStaff: "陈静" },
  { id: 4, name: "赵小花", phone: "13600004444", staff: "李华", teamId: "t1", date: today(), card: "京贝体验会员卡", status: "pending", failReason: "", followNote: "", followStaff: "李华" },
];

// ─── 工具组件 ──────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color, fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.icon} {s.label}
    </span>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "success" ? C.success : toast.type === "error" ? C.accent : C.primary;
  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: bg, color: "#fff", padding: "11px 22px", borderRadius: 30, fontSize: 14, fontWeight: 600, boxShadow: C.shadowMd, zIndex: 500, whiteSpace: "nowrap", pointerEvents: "none" }}>
      {toast.text}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>{label}</label>}
      <input {...props} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", background: "#fff", color: C.text, ...(props.style || {}) }} />
    </div>
  );
}

function Btn({ children, onClick, color = C.primary, outline, style, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? "6px 14px" : "11px 20px", borderRadius: 10, border: outline ? `1.5px solid ${color}` : "none",
      background: outline ? "#fff" : color, color: outline ? color : "#fff",
      fontSize: small ? 13 : 15, fontWeight: 600, cursor: "pointer", ...(style || {})
    }}>{children}</button>
  );
}

// ─── 主应用 ───────────────────────────────────────────────────────
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);
  const [ready, setReady] = useState(false);
  const [dailyModal, setDailyModal] = useState(false);
  const [dupModal, setDupModal] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [filterTeam, setFilterTeam] = useState("全部");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [searchQ, setSearchQ] = useState("");
  const [pendingForm, setPendingForm] = useState(null);

  // 表单
  const blankForm = () => ({ name: "", phone: "", staff: "", teamId: "", date: today(), card: settings.cardTypes[0] || "", status: "pending", failReason: "", followNote: "", followStaff: "" });
  const [form, setForm] = useState(blankForm());
  const [addOpen, setAddOpen] = useState(false);

  // ── 加载 ──
  useEffect(() => {
    try {
      const c = localStorage.getItem("jb_customers");
      const s = localStorage.getItem("jb_settings");
      if (c) setCustomers(JSON.parse(c)); else setCustomers(SAMPLE);
      if (s) setSettings(JSON.parse(s));
    } catch { setCustomers(SAMPLE); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const f = customers.filter(c => c.status === "following");
    if (f.length > 0) setDailyModal(true);
  }, [ready, customers]);

  const saveC = useCallback((data) => { try { localStorage.setItem("jb_customers", JSON.stringify(data)); } catch {} }, []);
  const saveS = useCallback((data) => { try { localStorage.setItem("jb_settings", JSON.stringify(data)); } catch {} }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2800);
  };

  // ── 所有员工列表 ──
  const allStaff = settings.teams.flatMap(t => t.members.map(m => ({ name: m, teamId: t.id, teamName: t.name })));
  const teamName = (id) => settings.teams.find(t => t.id === id)?.name || "未知";

  // ── 添加顾客 ──
  const openAdd = () => {
    const f = blankForm();
    if (allStaff.length > 0) { f.staff = allStaff[0].name; f.teamId = allStaff[0].teamId; f.followStaff = allStaff[0].name; }
    if (settings.cardTypes.length > 0) f.card = settings.cardTypes[0];
    setForm(f);
    setAddOpen(true);
    setTab("add");
  };

  const handleStaffChange = (name) => {
    const s = allStaff.find(x => x.name === name);
    setForm(f => ({ ...f, staff: name, teamId: s ? s.teamId : f.teamId, followStaff: name }));
  };

  const handleAdd = (force = false) => {
    if (!form.name.trim()) { showToast("error", "请填写顾客姓名"); return; }
    if (!form.phone.trim()) { showToast("error", "请填写手机号"); return; }
    if (!/^1\d{10}$/.test(form.phone)) { showToast("error", "手机号格式不正确"); return; }
    if (form.status === "failed" && !form.failReason.trim()) { showToast("error", "请填写营销失败原因"); return; }

    const dup = customers.find(c => c.phone === form.phone);
    if (dup && !force) {
      setDupModal(dup);
      setPendingForm({ ...form });
      return;
    }

    const newC = { id: Date.now(), ...form, name: form.name.trim() };
    const updated = [newC, ...customers];
    setCustomers(updated); saveC(updated);
    showToast("success", `已添加：${newC.name}`);
    setAddOpen(false);
    setTab("home");
  };

  const confirmDup = () => {
    if (!pendingForm) return;
    const newC = { id: Date.now(), ...pendingForm, name: pendingForm.name.trim() };
    const updated = [newC, ...customers];
    setCustomers(updated); saveC(updated);
    showToast("success", `已强制添加：${newC.name}`);
    setDupModal(null); setPendingForm(null);
    setAddOpen(false); setTab("home");
  };

  // ── 更新顾客 ──
  const updateCustomer = (id, patch) => {
    const updated = customers.map(c => c.id === id ? { ...c, ...patch } : c);
    setCustomers(updated); saveC(updated);
  };

  const deleteCustomer = (id) => {
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated); saveC(updated);
    setDetailId(null);
    showToast("success", "已删除");
  };

  // ── 统计 ──
  const todayC = customers.filter(c => c.date === today());
  const teamStats = settings.teams.map(t => {
    const all = customers.filter(c => c.teamId === t.id);
    const allT = todayC.filter(c => c.teamId === t.id);
    const won = all.filter(c => c.status === "success").length;
    const wonT = allT.filter(c => c.status === "success").length;
    const contacted = all.filter(c => c.status !== "pending").length;
    return { ...t, total: all.length, won, wonT, todayTotal: allT.length, rate: pct(won, contacted) };
  }).sort((a, b) => b.won - a.won);

  const staffStats = allStaff.map(s => {
    const all = customers.filter(c => c.staff === s.name);
    const won = all.filter(c => c.status === "success").length;
    const wonT = todayC.filter(c => c.staff === s.name && c.status === "success").length;
    const contacted = all.filter(c => c.status !== "pending").length;
    return { ...s, total: all.length, won, wonT, rate: pct(won, contacted) };
  }).sort((a, b) => b.won - a.won);

  // ── 筛选 ──
  const displayList = customers.filter(c => {
    if (filterTeam !== "全部" && c.teamId !== filterTeam) return false;
    if (filterStatus !== "全部" && c.status !== filterStatus) return false;
    if (searchQ && !c.name.includes(searchQ) && !c.phone.includes(searchQ)) return false;
    return true;
  });

  const followingList = customers.filter(c => c.status === "following");
  const detailC = customers.find(c => c.id === detailId);

  // ── 设置更新 ──
  const updateSettings = (patch) => {
    const s = { ...settings, ...patch };
    setSettings(s); saveS(s);
  };

  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 80 }}>

      {/* ── 顶栏 ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(27,108,242,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏥</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>京贝营销管理系统</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>{today()} · 今日录入 {todayC.length} 条</div>
          </div>
          {followingList.length > 0 && (
            <div onClick={() => setTab("follow")} style={{ background: C.accent, color: "#fff", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(255,90,90,0.4)" }}>
              ⏰ {followingList.length} 跟进
            </div>
          )}
        </div>
        <div style={{ display: "flex" }}>
          {[["home", "客户"], ["follow", "跟进"], ["stats", "统计"], ["settings", "设置"]].map(([k, label]) => (
            <div key={k} onClick={() => { setTab(k); setAddOpen(false); }} style={{
              flex: 1, textAlign: "center", padding: "9px 0 8px", fontSize: 13,
              color: tab === k ? "#fff" : "rgba(255,255,255,0.55)",
              borderBottom: tab === k ? "3px solid #fff" : "3px solid transparent",
              cursor: "pointer", fontWeight: tab === k ? 700 : 400, transition: "all .15s"
            }}>{label}</div>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 14px 0", maxWidth: 640, margin: "0 auto" }}>

        {/* ══ 客户列表 ══ */}
        {tab === "home" && !addOpen && (
          <div>
            {/* 搜索+添加 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 搜索姓名或手机号"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", background: "#fff" }} />
              <Btn onClick={openAdd} style={{ borderRadius: 10, padding: "10px 16px", whiteSpace: "nowrap" }}>＋ 添加</Btn>
            </div>

            {/* 战队筛选 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto", paddingBottom: 4 }}>
              {["全部", ...settings.teams.map(t => t.id)].map(id => {
                const label = id === "全部" ? "全部" : teamName(id);
                return (
                  <div key={id} onClick={() => setFilterTeam(id)} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap",
                    background: filterTeam === id ? C.primary : C.card,
                    color: filterTeam === id ? "#fff" : C.textSub,
                    border: `1.5px solid ${filterTeam === id ? C.primary : C.border}`
                  }}>{label}</div>
                );
              })}
            </div>

            {/* 状态筛选 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
              {["全部", ...Object.keys(STATUS)].map(k => {
                const s = STATUS[k];
                return (
                  <div key={k} onClick={() => setFilterStatus(k)} style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                    background: filterStatus === k ? (s ? s.color : C.primary) : C.card,
                    color: filterStatus === k ? "#fff" : C.textSub,
                    border: `1.5px solid ${filterStatus === k ? (s ? s.color : C.primary) : C.border}`
                  }}>{s ? s.icon + " " + s.label : "全部"}</div>
                );
              })}
            </div>

            {displayList.length === 0 && (
              <div style={{ textAlign: "center", color: C.textSub, padding: "50px 0", fontSize: 15 }}>暂无记录</div>
            )}
            {displayList.map(c => (
              <CustCard key={c.id} c={c} teamName={teamName(c.teamId)} onClick={() => setDetailId(c.id)} />
            ))}
          </div>
        )}

        {/* ══ 添加顾客 ══ */}
        {tab === "add" && (
          <AddForm form={form} setForm={setForm} allStaff={allStaff} settings={settings}
            onStaffChange={handleStaffChange} onSubmit={() => handleAdd(false)}
            onCancel={() => { setAddOpen(false); setTab("home"); }} C={C} />
        )}

        {/* ══ 跟进列表 ══ */}
        {tab === "follow" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>🔔 跟进中顾客</div>
            {followingList.length === 0 ? (
              <div style={{ textAlign: "center", color: C.textSub, padding: "50px 0", fontSize: 15 }}>🎉 暂无待跟进顾客</div>
            ) : followingList.map(c => (
              <CustCard key={c.id} c={c} teamName={teamName(c.teamId)} onClick={() => setDetailId(c.id)} showNote />
            ))}
          </div>
        )}

        {/* ══ 统计 ══ */}
        {tab === "stats" && (
          <StatsPanel teamStats={teamStats} staffStats={staffStats} C={C} />
        )}

        {/* ══ 设置 ══ */}
        {tab === "settings" && (
          <SettingsPanel settings={settings} onUpdate={updateSettings} showToast={showToast} C={C} />
        )}
      </div>

      {/* ══ 底部添加按钮（仅首页） ══ */}
      {tab === "home" && !addOpen && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200 }}>
          <div onClick={openAdd} style={{
            width: 54, height: 54, borderRadius: 27, background: C.primary, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 300,
            cursor: "pointer", boxShadow: "0 4px 20px rgba(27,108,242,0.45)"
          }}>＋</div>
        </div>
      )}

      {/* ══ 顾客详情弹窗 ══ */}
      {detailC && (
        <DetailModal c={detailC} allStaff={allStaff} teamName={teamName(detailC.teamId)}
          onUpdate={(patch) => updateCustomer(detailC.id, patch)}
          onDelete={() => deleteCustomer(detailC.id)}
          onClose={() => setDetailId(null)} C={C} settings={settings} />
      )}

      {/* ══ 重复警告 ══ */}
      {dupModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, boxShadow: C.shadowMd }}>
            <div style={{ fontSize: 38, textAlign: "center", marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, textAlign: "center", color: C.accent, marginBottom: 12 }}>检测到重复手机号</div>
            <div style={{ background: C.accentLight, borderRadius: 12, padding: 14, marginBottom: 18, fontSize: 14, lineHeight: 1.8 }}>
              <div>姓名：<b>{dupModal.name}</b></div>
              <div>手机：<b>{dupModal.phone}</b></div>
              <div>录入员工：<b>{dupModal.staff}</b>（{teamName(dupModal.teamId)}）</div>
              <div>录入日期：<b>{dupModal.date}</b></div>
              <div>当前状态：<Badge status={dupModal.status} /></div>
            </div>
            <div style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 20 }}>该顾客已有记录，是否仍要添加？</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn outline color={C.border} onClick={() => { setDupModal(null); setPendingForm(null); }} style={{ flex: 1, color: C.text }}>取消</Btn>
              <Btn color={C.accent} onClick={confirmDup} style={{ flex: 1 }}>仍要添加</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ══ 每日跟进提醒 ══ */}
      {dailyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, boxShadow: C.shadowMd, maxHeight: "82vh", overflow: "auto" }}>
            <div style={{ fontSize: 34, textAlign: "center", marginBottom: 6 }}>☀️</div>
            <div style={{ fontWeight: 700, fontSize: 17, textAlign: "center", marginBottom: 4 }}>今日跟进提醒</div>
            <div style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 16 }}>共 {followingList.length} 位顾客待跟进</div>
            {followingList.map(c => (
              <div key={c.id} style={{ background: C.warnLight, borderRadius: 12, padding: 13, marginBottom: 10, borderLeft: `4px solid ${C.warn}` }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name} <span style={{ color: C.textSub, fontSize: 13, fontWeight: 400 }}>{c.phone}</span></div>
                <div style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>跟进人：{c.followStaff || c.staff} · {teamName(c.teamId)}</div>
                {c.followNote && <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>📝 {c.followNote}</div>}
              </div>
            ))}
            <Btn onClick={() => { setDailyModal(false); setTab("follow"); }} style={{ width: "100%", marginTop: 6 }}>查看全部跟进</Btn>
            <div onClick={() => setDailyModal(false)} style={{ textAlign: "center", color: C.textSub, fontSize: 14, padding: "10px 0", cursor: "pointer" }}>稍后处理</div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

// ─── 顾客卡片 ─────────────────────────────────────────────────────
function CustCard({ c, teamName, onClick, showNote }) {
  const s = STATUS[c.status] || STATUS.pending;
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: C.shadow, borderLeft: `4px solid ${s.color}`, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</span>
          <span style={{ marginLeft: 8, fontSize: 13, color: C.textSub }}>{c.phone}</span>
        </div>
        <Badge status={c.status} />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: C.textSub, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span>👤 {c.staff}</span>
        <span>🚩 {teamName}</span>
        <span>🎫 {c.card}</span>
        <span>📅 {fmtDate(c.date)}</span>
      </div>
      {showNote && c.followNote && (
        <div style={{ marginTop: 8, fontSize: 13, background: C.warnLight, borderRadius: 8, padding: "6px 10px", color: C.text }}>📝 {c.followNote}</div>
      )}
      {c.status === "failed" && c.failReason && (
        <div style={{ marginTop: 8, fontSize: 13, background: C.accentLight, borderRadius: 8, padding: "6px 10px", color: C.accent }}>❌ {c.failReason}</div>
      )}
    </div>
  );
}

// ─── 添加表单 ─────────────────────────────────────────────────────
function AddForm({ form, setForm, allStaff, settings, onStaffChange, onSubmit, onCancel }) {
  const f = form;
  const set = (k, v) => setForm(x => ({ ...x, [k]: v }));
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: C.shadow }}>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 18, color: C.primary }}>➕ 录入新顾客</div>

      <Input label="顾客姓名 *" value={f.name} onChange={e => set("name", e.target.value)} placeholder="请输入顾客姓名" />
      <Input label="手机号 *" value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="请输入11位手机号" type="tel" />
      <Input label="日期" value={f.date} onChange={e => set("date", e.target.value)} type="date" />

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>推荐员工</label>
        <select value={f.staff} onChange={e => onStaffChange(e.target.value)}
          style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, background: "#fff", outline: "none" }}>
          {allStaff.map(s => <option key={s.name + s.teamId} value={s.name}>{s.name}（{s.teamName}）</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>会员卡类型</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {settings.cardTypes.map(v => (
            <div key={v} onClick={() => set("card", v)} style={{
              padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: f.card === v ? C.primary : C.primaryLight,
              color: f.card === v ? "#fff" : C.primary,
              border: `1.5px solid ${f.card === v ? C.primary : C.border}`
            }}>{v}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>状态</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(STATUS).map(([k, s]) => (
            <div key={k} onClick={() => set("status", k)} style={{
              padding: "10px 0", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500, textAlign: "center",
              background: f.status === k ? s.color : s.bg,
              color: f.status === k ? "#fff" : s.color,
              border: `1.5px solid ${f.status === k ? s.color : C.border}`
            }}>{s.icon} {s.label}</div>
          ))}
        </div>
      </div>

      {f.status === "failed" && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: C.accent, display: "block", marginBottom: 5, fontWeight: 500 }}>失败原因 *</label>
          <input value={f.failReason} onChange={e => set("failReason", e.target.value)} placeholder="请填写顾客拒绝原因"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.accent}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      {f.status === "following" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>当前跟进进展</label>
            <textarea value={f.followNote} onChange={e => set("followNote", e.target.value)} rows={2} placeholder="记录跟进状态..."
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>跟进负责人</label>
            <select value={f.followStaff} onChange={e => set("followStaff", e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, background: "#fff", outline: "none" }}>
              {allStaff.map(s => <option key={s.name + s.teamId} value={s.name}>{s.name}（{s.teamName}）</option>)}
            </select>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn outline color={C.border} onClick={onCancel} style={{ flex: 1, color: C.text }}>取消</Btn>
        <Btn onClick={onSubmit} style={{ flex: 2 }}>确认添加</Btn>
      </div>
    </div>
  );
}

// ─── 顾客详情弹窗 ─────────────────────────────────────────────────
function DetailModal({ c, allStaff, teamName, onUpdate, onDelete, onClose, settings }) {
  const [edit, setEdit] = useState({ status: c.status, failReason: c.failReason, followNote: c.followNote, followStaff: c.followStaff });
  const set = (k, v) => setEdit(x => ({ ...x, [k]: v }));
  const save = () => { onUpdate(edit); onClose(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto", boxShadow: C.shadowMd }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{c.name}</div>
          <div onClick={onClose} style={{ fontSize: 22, color: C.textSub, cursor: "pointer", lineHeight: 1 }}>×</div>
        </div>

        <div style={{ background: C.grayLight, borderRadius: 12, padding: 14, marginBottom: 18, fontSize: 14, lineHeight: 2 }}>
          <div>📱 {c.phone}</div>
          <div>👤 {c.staff} · 🚩 {teamName}</div>
          <div>🎫 {c.card} · 📅 {c.date}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 8, fontWeight: 500 }}>更新状态</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.entries(STATUS).map(([k, s]) => (
              <div key={k} onClick={() => set("status", k)} style={{
                padding: "10px 0", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500, textAlign: "center",
                background: edit.status === k ? s.color : s.bg,
                color: edit.status === k ? "#fff" : s.color,
                border: `1.5px solid ${edit.status === k ? s.color : C.border}`
              }}>{s.icon} {s.label}</div>
            ))}
          </div>
        </div>

        {edit.status === "failed" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.accent, display: "block", marginBottom: 5, fontWeight: 500 }}>失败原因</label>
            <input value={edit.failReason} onChange={e => set("failReason", e.target.value)} placeholder="请填写拒绝原因"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.accent}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
        )}

        {edit.status === "following" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>跟进进展备注</label>
              <textarea value={edit.followNote} onChange={e => set("followNote", e.target.value)} rows={3} placeholder="记录当前跟进状态..."
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>转交给</label>
              <select value={edit.followStaff} onChange={e => set("followStaff", e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, background: "#fff", outline: "none" }}>
                {allStaff.map(s => <option key={s.name + s.teamId} value={s.name}>{s.name}（{s.teamName}）</option>)}
              </select>
              <div style={{ fontSize: 12, color: C.textSub, marginTop: 5 }}>当前跟进人：{c.followStaff || c.staff}</div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn color={C.accent} outline onClick={onDelete} style={{ color: C.accent }}>删除</Btn>
          <Btn onClick={save} style={{ flex: 1 }}>保存更新</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── 统计面板 ─────────────────────────────────────────────────────
function StatsPanel({ teamStats, staffStats }) {
  const maxWon = Math.max(1, ...teamStats.map(t => t.won));
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>📊 销售统计</div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: C.shadow, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏆 战队排行</div>
        {teamStats.map((t, i) => (
          <div key={t.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i]} {t.name}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 13, color: C.primary, fontWeight: 700 }}>{t.won} 张成交</span>
                <span style={{ fontSize: 12, color: C.textSub, marginLeft: 8 }}>今日 {t.wonT} · 成交率 {t.rate}</span>
              </div>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: C.border }}>
              <div style={{ height: "100%", borderRadius: 5, background: [C.accent, C.primary, C.success, C.warn, C.purple][i % 5], width: `${Math.max(4, (t.won / maxWon) * 100)}%`, transition: "width .6s" }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: C.shadow }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>👤 个人业绩</div>
        {staffStats.map((s, i) => (
          <div key={s.name + s.teamId} style={{ display: "flex", alignItems: "center", padding: "11px 0", borderBottom: i < staffStats.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.primary, marginRight: 12, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{s.teamName}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: C.primary, fontSize: 15 }}>{s.won} 张</div>
              <div style={{ fontSize: 12, color: C.textSub }}>今日 {s.wonT} · 成交率 {s.rate}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 设置面板 ─────────────────────────────────────────────────────
function SettingsPanel({ settings, onUpdate, showToast }) {
  const [newCard, setNewCard] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newMember, setNewMember] = useState({});

  const addCard = () => {
    if (!newCard.trim()) return;
    if (settings.cardTypes.includes(newCard.trim())) { showToast("error", "卡种已存在"); return; }
    onUpdate({ cardTypes: [...settings.cardTypes, newCard.trim()] });
    setNewCard("");
    showToast("success", "已添加卡种");
  };

  const removeCard = (v) => onUpdate({ cardTypes: settings.cardTypes.filter(c => c !== v) });

  const addTeam = () => {
    if (!newTeam.trim()) return;
    const team = { id: "t" + Date.now(), name: newTeam.trim(), members: [] };
    onUpdate({ teams: [...settings.teams, team] });
    setNewTeam("");
    showToast("success", "已添加战队");
  };

  const removeTeam = (id) => onUpdate({ teams: settings.teams.filter(t => t.id !== id) });

  const addMember = (teamId) => {
    const name = (newMember[teamId] || "").trim();
    if (!name) return;
    const teams = settings.teams.map(t => t.id === teamId ? { ...t, members: [...t.members, name] } : t);
    onUpdate({ teams });
    setNewMember(x => ({ ...x, [teamId]: "" }));
    showToast("success", `已添加：${name}`);
  };

  const removeMember = (teamId, name) => {
    const teams = settings.teams.map(t => t.id === teamId ? { ...t, members: t.members.filter(m => m !== name) } : t);
    onUpdate({ teams });
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>⚙️ 系统设置</div>

      {/* 会员卡类型 */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: C.shadow, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🎫 会员卡类型</div>
        {settings.cardTypes.map(v => (
          <div key={v} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14 }}>{v}</span>
            <Btn small outline color={C.accent} onClick={() => removeCard(v)} style={{ color: C.accent }}>删除</Btn>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={newCard} onChange={e => setNewCard(e.target.value)} placeholder="新卡种名称"
            onKeyDown={e => e.key === "Enter" && addCard()}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none" }} />
          <Btn small onClick={addCard}>添加</Btn>
        </div>
      </div>

      {/* 战队管理 */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: C.shadow, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🚩 战队管理</div>
        {settings.teams.map(t => (
          <div key={t.id} style={{ marginBottom: 16, background: C.grayLight, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</span>
              <Btn small outline color={C.accent} onClick={() => removeTeam(t.id)} style={{ color: C.accent }}>删除战队</Btn>
            </div>
            {t.members.map(m => (
              <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14 }}>👤 {m}</span>
                <Btn small outline color={C.textSub} onClick={() => removeMember(t.id, m)} style={{ color: C.textSub }}>移除</Btn>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={newMember[t.id] || ""} onChange={e => setNewMember(x => ({ ...x, [t.id]: e.target.value }))}
                placeholder="添加成员姓名" onKeyDown={e => e.key === "Enter" && addMember(t.id)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", background: "#fff" }} />
              <Btn small onClick={() => addMember(t.id)}>添加</Btn>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input value={newTeam} onChange={e => setNewTeam(e.target.value)} placeholder="新战队名称"
            onKeyDown={e => e.key === "Enter" && addTeam()}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none" }} />
          <Btn small onClick={addTeam}>新建战队</Btn>
        </div>
      </div>
    </div>
  );
}
