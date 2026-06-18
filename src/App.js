import { useState, useEffect, useCallback } from "react";

// ─── 设计令牌 ──────────────────────────────────────────────────────
const C = {
  bg: "linear-gradient(180deg, #FFF7FB 0%, #F3FBFF 48%, #FFFBEA 100%)",
  card: "#FFFFFF",
  primary: "#5BA7FF",
  primaryLight: "#EAF5FF",
  primaryDark: "#8B7CF6",
  accent: "#FF7A9C",
  accentLight: "#FFF0F6",
  success: "#31CFA4",
  successLight: "#E8FBF4",
  warn: "#FFB84D",
  warnLight: "#FFF6DA",
  purple: "#A78BFA",
  purpleLight: "#F4EEFF",
  gray: "#7A8499",
  grayLight: "#F7F3FF",
  border: "#F0DDEB",
  text: "#263247",
  textSub: "#7A8499",
  shadow: "0 8px 24px rgba(103, 87, 160, 0.10)",
  shadowMd: "0 14px 36px rgba(103, 87, 160, 0.16)",
};

const STATUS = {
  success: { label: "已成交", color: C.success, bg: C.successLight, icon: "✅" },
  following: { label: "跟进中", color: C.warn, bg: C.warnLight, icon: "🔔" },
  failed: { label: "营销失败", color: C.accent, bg: C.accentLight, icon: "❌" },
  pending: { label: "待联系", color: C.purple, bg: C.purpleLight, icon: "⏳" },
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { if (!d) return ""; const [, m, day] = d.split("-"); return `${m}/${day}`; };
const API_URL = "https://youyou-d3g8xhv9je8669b75.service.tcloudbase.com/jb-api";

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
  { id: 1, name: "张小宝", phone: "13800001111", staff: "王小明", teamId: "t1", date: today(), card: "京贝体验会员卡", status: "success", failReason: "", followNote: "", followStaff: "王小明", contributors: ["王小明"] },
  { id: 2, name: "李彤彤", phone: "13900002222", staff: "张芳", teamId: "t2", date: today(), card: "京贝体验会员卡", status: "following", failReason: "", followNote: "已发微信，等回复", followStaff: "张芳" },
  { id: 3, name: "王大毛", phone: "13700003333", staff: "陈静", teamId: "t3", date: today(), card: "京贝年度会员卡", status: "failed", failReason: "价格太贵，暂不考虑", followNote: "", followStaff: "陈静" },
  { id: 4, name: "赵小花", phone: "13600004444", staff: "李华", teamId: "t1", date: today(), card: "京贝体验会员卡", status: "pending", failReason: "", followNote: "", followStaff: "李华" },
];

async function api(action, payload = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.message || "云端同步失败");
  return data;
}

