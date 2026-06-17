const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: process.env.ENV_ID || cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const CUSTOMERS = "jb_customers";
const SETTINGS = "jb_settings";
const SETTINGS_ID = "main";

const DEFAULT_SETTINGS = {
  cardTypes: ["京贝体验会员卡", "京贝年度会员卡"],
  teams: [
    { id: "t1", name: "红队", members: ["王小明", "李华"] },
    { id: "t2", name: "蓝队", members: ["张芳", "赵磊"] },
    { id: "t3", name: "绿队", members: ["陈静", "刘阳"] },
  ],
};

const today = () => new Date().toISOString().slice(0, 10);

const sampleCustomers = () => [
  { id: 1, name: "张小宝", phone: "13800001111", staff: "王小明", teamId: "t1", date: today(), card: "京贝体验会员卡", status: "success", failReason: "", followNote: "", followStaff: "王小明" },
  { id: 2, name: "李彤彤", phone: "13900002222", staff: "张芳", teamId: "t2", date: today(), card: "京贝体验会员卡", status: "following", failReason: "", followNote: "已发微信，等回复", followStaff: "张芳" },
  { id: 3, name: "王大毛", phone: "13700003333", staff: "陈静", teamId: "t3", date: today(), card: "京贝年度会员卡", status: "failed", failReason: "价格太贵，暂不考虑", followNote: "", followStaff: "陈静" },
  { id: 4, name: "赵小花", phone: "13600004444", staff: "李华", teamId: "t1", date: today(), card: "京贝体验会员卡", status: "pending", failReason: "", followNote: "", followStaff: "李华" },
];

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (message, statusCode = 400) => ({ ok: false, statusCode, message });

const readBody = (event) => {
  if (!event) return {};
  if (event.body) {
    try {
      return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {};
    }
  }
  return event;
};

const withHeaders = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  },
  body: JSON.stringify(body),
});

async function countCollection(collectionName) {
  try {
    const result = await db.collection(collectionName).count();
    return result.total || 0;
  } catch {
    return 0;
  }
}

async function ensureSeedData() {
  const customerCount = await countCollection(CUSTOMERS);
  if (customerCount === 0) {
    await Promise.all(sampleCustomers().map((item) => db.collection(CUSTOMERS).add({
      ...item,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })));
  }

  const settings = await db.collection(SETTINGS).doc(SETTINGS_ID).get().catch(() => ({ data: [] }));
  if (!settings.data || settings.data.length === 0) {
    await db.collection(SETTINGS).doc(SETTINGS_ID).set({
      ...DEFAULT_SETTINGS,
      updatedAt: Date.now(),
    });
  }
}

async function loadData() {
  await ensureSeedData();
  const [customersRes, settingsRes] = await Promise.all([
    db.collection(CUSTOMERS).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection(SETTINGS).doc(SETTINGS_ID).get(),
  ]);

  const customers = (customersRes.data || []).map(({ _id, ...item }) => item);
  const settingsDoc = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
  const { _id, updatedAt, ...settings } = settingsDoc || { ...DEFAULT_SETTINGS };
  return ok({ customers, settings });
}

async function addCustomer(customer) {
  const now = Date.now();
  const id = customer.id || now;
  await db.collection(CUSTOMERS).add({
    ...customer,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return ok({ id });
}

async function updateCustomer(id, patch) {
  const found = await db.collection(CUSTOMERS).where({ id }).limit(1).get();
  if (!found.data || found.data.length === 0) return fail("未找到顾客记录", 404);

  await db.collection(CUSTOMERS).doc(found.data[0]._id).update({
    ...patch,
    updatedAt: Date.now(),
  });
  return ok();
}

async function deleteCustomer(id) {
  const found = await db.collection(CUSTOMERS).where({ id }).limit(1).get();
  if (!found.data || found.data.length === 0) return ok();

  await db.collection(CUSTOMERS).doc(found.data[0]._id).remove();
  return ok();
}

async function saveSettings(settings) {
  await db.collection(SETTINGS).doc(SETTINGS_ID).set({
    ...settings,
    updatedAt: Date.now(),
  });
  return ok();
}

async function clearCustomers() {
  while (true) {
    const existing = await db.collection(CUSTOMERS).limit(1000).get().catch(() => ({ data: [] }));
    if (!existing.data || existing.data.length === 0) break;
    await Promise.all(existing.data.map((item) => db.collection(CUSTOMERS).doc(item._id).remove()));
    if (existing.data.length < 1000) break;
  }
}

async function replaceAll(customers, settings) {
  if (!Array.isArray(customers) || !settings || !Array.isArray(settings.teams) || !Array.isArray(settings.cardTypes)) {
    return fail("导入文件格式不正确");
  }

  await clearCustomers();
  const now = Date.now();
  await Promise.all(customers.slice(0, 5000).map((item, index) => db.collection(CUSTOMERS).add({
    ...item,
    id: item.id || now + index,
    createdAt: item.createdAt || now + index,
    updatedAt: now,
  })));

  await db.collection(SETTINGS).doc(SETTINGS_ID).set({
    ...settings,
    updatedAt: now,
  });

  return ok({ count: customers.length });
}

async function handleAction(body) {
  const action = body.action;
  let result;

  if (action === "load") result = await loadData();
  else if (action === "addCustomer") result = await addCustomer(body.customer);
  else if (action === "updateCustomer") result = await updateCustomer(body.id, body.patch);
  else if (action === "deleteCustomer") result = await deleteCustomer(body.id);
  else if (action === "saveSettings") result = await saveSettings(body.settings);
  else if (action === "replaceAll") result = await replaceAll(body.customers, body.settings);
  else result = fail("未知操作");

  return result;
}

exports.main = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return withHeaders(ok());

  try {
    const result = await handleAction(readBody(event));
    return withHeaders(result, result.statusCode || 200);
  } catch (error) {
    console.error(error);
    return withHeaders(fail(error.message || "服务器错误", 500), 500);
  }
};

if (require.main === module) {
  const http = require("http");
  const port = Number(process.env.PORT || 9000);

  http.createServer((req, res) => {
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "POST,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", async () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        const result = await handleAction(body);
        res.writeHead(result.statusCode || 200);
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end(JSON.stringify(fail(error.message || "服务器错误", 500)));
      }
    });
  }).listen(port, () => {
    console.log(`jbApi listening on ${port}`);
  });
}
