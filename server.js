require("dotenv").config();
const express = require("express");
const http = require("http");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "game.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 coins INTEGER NOT NULL DEFAULT 0,
 total_score INTEGER NOT NULL DEFAULT 0,
 games_played INTEGER NOT NULL DEFAULT 0,
 is_admin INTEGER NOT NULL DEFAULT 0,
 is_banned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inventory (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_id TEXT NOT NULL,
 PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (
 code TEXT PRIMARY KEY,
 host_id INTEGER NOT NULL,
 state TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS room_players (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id),
 seat INTEGER NOT NULL,
 score INTEGER NOT NULL DEFAULT 0,
 is_host INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(room_code,user_id)
);
CREATE TABLE IF NOT EXISTS matches (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_code TEXT NOT NULL,
 completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 round_count INTEGER NOT NULL,
 results_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS match_payouts (
 match_id INTEGER NOT NULL REFERENCES matches(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 coins INTEGER NOT NULL,
 PRIMARY KEY(match_id,user_id)
);
CREATE TABLE IF NOT EXISTS bans (
 user_id INTEGER PRIMARY KEY REFERENCES users(id),
 reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
const sessionStore = new SQLiteStore({ db: "sessions.db", dir: dataDir });
const sessionMiddleware = session({
  name: "ugm.sid",
  secret: process.env.SESSION_SECRET || "development-secret-change-before-deploy",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(sessionMiddleware);
// Custom avatar uploads are stored in SQLite as data URLs so they survive app restarts
// when the database is on persistent storage. Limit uploads to 2 MiB.
app.post("/api/profile/avatar-upload", requireAuth, express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "2mb" }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Выбери файл PNG, JPG или WebP" });
  const b = req.body;
  const mime = req.headers["content-type"];
  const isPng = mime === "image/png" && b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg = mime === "image/jpeg" && b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isWebp = mime === "image/webp" && b.length >= 12 && b.toString("ascii",0,4) === "RIFF" && b.toString("ascii",8,12) === "WEBP";
  if (!isPng && !isJpeg && !isWebp) return res.status(400).json({ error: "Файл должен быть настоящим изображением PNG, JPG или WebP" });
  const avatar = `data:${mime};base64,${b.toString("base64")}`;
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("avatar:"+req.session.userId, avatar);
  for (const r of roomCache.values()) {
    const player = r.players.find(p => p.id === req.session.userId);
    if (player) { player.avatar = avatar; emitRoom(r); }
  }
  res.json({ user: getProfile(req.session.userId) });
});
app.use(express.static(path.join(__dirname, "public")));

const adminName = process.env.ADMIN_USERNAME || "admin";
if (process.env.ADMIN_PASSWORD && !db.prepare("SELECT id FROM users WHERE username=?").get(adminName)) {
  db.prepare("INSERT INTO users(username,password_hash,is_admin) VALUES(?,?,1)")
    .run(adminName, bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12));
}

const catalog = [
  {id:"cover_default",name:"Классика",price:0,description:"Чистый стандартный стиль",className:"skin-default"},
  {id:"cover_mint",name:"Мятная",price:100,description:"Свежий минималистичный оттенок",className:"skin-mint"},
  {id:"cover_sunset",name:"Закат",price:250,description:"Тёплый спокойный градиент",className:"skin-sunset"},
  {id:"cover_midnight",name:"Полночь",price:400,description:"Глубокий синий стиль",className:"skin-midnight"},
  {id:"cover_gold",name:"Золото",price:600,description:"Премиальное оформление",className:"skin-gold",pairName:"Золотой дуэт"},
  {id:"cover_pixel",name:"Pixel World",price:350,description:"Парный набор: пиксельная мем-карта и ретро-карта ситуации",className:"skin-pixel",pairName:"Pixel Duo"},
  {id:"cover_neon",name:"Cyber Neon",price:500,description:"Парный набор: неоновая мем-карта и кибер-ситуация",className:"skin-neon",pairName:"Cyber Duo"},
  {id:"cover_horror",name:"Nightmare",price:550,description:"Парный набор: мрачная мем-карта и карта ситуации с тревожной рамкой",className:"skin-horror",pairName:"Nightmare Duo"},
  {id:"cover_comic",name:"Comic Boom",price:300,description:"Парный набор: яркая мем-карта и комиксная ситуация",className:"skin-comic",pairName:"Comic Duo"},
  {id:"cover_vapor",name:"Vapor Dream",price:450,description:"Парный набор: vaporwave-мем и карта ситуации в стиле 80-х",className:"skin-vapor",pairName:"Vapor Duo"},
  {id:"cover_kawaii",name:"Kawaii",price:300,description:"Парный набор: пастельная мем-карта и милая карта ситуации",className:"skin-kawaii",pairName:"Kawaii Duo"},
  {id:"cover_glitch",name:"Glitch.exe",price:500,description:"Парный набор: цифровая мем-карта и глитч-ситуация",className:"skin-glitch",pairName:"Glitch Duo"}
];
const situationsByMeme = {
  "Да поебать мне": [
    "Когда тебе сообщили, что завтра опять понедельник",
    "Когда узнал, что цены снова выросли",
    "Когда друг в пятый раз отменил встречу"
  ],
  "Завтрак чемпиона": [
    "Когда на завтрак осталось три крошки и чай",
    "Когда решил питаться правильно, но увидел вчерашнюю пиццу",
    "Когда до зарплаты ещё неделя, а холодильник уже пуст"
  ],
  "Вас заметили": [
    "Когда пытался незаметно списать, но учитель смотрит прямо на тебя",
    "Когда лайкнул фото пятилетней давности",
    "Когда зашёл не в тот кабинет и все обернулись"
  ],
  "Пиздец, где я?": [
    "Когда проснулся после вечеринки и не узнаёшь комнату",
    "Когда свернул не туда и телефон потерял сеть",
    "Когда открыл историю браузера после друга"
  ],
  "Бильярд": [
    "Когда хотел сыграть одну партию, а уже закрывают заведение",
    "Когда объясняешь правила, хотя сам играешь впервые",
    "Когда случайно сделал идеальный удар и делаешь вид, что так и задумано"
  ],
  "OZON ПИВZON": [
    "Когда зашёл забрать одну посылку и вышел с пятью",
    "Когда пункт выдачи стал твоим вторым домом",
    "Когда заказал полезную вещь, а пришло что-то совершенно другое"
  ],
  "Суровый тип": [
    "Когда сказали, что сегодня без домашнего задания",
    "Когда в компании начался спор и ты решил молча наблюдать",
    "Когда попросили помочь с переездом в воскресенье утром"
  ],
  "Хаййвет, плесень": [
    "Когда встретил знакомого, которого не видел со школы",
    "Когда зашёл в чат после месяца молчания",
    "Когда увидел старые фотографии и вспомнил всё"
  ],
  "Сладкое ёжки": [
    "Когда увидел скидку на любимые конфеты",
    "Когда обещал съесть только одну печеньку",
    "Когда принесли десерт, хотя ты уже наелся"
  ],
  "Нет, я с горла": [
    "Когда предложили попробовать напиток с непонятным составом",
    "Когда все чокаются, а ты не знаешь, что налили",
    "Когда официант спрашивает, будете ли добавку"
  ],
  "Весёлый / не весёлый": [
    "Когда говоришь «всё нормально», хотя день пошёл не по плану",
    "Когда увидел оценку за контрольную",
    "Когда друг спросил, как прошли выходные"
  ],
  "Очень близко": [
    "Когда почти попал в автобус, но двери закрылись перед носом",
    "Когда до дедлайна осталось две минуты, а файл не сохранился",
    "Когда промахнулся на один балл до победы"
  ],
  "Урологическое отделение №2": [
    "Когда перепутал дверь и понял это слишком поздно",
    "Когда пришёл по одному адресу, а вывеска обещает совсем другое",
    "Когда навигатор привёл тебя в максимально странное место"
  ],
  "Да ладно? Серьёзно?": [
    "Когда друг сказал, что посмотрел весь сериал за ночь",
    "Когда увидел сумму в чеке после фразы «это недорого»",
    "Когда узнал, что завтра выходной"
  ],
  "Шок": [
    "Когда случайно отправил сообщение не в тот чат",
    "Когда увидел результат экзамена",
    "Когда приложение списало деньги за подписку, о которой ты забыл"
  ],
  "Пожимает плечами": [
    "Когда спросили, почему всё сломалось, а ты просто проходил мимо",
    "Когда никто не знает, кто съел последний кусок",
    "Когда план провалился, но запасного плана не было"
  ],
  "Сомнительно, но окей": [
    "Когда друг предлагает «короткий путь» через лес",
    "Когда незнакомец говорит, что знает способ заработать за час",
    "Когда инструкция состоит из слов «просто нажми сюда»"
  ],
  "Срамота!": [
    "Когда на весь класс включилось твоё случайное аудио",
    "Когда споткнулся на ровном месте перед толпой",
    "Когда назвал преподавателя мамой"
  ],
  "Ну как так-то?": [
    "Когда интернет пропал ровно перед отправкой работы",
    "Когда приготовил ужин и уронил его на пол",
    "Когда автобус уехал, пока ты доставал проездной"
  ]
};
const memes = ["Да поебать мне", "Завтрак чемпиона", "Вас заметили", "Пиздец, где я?", "Бильярд", "OZON ПИВZON", "Суровый тип", "Хаййвет, плесень", "Сладкое ёжки", "Нет, я с горла", "Весёлый / не весёлый", "Очень близко", "Урологическое отделение №2", "Да ладно? Серьёзно?", "Шок", "Пожимает плечами", "Сомнительно, но окей", "Срамота!", "Ну как так-то?"];

const requireAuth = (req,res,next) => req.session.userId ? next() : res.status(401).json({error:"Сначала войдите в аккаунт"});
const requireAdmin = (req,res,next) => {
  if (!req.session.userId) return res.status(401).json({error:"Требуется вход"});
  const user = db.prepare("SELECT is_admin FROM users WHERE id=?").get(req.session.userId);
  if (!user?.is_admin) return res.status(403).json({error:"Недостаточно прав"});
  next();
};
function getProfile(id) {
  const user = db.prepare("SELECT id,username,coins,total_score,games_played,is_admin FROM users WHERE id=?").get(id);
  if (!user) return null;
  const owned = db.prepare("SELECT item_id FROM inventory WHERE user_id=?").all(id).map(x=>x.item_id);
  if (!owned.includes("table_classic")) owned.push("table_classic");
  const equipped = db.prepare("SELECT value FROM settings WHERE key=?").get("equipped:"+id)?.value || "cover_default";
  const theme = db.prepare("SELECT value FROM settings WHERE key=?").get("theme:"+id)?.value || "dark";
  const tableSkin = db.prepare("SELECT value FROM settings WHERE key=?").get("table-skin:"+id)?.value || "table_classic";
  const avatar = db.prepare("SELECT value FROM settings WHERE key=?").get("avatar:"+id)?.value || "🙂";
  return {...user, owned, equipped, theme, tableSkin, avatar};
}

app.get("/api/me",(req,res)=>res.json({user:req.session.userId ? getProfile(req.session.userId) : null}));
app.post("/api/profile/update",requireAuth,(req,res)=>{
  const username=String(req.body.username||"").trim();
  const avatar=String(req.body.avatar||"");
  const allowedAvatars=["🙂","😎","🤩","😂","😈","👻","🤖","🐱","🐸","🦊","🐼","🐵","🐙","🦄","💀","👑"];
  if(!/^[\p{L}\p{N}_-]{3,18}$/u.test(username)) return res.status(400).json({error:"Ник: 3–18 символов, буквы, цифры, _ или -"});
  const currentAvatar=db.prepare("SELECT value FROM settings WHERE key=?").get("avatar:"+req.session.userId)?.value || "🙂";
  if(avatar && !allowedAvatars.includes(avatar) && avatar!==currentAvatar) return res.status(400).json({error:"Загрузи изображение или выбери аватар из списка"});
  try {
    db.prepare("UPDATE users SET username=? WHERE id=?").run(username,req.session.userId);
  } catch(e) {
    if(String(e.code||"").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({error:"Этот ник уже занят"});
    throw e;
  }
  if(avatar && allowedAvatars.includes(avatar)) db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("avatar:"+req.session.userId,avatar);
  const savedAvatar=avatar || currentAvatar;
  for(const r of roomCache.values()) {
    const player=r.players.find(p=>p.id===req.session.userId);
    if(player) { player.username=username; player.avatar=savedAvatar; emitRoom(r); }
  }
  const activeSocket=[...io.sockets.sockets.values()].find(sock=>sock.userId===req.session.userId);
  if(activeSocket) activeSocket.username=username;
  res.json({user:getProfile(req.session.userId)});
});
app.post("/api/profile/theme",requireAuth,(req,res)=>{
  const theme=String(req.body.theme||"");
  if(!["dark","comic","light","neon","vaporwave","8bit","horror","y2k","hacker","pastel"].includes(theme)) return res.status(400).json({error:"Неизвестная тема оформления"});
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("theme:"+req.session.userId,theme);
  res.json({user:getProfile(req.session.userId)});
});
app.post("/api/register",(req,res)=>{
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!/^[\p{L}\p{N}_-]{3,18}$/u.test(username)) return res.status(400).json({error:"Имя: 3–18 символов, буквы, цифры, _ или -"});
  if (password.length < 8 || password.length > 128) return res.status(400).json({error:"Пароль должен содержать от 8 до 128 символов"});
  try {
    const result = db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username,bcrypt.hashSync(password,12));
    db.prepare("INSERT INTO inventory(user_id,item_id) VALUES(?,?)").run(result.lastInsertRowid,"cover_default");
    req.session.regenerate(err=>{
      if (err) return res.status(500).json({error:"Не удалось создать сессию"});
      req.session.userId = Number(result.lastInsertRowid);
      res.json({user:getProfile(req.session.userId)});
    });
  } catch { res.status(409).json({error:"Это имя уже занято"}); }
});
app.post("/api/login",(req,res)=>{
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(String(req.body.username||"").trim());
  if (!user || !bcrypt.compareSync(String(req.body.password||""),user.password_hash)) return res.status(401).json({error:"Неверное имя или пароль"});
  if (user.is_banned) return res.status(403).json({error:"Аккаунт заблокирован"});
  req.session.regenerate(err=>{
    if (err) return res.status(500).json({error:"Не удалось создать сессию"});
    req.session.userId = user.id;
    res.json({user:getProfile(user.id)});
  });
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
const tableCatalog = [
  {id:"table_classic",name:"Классический стол",price:0,description:"Чистая игровая площадка",className:"table-classic"},
  {id:"table_pixel",name:"Pixel Arcade",price:400,description:"Пиксельная арена с ретро-сеткой",className:"table-pixel"},
  {id:"table_neon",name:"Cyber Arena",price:550,description:"Киберпанк и неоновые линии",className:"table-neon"},
  {id:"table_horror",name:"Dark Basement",price:600,description:"Мрачный стол с красными акцентами",className:"table-horror"},
  {id:"table_comic",name:"Comic Stage",price:350,description:"Яркая комиксная сцена",className:"table-comic"},
  {id:"table_vapor",name:"Sunset Grid",price:500,description:"Розово-фиолетовый ретро-закат",className:"table-vapor"},
  {id:"table_kawaii",name:"Cloud Café",price:350,description:"Пастельные облака и звёзды",className:"table-kawaii"},
  {id:"table_glitch",name:"Хакерская / Matrix",price:550,description:"Зелёный цифровой мир с потоками кода",className:"table-glitch"},
  {id:"table_light",name:"Светлая арена",price:300,description:"Голубое небо, облака и чистая игровая площадка",className:"table-light"},
  {id:"table_y2k",name:"Y2K Dream",price:500,description:"Хром, глянцевые формы и голубой металлик",className:"table-y2k"},
  {id:"table_pastel",name:"Pastel Garden",price:350,description:"Нежные облака, звёзды и пастельные оттенки",className:"table-pastel"}
];
app.get("/api/shop",(req,res)=>res.json({items:catalog,tableItems:tableCatalog}));
app.post("/api/shop/buy",requireAuth,(req,res)=>{
  const item = catalog.find(x=>x.id===req.body.itemId);
  if (!item) return res.status(404).json({error:"Товар не найден"});
  try {
    db.transaction(()=>{
      if (db.prepare("SELECT 1 FROM inventory WHERE user_id=? AND item_id=?").get(req.session.userId,item.id)) throw Error("Уже куплено");
      const user = db.prepare("SELECT coins FROM users WHERE id=?").get(req.session.userId);
      if (user.coins < item.price) throw Error("Недостаточно монет");
      db.prepare("UPDATE users SET coins=coins-? WHERE id=?").run(item.price,req.session.userId);
      db.prepare("INSERT INTO inventory(user_id,item_id) VALUES(?,?)").run(req.session.userId,item.id);
    })();
    res.json({user:getProfile(req.session.userId)});
  } catch(e) { res.status(400).json({error:e.message}); }
});
app.post("/api/shop/equip",requireAuth,(req,res)=>{
  const id = String(req.body.itemId||"");
  if (!db.prepare("SELECT 1 FROM inventory WHERE user_id=? AND item_id=?").get(req.session.userId,id)) return res.status(400).json({error:"Сначала приобретите эту обложку"});
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("equipped:"+req.session.userId,id);
  res.json({user:getProfile(req.session.userId)});
});
app.post("/api/shop/table-buy",requireAuth,(req,res)=>{
  const item=tableCatalog.find(x=>x.id===req.body.itemId);
  if(!item) return res.status(404).json({error:"Скин стола не найден"});
  try { db.transaction(()=>{
    if(db.prepare("SELECT 1 FROM inventory WHERE user_id=? AND item_id=?").get(req.session.userId,item.id)) throw Error("Уже куплено");
    const user=db.prepare("SELECT coins FROM users WHERE id=?").get(req.session.userId);
    if(user.coins<item.price) throw Error("Недостаточно монет");
    db.prepare("UPDATE users SET coins=coins-? WHERE id=?").run(item.price,req.session.userId);
    db.prepare("INSERT INTO inventory(user_id,item_id) VALUES(?,?)").run(req.session.userId,item.id);
  })(); res.json({user:getProfile(req.session.userId)}); } catch(e){res.status(400).json({error:e.message});}
});
app.post("/api/shop/table-equip",requireAuth,(req,res)=>{
  const id=String(req.body.itemId||"");
  if(!tableCatalog.some(x=>x.id===id) || !db.prepare("SELECT 1 FROM inventory WHERE user_id=? AND item_id=?").get(req.session.userId,id)) return res.status(400).json({error:"Сначала приобретите этот стол"});
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("table-skin:"+req.session.userId,id);
  res.json({user:getProfile(req.session.userId)});
});
app.get("/api/leaderboard",(req,res)=>{const players=db.prepare("SELECT id,username,total_score,games_played FROM users WHERE is_banned=0 ORDER BY total_score DESC LIMIT 30").all().map(p=>({...p,avatar:db.prepare("SELECT value FROM settings WHERE key=?").get("avatar:"+p.id)?.value||"🙂"}));res.json({players})});

app.get("/api/admin/overview",requireAdmin,(req,res)=>{
  res.json({
    users:db.prepare("SELECT id,username,coins,total_score,games_played,is_banned,is_admin,created_at FROM users ORDER BY id DESC LIMIT 200").all(),
    rooms:db.prepare("SELECT code,host_id,state,created_at,updated_at FROM rooms ORDER BY updated_at DESC").all(),
    matches:db.prepare("SELECT id,room_code,completed_at,round_count,results_json FROM matches ORDER BY id DESC LIMIT 30").all()
  });
});
app.post("/api/admin/user/:id/ban",requireAdmin,(req,res)=>{
  const id=Number(req.params.id), reason=String(req.body.reason||"Нарушение правил").slice(0,200);
  const user=db.prepare("SELECT id,is_admin FROM users WHERE id=?").get(id);
  if(!user || user.is_admin) return res.status(400).json({error:"Нельзя заблокировать этого пользователя"});
  db.prepare("UPDATE users SET is_banned=1 WHERE id=?").run(id);
  db.prepare("INSERT INTO bans(user_id,reason) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,created_at=CURRENT_TIMESTAMP").run(id,reason);
  for(const s of io.sockets.sockets.values()) if(s.userId===id) s.disconnect(true);
  res.json({ok:true});
});
app.post("/api/admin/user/:id/unban",requireAdmin,(req,res)=>{
  db.prepare("UPDATE users SET is_banned=0 WHERE id=?").run(Number(req.params.id));
  db.prepare("DELETE FROM bans WHERE user_id=?").run(Number(req.params.id));
  res.json({ok:true});
});
app.post("/api/admin/user/:id/coins",requireAdmin,(req,res)=>{
  const amount=Number(req.body.amount);
  if(!Number.isInteger(amount)||amount < -100000||amount > 100000) return res.status(400).json({error:"Введите целое число от -100000 до 100000"});
  db.prepare("UPDATE users SET coins=MAX(0,coins+?) WHERE id=?").run(amount,Number(req.params.id));
  res.json({ok:true});
});
app.post("/api/admin/room/:code/delete",requireAdmin,(req,res)=>{
  const code=String(req.params.code).toUpperCase();
  db.prepare("DELETE FROM rooms WHERE code=?").run(code);
  roomCache.delete(code);
  io.to(code).emit("room:closed",{message:"Комната закрыта администратором"});
  io.in(code).socketsLeave(code);
  res.json({ok:true});
});

const roomCache = new Map();
function persistRoom(room) {
  db.prepare(`INSERT INTO rooms(code,host_id,state,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(code) DO UPDATE SET host_id=excluded.host_id,state=excluded.state,updated_at=CURRENT_TIMESTAMP`)
    .run(room.code,room.hostId,JSON.stringify(room));
  db.transaction(()=>{
    db.prepare("DELETE FROM room_players WHERE room_code=?").run(room.code);
    room.players.forEach((p,i)=>db.prepare("INSERT INTO room_players(room_code,user_id,seat,score,is_host) VALUES(?,?,?,?,?)").run(room.code,p.id,i,p.score||0,p.id===room.hostId?1:0));
  })();
}
function safeRoom(r) {
  return {
    code:r.code,hostId:r.hostId,status:r.status,round:r.round,maxRounds:r.maxRounds,
    players:r.players.map(p=>({id:p.id,username:p.username,avatar:p.avatar||"🙂",score:p.score,online:!!p.socketId,skin:p.skin||"cover_default"})),
    situation:r.situation,
    options:r.status==="guessing"?r.options:undefined,
    guesses:r.status==="guessing"?Object.keys(r.guesses||{}).length:undefined,
    target:r.status==="results"?r.target:undefined,
    results:r.results||null,
    chooserId:r.chooserId,
    chooserName:r.players.find(p=>p.id===r.chooserId)?.username
  };
}
function emitRoom(r) { persistRoom(r); io.to(r.code).emit("room:update",safeRoom(r)); }
function roomCode() {
  let code;
  do { code=crypto.randomBytes(3).toString("hex").toUpperCase(); }
  while(roomCache.has(code)||db.prepare("SELECT 1 FROM rooms WHERE code=?").get(code));
  return code;
}
function startRound(r) {
  r.status="choosing"; r.round=Math.min(r.round,r.maxRounds);
  r.situation=null; r.options=[]; r.target=null; r.guesses={}; r.results=null;
  r.chooserId=r.players[(r.round-1)%r.players.length].id;
  io.to(r.code).emit("round:choosing",{chooserId:r.chooserId,chooserName:r.players.find(p=>p.id===r.chooserId)?.username,round:r.round,maxRounds:r.maxRounds});
  emitRoom(r);
}
function completeGame(r) {
  if(r.status==="completed") return;
  r.status="completed";
  const resultList=[...r.players].sort((a,b)=>b.score-a.score);
  const payout = db.transaction(()=>{
    const matchId=db.prepare("INSERT INTO matches(room_code,round_count,results_json) VALUES(?,?,?)").run(r.code,r.round,JSON.stringify(resultList.map(p=>({id:p.id,username:p.username,score:p.score})))).lastInsertRowid;
    for(const p of r.players) {
      const reward=Math.max(0,p.score)*10;
      db.prepare("UPDATE users SET coins=coins+?,total_score=total_score+?,games_played=games_played+1 WHERE id=?").run(reward,p.score,p.id);
      db.prepare("INSERT INTO match_payouts(match_id,user_id,coins) VALUES(?,?,?)").run(matchId,p.id,reward);
    }
    return matchId;
  });
  const matchId=payout();
  r.results=resultList.map(p=>({id:p.id,username:p.username,score:p.score,coins:Math.max(0,p.score)*10}));
  emitRoom(r);
  io.to(r.code).emit("game:completed",{results:r.results,matchId});
}
function finishRound(r) {
  if(r.status!=="guessing") return;
  const correct=Object.entries(r.guesses).filter(([id,guess])=>guess===r.target).map(([id])=>Number(id));
  if(correct.length) correct.forEach(id=>{const p=r.players.find(x=>x.id===id);if(p)p.score+=2;});
  else {const chooser=r.players.find(p=>p.id===r.chooserId);if(chooser)chooser.score+=3;}
  r.status="results"; r.results={correctIds:correct,noOne:correct.length===0};
  emitRoom(r);
  io.to(r.code).emit("round:results",{room:safeRoom(r),correctIds:correct,noOne:correct.length===0});
}
function nextRound(r) { if(r.round>=r.maxRounds) completeGame(r); else {r.round++;startRound(r);} }

io.engine.use(sessionMiddleware);
io.use((socket,next)=>{
  const uid=socket.request.session?.userId;
  if(!uid) return next(new Error("Нужно войти в аккаунт"));
  const user=db.prepare("SELECT id,username,is_banned FROM users WHERE id=?").get(uid);
  if(!user||user.is_banned) return next(new Error("Аккаунт недоступен"));
  socket.userId=user.id; socket.username=user.username; next();
});
io.on("connection",socket=>{
  socket.on("room:create",()=>{
    if(socket.roomCode) return;
    const code=roomCode();
    const r={code,hostId:socket.userId,status:"waiting",round:0,maxRounds:5,
      players:[{id:socket.userId,username:socket.username,avatar:getProfile(socket.userId)?.avatar||"🙂",score:0,socketId:socket.id,skin:getProfile(socket.userId)?.equipped}],
      createdAt:Date.now(),guesses:{},options:[]};
    roomCache.set(code,r); socket.roomCode=code; socket.join(code); emitRoom(r);
  });
  socket.on("room:join",({code}={})=>{
    code=String(code||"").toUpperCase();
    let r=roomCache.get(code);
    if(!r) {
      const saved=db.prepare("SELECT state FROM rooms WHERE code=?").get(code);
      if(saved) { try {r=JSON.parse(saved.state);r.players.forEach(p=>p.socketId=null);roomCache.set(code,r);} catch {} }
    }
    if(!r) return socket.emit("error:message","Комната не найдена");
    if(r.status==="completed") return socket.emit("error:message","Игра завершена");
    if(!r.players.some(p=>p.id===socket.userId)&&r.players.length>=8) return socket.emit("error:message","В комнате максимум 8 игроков");
    if(socket.roomCode&&socket.roomCode!==code) socket.leave(socket.roomCode);
    let player=r.players.find(p=>p.id===socket.userId);
    if(!player) {player={id:socket.userId,username:socket.username,avatar:getProfile(socket.userId)?.avatar||"🙂",score:0,skin:getProfile(socket.userId)?.equipped};r.players.push(player);}
    player.socketId=socket.id; socket.roomCode=code; socket.join(code); emitRoom(r);
  });
  socket.on("game:start",()=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.hostId!==socket.userId||r.status!=="waiting") return;
    if(r.players.length<3) return socket.emit("error:message","Для игры нужно минимум 3 игрока");
    r.round=1;r.maxRounds=r.players.length;startRound(r);
  });
  socket.on("round:choose",({situation,target}={})=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.status!=="choosing"||r.chooserId!==socket.userId) return;
    if(!memes.includes(target)||!situationsByMeme[target]?.includes(situation)) return socket.emit("error:message","Некорректный выбор");
    // Ведущий задаёт правильный мем; сервер сам добавляет два случайных отвлекающих варианта.
    const distractors=memes.filter(m=>m!==target).sort(()=>Math.random()-0.5).slice(0,2);
    r.situation=situation;r.options=[target,...distractors].sort(()=>Math.random()-0.5);r.target=target;r.status="guessing";r.guesses={};
    emitRoom(r);io.to(r.code).emit("round:started",{situation,options:r.options,chooserId:r.chooserId});
  });
  socket.on("round:guess",({meme}={})=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.status!=="guessing"||socket.userId===r.chooserId||!r.options.includes(meme)||r.guesses[socket.userId]) return;
    r.guesses[socket.userId]=meme;emitRoom(r);
    const guessers=r.players.filter(p=>p.id!==r.chooserId);
    if(guessers.every(p=>r.guesses[p.id])) finishRound(r);
  });
  socket.on("round:next",()=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.status!=="results"||!r.players.some(p=>p.id===socket.userId)) return;
    nextRound(r);
  });
  socket.on("game:restart",()=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.hostId!==socket.userId||r.status!=="completed") return;
    r.players.forEach(p=>p.score=0);r.round=1;r.maxRounds=r.players.length;r.guesses={};r.results=null;startRound(r);
  });
  socket.on("room:leave",()=>{
    const r=roomCache.get(socket.roomCode);if(!r)return;
    r.players=r.players.filter(p=>p.id!==socket.userId);
    if(!r.players.length){roomCache.delete(r.code);db.prepare("DELETE FROM rooms WHERE code=?").run(r.code);}
    else {if(r.hostId===socket.userId)r.hostId=r.players[0].id;emitRoom(r);}
    socket.leave(r.code);socket.roomCode=null;
  });
  socket.on("disconnect",()=>{
    const r=roomCache.get(socket.roomCode);if(!r)return;
    const p=r.players.find(p=>p.id===socket.userId);if(p)p.socketId=null;
    emitRoom(r);
  });
});

// Recover rooms from persistent storage; players can reconnect by entering the room code.
for(const row of db.prepare("SELECT code,state FROM rooms").all()) {
  try {
    const r=JSON.parse(row.state);
    if(r.status!=="completed") {r.players.forEach(p=>p.socketId=null);roomCache.set(row.code,r);}
  } catch {}
}
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
server.listen(PORT,()=>console.log(`УГАДАЙ МЕМ: http://localhost:${PORT}`));