const uniqueNames = (names) => Array.from(new Set((names || []).map(v => String(v || "").trim()).filter(Boolean))).slice(0, 2);
const getContributors = (customer) => {
  if (customer.status !== "success") return [];
  const saved = uniqueNames(customer.contributors);
  if (saved.length > 0) return saved;
  return customer.staff ? [customer.staff] : [];
};
const creditText = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const pctText = (won, total) => total > 0 ? `${Math.round((won / total) * 100)}%` : "0%";
const daysAgo = (count) => {
  const d = new Date();
  d.setDate(d.getDate() - count);
  return d.toISOString().slice(0, 10);
};
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const inDateRange = (customer, start, end) => {
  if (start && customer.date < start) return false;
  if (end && customer.date > end) return false;
  return true;
};
const normalizeCustomer = (customer, fallbackIndex = 0) => ({
  id: customer.id || Date.now() + fallbackIndex,
  name: String(customer.name || "").trim(),
  phone: String(customer.phone || "").trim(),
  staff: String(customer.staff || "").trim(),
  teamId: customer.teamId || "",
  date: customer.date || today(),
  card: customer.card || "",
  status: customer.status || "pending",
  failReason: customer.failReason || "",
  followNote: customer.followNote || "",
  followStaff: customer.followStaff || customer.staff || "",
  contributors: uniqueNames(customer.contributors || (customer.status === "success" ? [customer.staff] : [])),
});
const buildStaffStats = (list, allStaff) => allStaff.map(s => {
  let won = 0;
  let wonT = 0;
  let todayTotal = 0;
  const participatedIds = new Set();
  const todayIds = new Set();

  list.forEach((customer) => {
    const contributors = getContributors(customer);
    const isParticipant = customer.staff === s.name || customer.followStaff === s.name || contributors.includes(s.name);
    if (!isParticipant) return;
    participatedIds.add(customer.id);
    if (customer.date === today()) {
      todayIds.add(customer.id);
      todayTotal += 1;
    }
    if (customer.status === "success" && contributors.includes(s.name)) {
      const credit = 1 / Math.max(1, contributors.length);
      won += credit;
      if (customer.date === today()) wonT += credit;
    }
  });

  const total = participatedIds.size;
  return { ...s, total, won, wonT, todayTotal, todayCount: todayIds.size, rate: total > 0 ? won / total : 0 };
}).sort((a, b) => b.won - a.won || b.rate - a.rate || b.total - a.total || a.name.localeCompare(b.name, "zh-CN"));
const buildTeamStats = (list, teams, allStaff) => {
  const staffTeam = new Map(allStaff.map(s => [s.name, s.teamId]));
  return teams.map(t => {
    let won = 0;
    let wonT = 0;
    const teamCustomers = list.filter(c => c.teamId === t.id);
    const todayCustomers = teamCustomers.filter(c => c.date === today());

    list.forEach((customer) => {
      if (customer.status !== "success") return;
      const contributors = getContributors(customer);
      contributors.forEach((name) => {
        const teamId = staffTeam.get(name) || customer.teamId;
        if (teamId !== t.id) return;
        const credit = 1 / Math.max(1, contributors.length);
        won += credit;
        if (customer.date === today()) wonT += credit;
      });
    });

    return { ...t, total: teamCustomers.length, won, wonT, todayTotal: todayCustomers.length };
  }).sort((a, b) => b.won - a.won || b.total - a.total);
};
const buildDailyReportText = (dailyRank, totalDeals, totalEntries, leadingTeam, celebratedTeams) => {
  const ranked = dailyRank.filter(s => s.wonT > 0 || s.todayTotal > 0);
  const rows = ranked.length ? ranked : dailyRank.slice(0, 6);
  const teamNames = celebratedTeams.length ? celebratedTeams.map(t => t.name).join("、") : "各团队";
  return [
    `${today()} 今日开卡喜报[爆竹][爆竹][爆竹]`,
    "[烟花][庆祝]",
    "",
    `今日成交：${creditText(totalDeals)} 单`,
    `今日录入：${totalEntries} 位`,
    "",
    "今日个人业绩排名",
    ...rows.map((s, i) => `${["🥇", "🥈", "🥉"][i] || `${i + 1}.`} ${s.name}｜成交 ${creditText(s.wonT)} 单｜录入 ${s.todayTotal} 位｜成交率 ${pctText(s.wonT, s.todayTotal)}`),
    "",
    `恭喜${teamNames}，目前${leadingTeam?.name || "团队"}领先。`,
    "再次祝贺！希望你在未来日子里发光发热🧚‍♀️🧚‍♀️🧚‍♀️🧚‍♀️",
  ].join("\n");
};
const drawRoundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const fitText = (ctx, text, x, y, maxWidth, font) => {
  ctx.font = font;
  let value = String(text);
  while (ctx.measureText(value).width > maxWidth && value.length > 2) value = `${value.slice(0, -2)}…`;
  ctx.fillText(value, x, y);
};
const fitCenterText = (ctx, text, x, y, maxWidth, font) => {
  ctx.font = font;
  let value = String(text);
  while (ctx.measureText(value).width > maxWidth && value.length > 2) value = `${value.slice(0, -2)}…`;
  ctx.fillText(value, x, y);
};
const drawFirework = (ctx, x, y, radius, color) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.28, y + Math.sin(angle) * radius * 0.28);
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
const createDailyReportImage = ({ dailyRank, totalDeals, totalEntries, leadingTeam, celebratedTeams }) => new Promise((resolve, reject) => {
  const scale = 2;
  const width = 900;
  const height = 1220;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    reject(new Error("无法生成图片"));
    return;
  }
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#FFF5A8");
  bg.addColorStop(0.42, "#FFD4E4");
  bg.addColorStop(1, "#BEEBFF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  drawFirework(ctx, 116, 132, 54, C.accent);
  drawFirework(ctx, 782, 154, 62, C.primary);
  drawFirework(ctx, 726, 1032, 46, C.warn);

  for (let i = 0; i < 42; i += 1) {
    ctx.save();
    ctx.translate((i * 73) % width, 40 + ((i * 97) % 1020));
    ctx.rotate((i * 31 * Math.PI) / 180);
    ctx.fillStyle = [C.accent, C.primary, C.success, C.warn, C.purple][i % 5];
    ctx.globalAlpha = 0.34;
    drawRoundRect(ctx, -7, -12, 14, 24, 4);
    ctx.fill();
    ctx.restore();
  }

  drawRoundRect(ctx, 42, 42, width - 84, height - 84, 34);
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = C.text;
  ctx.font = "900 42px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("京贝儿童门诊会员营销系统", width / 2, 122);
  ctx.fillStyle = C.accent;
  ctx.font = "900 58px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("今日开卡喜报", width / 2, 205);
  ctx.fillStyle = C.textSub;
  ctx.font = "600 26px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText(today(), width / 2, 252);
  ctx.fillStyle = C.warn;
  ctx.font = "900 24px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("礼花撒起来  烟花放起来", width / 2, 286);

  const statCards = [
    ["今日成交", `${creditText(totalDeals)} 单`, C.accent],
    ["今日录入", `${totalEntries} 位`, C.primary],
    ["继续加油", "冲刺中", C.success],
  ];
  statCards.forEach(([label, value, color], i) => {
    const x = 92 + i * 238;
    drawRoundRect(ctx, x, 304, 202, 122, 24);
    ctx.fillStyle = "rgba(255,255,255,.76)";
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "900 36px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(value, x + 101, 354);
    ctx.fillStyle = C.textSub;
    ctx.font = "600 22px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(label, x + 101, 394);
  });

  const top = dailyRank.slice(0, 3);
  const podium = [
    { x: 318, y: 472, w: 264, h: 214, title: "🥇", color: "#FF7A9C", medalSize: 68 },
    { x: 82, y: 520, w: 226, h: 166, title: "🥈", color: "#5BA7FF", medalSize: 56 },
    { x: 592, y: 536, w: 226, h: 150, title: "🥉", color: "#FF9F43", medalSize: 54 },
  ];
  podium.forEach((p, i) => {
    const s = top[i] || { name: "-", teamName: "", wonT: 0, todayTotal: 0 };
    const cardBg = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    cardBg.addColorStop(0, i === 0 ? "#FFE27A" : i === 1 ? "#DCE8FF" : "#FFDDB8");
    cardBg.addColorStop(1, "rgba(255,255,255,.92)");
    drawRoundRect(ctx, p.x, p.y, p.w, p.h, 28);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.font = `${p.medalSize}px PingFang SC, Microsoft YaHei, sans-serif`;
    ctx.fillText(p.title, p.x + p.w / 2, p.y + (i === 0 ? 72 : 58));
    ctx.fillStyle = C.text;
    ctx.font = `900 ${i === 0 ? "34" : "29"}px PingFang SC, Microsoft YaHei, sans-serif`;
    fitText(ctx, s.name, p.x + p.w / 2, p.y + (i === 0 ? 116 : 98), p.w - 32, ctx.font);
    ctx.fillStyle = p.color;
    ctx.font = `900 ${i === 0 ? "42" : "34"}px PingFang SC, Microsoft YaHei, sans-serif`;
    ctx.fillText(`${creditText(s.wonT)} 单`, p.x + p.w / 2, p.y + (i === 0 ? 158 : 135));
    ctx.fillStyle = C.textSub;
    ctx.font = "600 20px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(`成交率 ${pctText(s.wonT, s.todayTotal)}`, p.x + p.w / 2, p.y + (i === 0 ? 190 : 160));
  });

  ctx.textAlign = "left";
  ctx.fillStyle = C.text;
  ctx.font = "900 28px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("完整排名", 92, 748);

  const rows = dailyRank.slice(0, 8);
  rows.forEach((s, i) => {
    const y = 792 + i * 48;
    drawRoundRect(ctx, 92, y - 30, 716, 38, 18);
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.fill();
    ctx.fillStyle = [C.warn, C.primary, C.success, C.purple, C.accent][i % 5];
    ctx.font = "900 22px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(`${i + 1}`, 114, y - 4);
    ctx.fillStyle = C.text;
    ctx.font = "800 22px PingFang SC, Microsoft YaHei, sans-serif";
    fitText(ctx, s.name, 154, y - 4, 160, ctx.font);
    ctx.fillStyle = C.textSub;
    ctx.font = "600 18px PingFang SC, Microsoft YaHei, sans-serif";
    fitText(ctx, s.teamName, 306, y - 4, 120, ctx.font);
    ctx.fillStyle = C.primaryDark;
    ctx.font = "900 22px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(`成交 ${creditText(s.wonT)} 单`, 456, y - 4);
    ctx.fillStyle = C.textSub;
    ctx.font = "600 18px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(`成交率 ${pctText(s.wonT, s.todayTotal)}`, 620, y - 4);
  });

  ctx.textAlign = "center";
  const teamNames = (celebratedTeams || []).length ? celebratedTeams.map(t => t.name).join("、") : "各团队";
  drawRoundRect(ctx, 128, 1100, 644, 56, 28);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.fill();
  ctx.fillStyle = C.accent;
  ctx.font = "900 22px PingFang SC, Microsoft YaHei, sans-serif";
  fitCenterText(ctx, `恭喜${teamNames}，目前${leadingTeam?.name || "团队"}领先`, width / 2, 1135, 590, ctx.font);
  ctx.fillStyle = C.textSub;
  ctx.font = "600 17px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.fillText("再次祝贺！希望大家继续发光发热", width / 2, 1178);

  canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("无法生成图片"));
  }, "image/png");
});

// ─── 工具组件 ──────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color, fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.icon} {s.label}
    </span>
  );
}

function CuteLogo() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
      <defs>
        <linearGradient id="logoBg" x1="4" y1="2" x2="34" y2="36">
          <stop stopColor="#FFF6A8" />
          <stop offset="0.55" stopColor="#FFD2E4" />
          <stop offset="1" stopColor="#BDEBFF" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="35" height="35" rx="12" fill="url(#logoBg)" stroke="rgba(255,255,255,.8)" strokeWidth="2" />
      <circle cx="13" cy="14" r="4.5" fill="#FFFFFF" />
      <circle cx="25" cy="14" r="4.5" fill="#FFFFFF" />
      <circle cx="19" cy="19" r="10" fill="#FFFFFF" />
      <circle cx="15.5" cy="18" r="1.4" fill="#263247" />
      <circle cx="22.5" cy="18" r="1.4" fill="#263247" />
      <path d="M16 23.5c2.1 1.8 4.3 1.8 6.4 0" fill="none" stroke="#FF7A9C" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M26.5 22.5c3.3 1.4 4.8 4.2 3.8 6.4-.9 2-3.6 2.3-5.2.8-1.6-1.6-.8-4.6 1.4-4.8" fill="none" stroke="#5BA7FF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="29.5" r="2.3" fill="#31CFA4" stroke="#FFFFFF" strokeWidth="1.3" />
    </svg>
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
      <input {...props} style={{ width: "100%", padding: "12px 15px", borderRadius: 15, border: `1.5px solid ${C.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", background: "#fff", color: C.text, boxShadow: "inset 0 1px 0 rgba(255,255,255,.75)", ...(props.style || {}) }} />
    </div>
  );
}

function Btn({ children, onClick, color = C.primary, outline, style, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? "6px 14px" : "11px 20px", borderRadius: 14, border: outline ? `1.5px solid ${color}` : "none",
      background: outline ? "#fff" : color, color: outline ? color : "#fff",
      fontSize: small ? 13 : 15, fontWeight: 700, cursor: "pointer", boxShadow: outline ? "none" : "0 8px 18px rgba(91,167,255,.22)", ...(style || {})
    }}>{children}</button>
  );
}

// ─── 主应用 ───────────────────────────────────────────────────────
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("stats");
  const [toast, setToast] = useState(null);
  const [syncState, setSyncState] = useState("loading");
  const [dupModal, setDupModal] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [filterTeam, setFilterTeam] = useState("全部");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [searchQ, setSearchQ] = useState("");
  const [pendingForm, setPendingForm] = useState(null);
  const [historyRange, setHistoryRange] = useState({ start: monthStart(), end: today() });

  // 表单
  const blankForm = () => ({ name: "", phone: "", staff: "", teamId: "", date: today(), card: settings.cardTypes[0] || "", status: "pending", failReason: "", followNote: "", followStaff: "", contributors: [] });
  const [form, setForm] = useState(blankForm());
  const [addOpen, setAddOpen] = useState(false);

  // ── 加载 ──
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await api("load");
        if (!alive) return;
        setCustomers(data.customers || []);
        setSettings(data.settings || DEFAULT_SETTINGS);
        localStorage.setItem("jb_customers_cache", JSON.stringify(data.customers || []));
        localStorage.setItem("jb_settings_cache", JSON.stringify(data.settings || DEFAULT_SETTINGS));
        setSyncState("cloud");
      } catch (error) {
        if (!alive) return;
        try {
          const c = localStorage.getItem("jb_customers_cache") || localStorage.getItem("jb_customers");
          const s = localStorage.getItem("jb_settings_cache") || localStorage.getItem("jb_settings");
          if (c) setCustomers(JSON.parse(c)); else setCustomers(SAMPLE);
          if (s) setSettings(JSON.parse(s));
        } catch {
          setCustomers(SAMPLE);
        }
        setSyncState("offline");
        showToast("error", "云端加载失败，暂用本机缓存");
      }
    };

    load();
    return () => { alive = false; };
  }, []);

  const saveC = useCallback((data) => { try { localStorage.setItem("jb_customers_cache", JSON.stringify(data)); } catch {} }, []);
  const saveS = useCallback((data) => { try { localStorage.setItem("jb_settings_cache", JSON.stringify(data)); } catch {} }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2800);
  };

  const exportData = () => {
    const backup = {
      app: "京贝儿童门诊会员营销系统",
      version: 1,
      exportedAt: new Date().toISOString(),
      customers: normalizedCustomers,
      settings,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `京贝会员数据备份-${today()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("success", "已导出到本地");
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incomingCustomers = Array.isArray(data.customers) ? data.customers.map(normalizeCustomer).filter(c => c.name && c.phone) : null;
      const incomingSettings = data.settings && Array.isArray(data.settings.teams) && Array.isArray(data.settings.cardTypes) ? data.settings : null;
      if (!incomingCustomers || !incomingSettings) throw new Error("文件格式不正确");
      const okReplace = window.confirm(`确认导入这份本地备份吗？\n\n将替换当前云端数据：${incomingCustomers.length} 位顾客记录。`);
      if (!okReplace) return;

      setCustomers(incomingCustomers);
      setSettings(incomingSettings);
      saveC(incomingCustomers);
      saveS(incomingSettings);
      await api("replaceAll", { customers: incomingCustomers, settings: incomingSettings });
      setSyncState("cloud");
      showToast("success", "已导入并同步到云端");
    } catch (error) {
      showToast("error", error.message || "导入失败");
    }
  };

  // ── 所有员工列表 ──
  const allStaff = settings.teams.flatMap(t => t.members.map(m => ({ name: m, teamId: t.id, teamName: t.name })));
  const teamName = (id) => settings.teams.find(t => t.id === id)?.name || "未知";

  // ── 添加顾客 ──
  const openAdd = () => {
    const f = blankForm();
    if (allStaff.length > 0) { f.staff = allStaff[0].name; f.teamId = allStaff[0].teamId; f.followStaff = allStaff[0].name; f.contributors = [allStaff[0].name]; }
    if (settings.cardTypes.length > 0) f.card = settings.cardTypes[0];
    setForm(f);
    setAddOpen(true);
    setTab("add");
  };

  const handleStaffChange = (name) => {
    const s = allStaff.find(x => x.name === name);
    setForm(f => ({ ...f, staff: name, teamId: s ? s.teamId : f.teamId, followStaff: name, contributors: uniqueNames([name, ...(f.contributors || [])]) }));
  };

  const handleAdd = async (force = false) => {
    const cleanName = form.name.trim();
    const cleanPhone = form.phone.trim();
    if (!cleanName) { showToast("error", "请填写顾客姓名"); return; }
    if (!cleanPhone) { showToast("error", "请填写手机号"); return; }
    if (!/^1\d{10}$/.test(cleanPhone)) { showToast("error", "手机号格式不正确"); return; }
    if (form.status === "failed" && !form.failReason.trim()) { showToast("error", "请填写营销失败原因"); return; }
    if (form.status === "success" && uniqueNames(form.contributors).length === 0) { showToast("error", "请选择成交人"); return; }

    const duplicates = customers.filter(c => c.phone === cleanPhone || c.name.trim() === cleanName);
    if (duplicates.length > 0 && !force) {
      setDupModal({
        name: cleanName,
        phone: cleanPhone,
        matches: duplicates,
        samePhone: duplicates.some(c => c.phone === cleanPhone),
        sameName: duplicates.some(c => c.name.trim() === cleanName),
      });
      setPendingForm({ ...form, name: cleanName, phone: cleanPhone });
      return;
    }

    const newC = normalizeCustomer({ id: Date.now(), ...form, name: cleanName, phone: cleanPhone });
    const updated = [newC, ...customers];
    setCustomers(updated); saveC(updated);
    setAddOpen(false);
    setTab("stats");
    try {
      await api("addCustomer", { customer: newC });
      showToast("success", `已云端添加：${newC.name}`);
      setSyncState("cloud");
    } catch (error) {
      showToast("error", "已临时保存，本次云端同步失败");
      setSyncState("offline");
    }
  };

  const confirmDup = async () => {
    if (!pendingForm) return;
    const newC = normalizeCustomer({ id: Date.now(), ...pendingForm, name: pendingForm.name.trim(), phone: pendingForm.phone.trim() });
    const updated = [newC, ...customers];
    setCustomers(updated); saveC(updated);
    setDupModal(null); setPendingForm(null);
    setAddOpen(false); setTab("stats");
    try {
      await api("addCustomer", { customer: newC });
      showToast("success", `已云端添加：${newC.name}`);
      setSyncState("cloud");
    } catch (error) {
      showToast("error", "已临时保存，本次云端同步失败");
      setSyncState("offline");
    }
  };

  // ── 更新顾客 ──
  const updateCustomer = async (id, patch) => {
    const updated = customers.map(c => c.id === id ? { ...c, ...patch } : c);
    setCustomers(updated); saveC(updated);
    try {
      await api("updateCustomer", { id, patch });
      showToast("success", "已同步更新");
      setSyncState("cloud");
    } catch (error) {
      showToast("error", "已临时保存，本次云端同步失败");
      setSyncState("offline");
    }
  };

  const deleteCustomer = async (id) => {
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated); saveC(updated);
    setDetailId(null);
    try {
      await api("deleteCustomer", { id });
      showToast("success", "已云端删除");
      setSyncState("cloud");
    } catch (error) {
      showToast("error", "本机已删除，云端同步失败");
      setSyncState("offline");
    }
  };

  // ── 统计 ──
  const normalizedCustomers = customers.map(normalizeCustomer);
  const todayC = normalizedCustomers.filter(c => c.date === today());
  const historyCustomers = normalizedCustomers.filter(c => inDateRange(c, historyRange.start, historyRange.end));
  const teamStats = buildTeamStats(normalizedCustomers, settings.teams, allStaff);
  const staffStats = buildStaffStats(normalizedCustomers, allStaff);
  const historyStaffStats = buildStaffStats(historyCustomers, allStaff);
  const historySummary = {
    total: historyCustomers.length,
    won: historyCustomers.filter(c => c.status === "success").length,
    following: historyCustomers.filter(c => c.status === "following").length,
    failed: historyCustomers.filter(c => c.status === "failed").length,
  };

  // ── 筛选 ──
  const displayList = normalizedCustomers.filter(c => {
    if (filterTeam !== "全部" && c.teamId !== filterTeam) return false;
    if (filterStatus !== "全部" && c.status !== filterStatus) return false;
    if (searchQ && !c.name.includes(searchQ) && !c.phone.includes(searchQ)) return false;
    return true;
  });

  const followingList = normalizedCustomers.filter(c => c.status === "following");
  const detailC = normalizedCustomers.find(c => c.id === detailId);

  // ── 设置更新 ──
  const updateSettings = async (patch) => {
    const s = { ...settings, ...patch };
    setSettings(s); saveS(s);
    try {
      await api("saveSettings", { settings: s });
      setSyncState("cloud");
    } catch (error) {
      showToast("error", "设置已临时保存，云端同步失败");
      setSyncState("offline");
    }
  };

  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 80 }}>

      {/* ── 顶栏 ── */}
      <div style={{ background: `linear-gradient(135deg, #FFB7D2 0%, ${C.primary} 54%, #9BE7C9 100%)`, padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 8px 26px rgba(91,167,255,0.22)", borderRadius: "0 0 24px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.65), 0 8px 18px rgba(75,95,140,.12)" }}><CuteLogo /></div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 17, letterSpacing: 0.3, textShadow: "0 2px 8px rgba(79,89,130,.18)" }}>京贝儿童门诊会员营销系统</div>
            <div style={{ color: "rgba(255,255,255,0.86)", fontSize: 12, fontWeight: 600 }}>
              {today()} · 今日录入 {todayC.length} 条 · {syncState === "cloud" ? "云端同步" : syncState === "loading" ? "加载云端" : "本机缓存"}
            </div>
          </div>
          {followingList.length > 0 && (
            <div onClick={() => setTab("follow")} style={{ background: "#fff", color: C.accent, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 18px rgba(255,122,156,0.28)" }}>
              ⏰ {followingList.length} 跟进
            </div>
          )}
        </div>
        <div style={{ display: "flex" }}>
          {[["stats", "统计"], ["home", "客户"], ["follow", "跟进"], ["settings", "设置"]].map(([k, label]) => (
            <div key={k} onClick={() => { setTab(k); setAddOpen(false); }} style={{
              flex: 1, textAlign: "center", padding: "9px 0 8px", fontSize: 13,
              color: tab === k ? "#fff" : "rgba(255,255,255,0.55)",
              borderBottom: tab === k ? "4px solid #fff" : "4px solid transparent",
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
                style={{ flex: 1, padding: "11px 15px", borderRadius: 16, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", background: "#fff", boxShadow: C.shadow }} />
              <Btn onClick={openAdd} style={{ borderRadius: 16, padding: "10px 16px", whiteSpace: "nowrap" }}>＋ 添加</Btn>
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
            onCancel={() => { setAddOpen(false); setTab("stats"); }} C={C} />
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
          <StatsPanel
            teamStats={teamStats}
            staffStats={staffStats}
            historyStaffStats={historyStaffStats}
            historySummary={historySummary}
            historyRange={historyRange}
            setHistoryRange={setHistoryRange}
            showToast={showToast}
            C={C}
          />
        )}

        {/* ══ 设置 ══ */}
        {tab === "settings" && (
          <SettingsPanel settings={settings} onUpdate={updateSettings} showToast={showToast} onExport={exportData} onImport={importData} C={C} />
        )}
      </div>

      {/* ══ 底部添加按钮（仅首页） ══ */}
      {tab === "home" && !addOpen && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 200 }}>
            <div onClick={openAdd} style={{
            width: 58, height: 58, borderRadius: 24, background: `linear-gradient(135deg, ${C.accent} 0%, ${C.primary} 100%)`, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 300,
            cursor: "pointer", boxShadow: "0 12px 26px rgba(255,122,156,0.34)"
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
            <div style={{ fontWeight: 700, fontSize: 17, textAlign: "center", color: C.accent, marginBottom: 6 }}>检测到疑似重复顾客</div>
            <div style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 12 }}>
              {dupModal.samePhone && dupModal.sameName ? "姓名和手机号已有相同记录" : dupModal.samePhone ? "手机号已有相同记录" : "姓名已有相同记录"}
            </div>
            <div style={{ background: C.accentLight, borderRadius: 12, padding: 14, marginBottom: 18, fontSize: 14, lineHeight: 1.8 }}>
              {dupModal.matches.map((m, i) => (
                <div key={m.id} style={{ paddingBottom: i < dupModal.matches.length - 1 ? 10 : 0, marginBottom: i < dupModal.matches.length - 1 ? 10 : 0, borderBottom: i < dupModal.matches.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ marginBottom: 4 }}>
                    {m.name.trim() === dupModal.name && <span style={{ color: C.accent, fontWeight: 700, marginRight: 8 }}>姓名相同</span>}
                    {m.phone === dupModal.phone && <span style={{ color: C.accent, fontWeight: 700 }}>手机号相同</span>}
                  </div>
                  <div>姓名：<b>{m.name}</b></div>
                  <div>手机：<b>{m.phone}</b></div>
                  <div>录入员工：<b>{m.staff}</b>（{teamName(m.teamId)}）</div>
                  <div>录入日期：<b>{m.date}</b></div>
                  <div>当前状态：<Badge status={m.status} /></div>
                </div>
              ))}
            </div>
            <div style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 20 }}>该顾客已有记录，是否仍要添加？</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn outline color={C.border} onClick={() => { setDupModal(null); setPendingForm(null); }} style={{ flex: 1, color: C.text }}>取消</Btn>
              <Btn color={C.accent} onClick={confirmDup} style={{ flex: 1 }}>仍要添加</Btn>
            </div>
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
    <div onClick={onClick} style={{ background: "rgba(255,255,255,0.94)", borderRadius: 20, padding: "15px 16px", marginBottom: 12, boxShadow: C.shadow, border: `1.5px solid ${C.border}`, borderLeft: `6px solid ${s.color}`, cursor: "pointer" }}>
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
      {c.status === "success" && getContributors(c).length > 0 && (
        <div style={{ marginTop: 8, fontSize: 13, background: C.successLight, borderRadius: 10, padding: "6px 10px", color: C.text }}>
          🌟 成交人：{getContributors(c).join(" + ")}
          {getContributors(c).length === 2 && <span style={{ color: C.textSub }}>（各 0.5）</span>}
        </div>
      )}
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
  const selectStatus = (status) => setForm(x => ({
    ...x,
    status,
    contributors: status === "success" ? uniqueNames((x.contributors || []).length ? x.contributors : [x.staff]) : x.contributors,
  }));
  const toggleContributor = (name) => setForm(x => {
    const current = uniqueNames(x.contributors);
    const next = current.includes(name) ? current.filter(v => v !== name) : uniqueNames([...current, name]);
    return { ...x, contributors: next };
  });
  return (
    <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 22, padding: 20, boxShadow: C.shadow, border: `1.5px solid ${C.border}` }}>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 18, color: C.primary }}>🌈 录入新顾客</div>

      <Input label="顾客姓名 *" value={f.name} onChange={e => set("name", e.target.value)} placeholder="请输入顾客姓名" />
      <Input label="手机号 *" value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="请输入11位手机号" type="tel" />
      <Input label="日期" value={f.date} onChange={e => set("date", e.target.value)} type="date" />

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>推荐员工</label>
        <select value={f.staff} onChange={e => onStaffChange(e.target.value)}
          style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.border}`, fontSize: 15, background: "#fff", outline: "none" }}>
          {allStaff.map(s => <option key={s.name + s.teamId} value={s.name}>{s.name}（{s.teamName}）</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>会员卡类型</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {settings.cardTypes.map(v => (
            <div key={v} onClick={() => set("card", v)} style={{
              padding: "9px 14px", borderRadius: 15, cursor: "pointer", fontSize: 14, fontWeight: 600,
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
            <div key={k} onClick={() => selectStatus(k)} style={{
              padding: "10px 0", borderRadius: 15, cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "center",
              background: f.status === k ? s.color : s.bg,
              color: f.status === k ? "#fff" : s.color,
              border: `1.5px solid ${f.status === k ? s.color : C.border}`
            }}>{s.icon} {s.label}</div>
          ))}
        </div>
      </div>

      {f.status === "success" && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>成交人（最多 2 人）</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {allStaff.map(s => {
              const picked = uniqueNames(f.contributors).includes(s.name);
              return (
                <div key={s.name + s.teamId} onClick={() => toggleContributor(s.name)} style={{
                  padding: "8px 12px", borderRadius: 14, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: picked ? C.success : C.successLight,
                  color: picked ? "#fff" : C.success,
                  border: `1.5px solid ${picked ? C.success : C.border}`,
                }}>{picked ? "✓ " : ""}{s.name}</div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 6 }}>选择 2 人时，每人按 0.5 单计入排名。</div>
        </div>
      )}

      {f.status === "failed" && (
        <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.accent, display: "block", marginBottom: 5, fontWeight: 500 }}>失败原因 *</label>
            <input value={f.failReason} onChange={e => set("failReason", e.target.value)} placeholder="请填写顾客拒绝原因"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.accent}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      {f.status === "following" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>当前跟进进展</label>
            <textarea value={f.followNote} onChange={e => set("followNote", e.target.value)} rows={2} placeholder="记录跟进状态..."
              style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>跟进负责人</label>
            <select value={f.followStaff} onChange={e => set("followStaff", e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.border}`, fontSize: 15, background: "#fff", outline: "none" }}>
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
  const [edit, setEdit] = useState({ status: c.status, failReason: c.failReason, followNote: c.followNote, followStaff: c.followStaff, contributors: getContributors(c) });
  const set = (k, v) => setEdit(x => ({ ...x, [k]: v }));
  const selectStatus = (status) => setEdit(x => ({
    ...x,
    status,
    contributors: status === "success" ? uniqueNames((x.contributors || []).length ? x.contributors : [c.staff]) : x.contributors,
  }));
  const toggleContributor = (name) => setEdit(x => {
    const current = uniqueNames(x.contributors);
    const next = current.includes(name) ? current.filter(v => v !== name) : uniqueNames([...current, name]);
    return { ...x, contributors: next };
  });
  const save = () => {
    if (edit.status === "success" && uniqueNames(edit.contributors).length === 0) return;
    onUpdate({ ...edit, contributors: uniqueNames(edit.contributors) });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto", boxShadow: C.shadowMd }}>
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
              <div key={k} onClick={() => selectStatus(k)} style={{
                padding: "10px 0", borderRadius: 15, cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "center",
                background: edit.status === k ? s.color : s.bg,
                color: edit.status === k ? "#fff" : s.color,
                border: `1.5px solid ${edit.status === k ? s.color : C.border}`
              }}>{s.icon} {s.label}</div>
            ))}
          </div>
        </div>

        {edit.status === "success" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>成交人（最多 2 人）</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {allStaff.map(s => {
                const picked = uniqueNames(edit.contributors).includes(s.name);
                return (
                  <div key={s.name + s.teamId} onClick={() => toggleContributor(s.name)} style={{
                    padding: "8px 12px", borderRadius: 14, cursor: "pointer", fontSize: 13, fontWeight: 700,
                    background: picked ? C.success : C.successLight,
                    color: picked ? "#fff" : C.success,
                    border: `1.5px solid ${picked ? C.success : C.border}`,
                  }}>{picked ? "✓ " : ""}{s.name}</div>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 6 }}>选择 2 人时，每人按 0.5 单计入排名。</div>
          </div>
        )}

        {edit.status === "failed" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.accent, display: "block", marginBottom: 5, fontWeight: 500 }}>失败原因</label>
            <input value={edit.failReason} onChange={e => set("failReason", e.target.value)} placeholder="请填写拒绝原因"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.accent}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
        )}

        {edit.status === "following" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>跟进进展备注</label>
              <textarea value={edit.followNote} onChange={e => set("followNote", e.target.value)} rows={3} placeholder="记录当前跟进状态..."
                style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 500 }}>转交给</label>
              <select value={edit.followStaff} onChange={e => set("followStaff", e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 15, border: `1.5px solid ${C.border}`, fontSize: 15, background: "#fff", outline: "none" }}>
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
function StatsPanel({ teamStats, staffStats, historyStaffStats, historySummary, historyRange, setHistoryRange, showToast }) {
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
  const maxWon = Math.max(1, ...teamStats.map(t => t.won));
  const dailyRank = [...staffStats].sort((a, b) => b.wonT - a.wonT || b.todayTotal - a.todayTotal || a.name.localeCompare(b.name, "zh-CN"));
  const topThree = dailyRank.slice(0, 3);
  const restDaily = dailyRank.slice(3);
  const maxHistoryWon = Math.max(1, ...historyStaffStats.map(s => s.won));
  const totalCredit = historyStaffStats.reduce((sum, s) => sum + s.won, 0);
  const todayDeals = staffStats.reduce((sum, s) => sum + s.wonT, 0);
  const todayEntries = staffStats.reduce((sum, s) => sum + s.todayTotal, 0);
  const leadingTeam = [...teamStats].sort((a, b) => b.wonT - a.wonT || b.todayTotal - a.todayTotal || b.won - a.won)[0];
  const celebratedTeams = teamStats.filter(t => t.wonT > 0 || t.todayTotal > 0);

  const quickRange = (type) => {
    if (type === "today") setHistoryRange({ start: today(), end: today() });
    if (type === "week") setHistoryRange({ start: daysAgo(6), end: today() });
    if (type === "month") setHistoryRange({ start: monthStart(), end: today() });
  };
  const copyDailyReport = async () => {
    const text = buildDailyReportText(dailyRank, todayDeals, todayEntries, leadingTeam, celebratedTeams);
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const image = await createDailyReportImage({ dailyRank, totalDeals: todayDeals, totalEntries: todayEntries, leadingTeam, celebratedTeams });
        await navigator.clipboard.write([
          new window.ClipboardItem({
            "image/png": image,
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
        showToast("success", "已复制喜报图，去微信粘贴发送");
        return;
      }
      throw new Error("当前浏览器不支持图片复制");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        showToast("success", "已复制喜报文字，去微信粘贴发送");
      } catch {
        showToast("error", "复制失败，请换浏览器或手动截图");
      }
    }
  };

  return (
    <div>
      <style>{`
        @keyframes jbConfettiFall {
          0% { transform: translateY(-18px) rotate(0deg); opacity: .15; }
          50% { opacity: .85; }
          100% { transform: translateY(130px) rotate(240deg); opacity: .05; }
        }
        @keyframes jbWinnerGlow {
          0%, 100% { transform: translateY(0); box-shadow: 0 12px 30px rgba(255, 184, 77, .28); }
          50% { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(255, 122, 156, .32); }
        }
        @keyframes jbFirework {
          0%, 100% { transform: scale(.76); opacity: .25; }
          45% { transform: scale(1.12); opacity: .72; }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>今日喜报</div>
        <Btn small color={C.accent} onClick={copyDailyReport}>复制到微信</Btn>
      </div>

      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, rgba(255,246,166,.92), rgba(255,210,228,.9) 48%, rgba(189,235,255,.92))", borderRadius: 24, padding: 18, boxShadow: C.shadowMd, border: "1.5px solid rgba(255,255,255,.78)", marginBottom: 14 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{
            position: "absolute",
            top: -20,
            left: `${(i * 17) % 100}%`,
            width: i % 3 === 0 ? 10 : 7,
            height: i % 3 === 0 ? 18 : 12,
            borderRadius: i % 2 === 0 ? 5 : 2,
            background: [C.accent, C.primary, C.success, C.warn, C.purple][i % 5],
            opacity: 0.55,
            animation: `jbConfettiFall ${3.2 + (i % 5) * 0.55}s linear ${i * 0.17}s infinite`,
          }} />
        ))}
        {[
          { left: "11%", top: "12%", color: C.accent },
          { left: "86%", top: "16%", color: C.primary },
          { left: "78%", top: "78%", color: C.warn },
        ].map((item, i) => (
          <span key={`fw-${i}`} style={{
            position: "absolute",
            left: item.left,
            top: item.top,
            width: 68,
            height: 68,
            borderRadius: 999,
            background: `radial-gradient(circle, ${item.color} 0 5%, transparent 6% 100%)`,
            boxShadow: `0 -26px 0 -24px ${item.color}, 0 26px 0 -24px ${item.color}, 26px 0 0 -24px ${item.color}, -26px 0 0 -24px ${item.color}, 18px 18px 0 -24px ${item.color}, -18px -18px 0 -24px ${item.color}, -18px 18px 0 -24px ${item.color}, 18px -18px 0 -24px ${item.color}`,
            animation: `jbFirework ${1.8 + i * 0.35}s ease-in-out ${i * 0.2}s infinite`,
            opacity: 0.6,
          }} />
        ))}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <MiniStat label="今日成交" value={`${creditText(todayDeals)} 单`} color={C.accent} />
            <MiniStat label="今日录入" value={`${todayEntries} 位`} color={C.primary} />
            <MiniStat label="跟进加油" value="继续冲" color={C.success} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr .95fr .95fr", gap: 8, alignItems: "end", marginBottom: 14 }}>
            {topThree.map((s, i) => {
              const order = i === 0 ? 0 : i === 1 ? 1 : 2;
              const colors = [
                ["#FFD76A", "#FF7A9C"],
                ["#DCE8FF", "#5BA7FF"],
                ["#FFD9B0", "#FF9F43"],
              ];
              return (
                <div key={s.name + s.teamId} style={{
                  minHeight: i === 0 ? 145 : 120,
                  borderRadius: 22,
                  padding: "14px 10px",
                  textAlign: "center",
                  background: `linear-gradient(160deg, ${colors[order][0]}, rgba(255,255,255,.92))`,
                  border: "1.5px solid rgba(255,255,255,.82)",
                  animation: i === 0 ? "jbWinnerGlow 2.8s ease-in-out infinite" : "none",
                  boxShadow: "0 12px 26px rgba(103,87,160,.14)",
                }}>
                  <div style={{ fontSize: i === 0 ? 31 : 25, lineHeight: 1 }}>{medal(i)}</div>
                  <div style={{ fontWeight: 900, fontSize: i === 0 ? 18 : 15, marginTop: 8 }}>{s.name}</div>
                  <div style={{ color: C.textSub, fontSize: 12, marginTop: 3 }}>{s.teamName}</div>
                  <div style={{ color: colors[order][1], fontWeight: 900, fontSize: i === 0 ? 24 : 20, marginTop: 8 }}>{creditText(s.wonT)}</div>
                  <div style={{ color: C.textSub, fontSize: 12 }}>今日成交</div>
                  <div style={{ color: C.textSub, fontSize: 11, marginTop: 4 }}>成交率 {pctText(s.wonT, s.todayTotal)}</div>
                </div>
              );
            })}
          </div>

          {restDaily.map((s, i) => (
            <RankRow key={s.name + s.teamId} rank={i + 4} name={s.name} sub={`${s.teamName} · 今日录入 ${s.todayTotal}`} value={`${creditText(s.wonT)} 单`} rate={pctText(s.wonT, s.todayTotal)} color={C.primary} />
          ))}
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 22, padding: 18, boxShadow: C.shadow, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>历史成交查询</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small outline color={C.primary} onClick={() => quickRange("today")}>今天</Btn>
            <Btn small outline color={C.primary} onClick={() => quickRange("week")}>7天</Btn>
            <Btn small outline color={C.primary} onClick={() => quickRange("month")}>本月</Btn>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <Input label="开始日期" value={historyRange.start} type="date" onChange={e => setHistoryRange(r => ({ ...r, start: e.target.value }))} />
          <Input label="结束日期" value={historyRange.end} type="date" onChange={e => setHistoryRange(r => ({ ...r, end: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <MiniStat label="录入" value={historySummary.total} color={C.primary} />
          <MiniStat label="成交" value={historySummary.won} color={C.success} />
          <MiniStat label="跟进" value={historySummary.following} color={C.warn} />
          <MiniStat label="失败" value={historySummary.failed} color={C.accent} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>个人历史排名</div>
        {historyStaffStats.map((s, i) => (
          <div key={s.name + s.teamId} style={{ marginBottom: 10 }}>
            <RankRow rank={i + 1} name={s.name} sub={`${s.teamName} · 参与 ${s.total} 位`} value={`${creditText(s.won)} 单`} rate={`成交率 ${pctText(s.won, s.total)}`} color={[C.warn, C.primary, C.success, C.purple, C.accent][i % 5]} />
            <div style={{ height: 7, borderRadius: 5, background: C.border }}>
              <div style={{ height: "100%", borderRadius: 5, background: [C.warn, C.primary, C.success, C.purple, C.accent][i % 5], width: `${Math.max(4, (s.won / maxHistoryWon) * 100)}%`, transition: "width .6s" }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 8 }}>区间成交积分合计：{creditText(totalCredit)} 单；两人合作成交时每人计 0.5 单。</div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 22, padding: 18, boxShadow: C.shadow, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>战队累计排行</div>
        {teamStats.map((t, i) => (
          <div key={t.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{medal(i)} {t.name}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 13, color: C.primary, fontWeight: 800 }}>{creditText(t.won)} 单成交</span>
                <span style={{ fontSize: 12, color: C.textSub, marginLeft: 8 }}>今日 {creditText(t.wonT)} · 录入 {t.total}</span>
              </div>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: C.border }}>
              <div style={{ height: "100%", borderRadius: 5, background: [C.accent, C.primary, C.success, C.warn, C.purple][i % 5], width: `${Math.max(4, (t.won / maxWon) * 100)}%`, transition: "width .6s" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,.76)", borderRadius: 16, padding: "10px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,.88)" }}>
      <div style={{ color, fontWeight: 900, fontSize: 18 }}>{value}</div>
      <div style={{ color: C.textSub, fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RankRow({ rank, name, sub, value, rate, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
      <div style={{ width: 30, height: 30, borderRadius: 15, background: `${color}22`, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{name}</div>
        <div style={{ color: C.textSub, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color, fontWeight: 900, fontSize: 15 }}>{value}</div>
        <div style={{ color: C.textSub, fontSize: 11 }}>{rate}</div>
      </div>
    </div>
  );
}

// ─── 设置面板 ─────────────────────────────────────────────────────
function SettingsPanel({ settings, onUpdate, showToast, onExport, onImport }) {
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

      <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 22, padding: 18, boxShadow: C.shadow, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📦 数据备份</div>
        <div style={{ color: C.textSub, fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>可以把云端数据导出到本地文件，也可以从本地备份文件导入并覆盖云端数据。</div>
        <input id="jb-import-file" type="file" accept="application/json,.json" onChange={onImport} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={onExport} style={{ flex: 1 }}>导出到本地</Btn>
          <Btn outline color={C.primary} onClick={() => document.getElementById("jb-import-file")?.click()} style={{ flex: 1 }}>本地导入</Btn>
        </div>
      </div>

      {/* 会员卡类型 */}
      <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 22, padding: 18, boxShadow: C.shadow, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
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
      <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 22, padding: 18, boxShadow: C.shadow, border: `1.5px solid ${C.border}`, marginBottom: 14 }}>
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
