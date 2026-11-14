require("dotenv").config();
const express = require("express");
const http = require("http");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
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
// PostgreSQL (Neon) — постоянное внешнее хранилище.
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL не задан");
if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw new Error("Задай SESSION_SECRET (не менее 32 символов) в Render");
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:Number(process.env.PG_POOL_MAX)||5,idleTimeoutMillis:30000,connectionTimeoutMillis:15000});
pool.on("error",err=>console.error("Ошибка пула PostgreSQL:",err));
function pgSql(sql){let i=0;return sql.replace(/\?/g,()=>"$"+(++i));}
const db={prepare(sql){return{
 get:async(...params)=>(await pool.query(pgSql(sql),params)).rows[0],
 all:async(...params)=>(await pool.query(pgSql(sql),params)).rows,
 run:async(...params)=>{
  const wantsId=/^\s*INSERT\s+INTO\s+(users|matches)\b/i.test(sql)&&!/\bRETURNING\b/i.test(sql);
  const result=await pool.query(pgSql(wantsId?sql+" RETURNING id":sql),params);
  return{lastInsertRowid:result.rows[0]?.id,changes:result.rowCount};
 }
}}};
async function withTransaction(work){
 const client=await pool.connect(),tx={query:(sql,params=[])=>client.query(pgSql(sql),params)};
 try{await client.query("BEGIN");const result=await work(tx);await client.query("COMMIT");return result;}
 catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}
 finally{client.release();}
}
const sessionMaxAgeDays=Math.min(3650,Math.max(1,Number(process.env.SESSION_MAX_AGE_DAYS)||365));
const sessionMaxAgeMs=sessionMaxAgeDays*24*60*60*1000;
const sessionStore=new PgSession({pool,tableName:"user_sessions",createTableIfMissing:true,pruneSessionInterval:900});
const sessionMiddleware=session({name:"ugm.sid",secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,rolling:true,store:sessionStore,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:sessionMaxAgeMs}});
app.use(helmet({ contentSecurityPolicy: false }));app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));

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
const asyncRoute=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next);
const requireAdmin=(req,res,next)=>{
 if(!req.session.userId)return res.status(401).json({error:"Требуется вход"});
 db.prepare("SELECT is_admin FROM users WHERE id=?").get(req.session.userId).then(u=>u?.is_admin?next():res.status(403).json({error:"Недостаточно прав"})).catch(next);
};
async function getProfile(id){
 const user=await db.prepare("SELECT id,username,coins,total_score,games_played,is_admin FROM users WHERE id=?").get(id);if(!user)return null;
 const ownedRows=await db.prepare("SELECT item_id FROM inventory WHERE user_id=?").all(id),owned=ownedRows.map(x=>x.item_id);
 if(!owned.includes("table_classic"))owned.push("table_classic");
 const [eq,theme,table,avatar]=await Promise.all([
  db.prepare("SELECT value FROM settings WHERE key=?").get("equipped:"+id),
  db.prepare("SELECT value FROM settings WHERE key=?").get("theme:"+id),
  db.prepare("SELECT value FROM settings WHERE key=?").get("table-skin:"+id),
  db.prepare("SELECT value FROM settings WHERE key=?").get("avatar:"+id)
 ]);
 return{...user,owned,equipped:eq?.value||"cover_default",theme:theme?.value||"dark",tableSkin:table?.value||"table_classic",avatar:avatar?.value||"🙂"};
}
app.get("/api/me",asyncRoute(async(req,res)=>res.json({user:req.session.userId?await getProfile(req.session.userId):null})));

// Аватары сохраняются в PostgreSQL как data URL.
app.post("/api/profile/avatar-upload",requireAuth,express.raw({type:["image/png","image/jpeg","image/webp"],limit:"2mb"}),asyncRoute(async(req,res)=>{
 if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:"Выбери файл PNG, JPG или WebP"});
 const b=req.body,mime=req.headers["content-type"];
 const png=mime==="image/png"&&b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=mime==="image/jpeg"&&b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
 const webp=mime==="image/webp"&&b.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP";
 if(!png&&!jpg&&!webp)return res.status(400).json({error:"Файл должен быть настоящим изображением PNG, JPG или WebP"});
 const avatar=`data:${mime};base64,${b.toString("base64")}`;
 await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("avatar:"+req.session.userId,avatar);
 for(const r of roomCache.values()){const p=r.players.find(p=>p.id===req.session.userId);if(p){p.avatar=avatar;emitRoom(r);}}
 res.json({user:await getProfile(req.session.userId)});
}));
app.post("/api/profile/update",requireAuth,asyncRoute(async(req,res)=>{
 const username=String(req.body.username||"").trim(),avatar=String(req.body.avatar||"");
 const allowed=["🙂","😎","🤩","😂","😈","👻","🤖","🐱","🐸","🦊","🐼","🐵","🐙","🦄","💀","👑"];
 if(!/^[\p{L}\p{N}_-]{3,18}$/u.test(username))return res.status(400).json({error:"Ник: 3–18 символов, буквы, цифры, _ или -"});
 const currentAvatar=(await db.prepare("SELECT value FROM settings WHERE key=?").get("avatar:"+req.session.userId))?.value||"🙂";
 if(avatar&&!allowed.includes(avatar)&&avatar!==currentAvatar)return res.status(400).json({error:"Загрузи изображение или выбери аватар из списка"});
 try{await db.prepare("UPDATE users SET username=? WHERE id=?").run(username,req.session.userId);}
 catch(e){if(e.code==="23505")return res.status(409).json({error:"Этот ник уже занят"});throw e;}
 if(avatar&&allowed.includes(avatar))await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("avatar:"+req.session.userId,avatar);
 const savedAvatar=avatar||currentAvatar;
 for(const r of roomCache.values()){const p=r.players.find(p=>p.id===req.session.userId);if(p){p.username=username;p.avatar=savedAvatar;emitRoom(r);}}
 const active=[...io.sockets.sockets.values()].find(sock=>sock.userId===req.session.userId);if(active)active.username=username;
 res.json({user:await getProfile(req.session.userId)});
}));
app.post("/api/profile/theme",requireAuth,asyncRoute(async(req,res)=>{
 const theme=String(req.body.theme||"");
 if(!["dark","comic","light","neon","vaporwave","8bit","horror","y2k","hacker","pastel"].includes(theme))return res.status(400).json({error:"Неизвестная тема оформления"});
 await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("theme:"+req.session.userId,theme);
 res.json({user:await getProfile(req.session.userId)});
}));
function regenerateSession(req){return new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));}
function saveSession(req){return new Promise((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));}
app.post("/api/register",asyncRoute(async(req,res)=>{
 const username=String(req.body.username||"").trim(),password=String(req.body.password||"");
 if(!/^[\p{L}\p{N}_-]{3,18}$/u.test(username))return res.status(400).json({error:"Имя: 3–18 символов, буквы, цифры, _ или -"});
 if(password.length<8||password.length>128)return res.status(400).json({error:"Пароль должен содержать от 8 до 128 символов"});
 let userId;
 try{const result=await db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username,bcrypt.hashSync(password,12));userId=Number(result.lastInsertRowid);await db.prepare("INSERT INTO inventory(user_id,item_id) VALUES(?,?)").run(userId,"cover_default");}
 catch(e){if(e.code==="23505")return res.status(409).json({error:"Это имя уже занято"});throw e;}
 await regenerateSession(req);req.session.userId=userId;await saveSession(req);res.json({user:await getProfile(userId)});
}));
app.post("/api/login",asyncRoute(async(req,res)=>{
 const user=await db.prepare("SELECT * FROM users WHERE username=?").get(String(req.body.username||"").trim());
 if(!user||!bcrypt.compareSync(String(req.body.password||""),user.password_hash))return res.status(401).json({error:"Неверное имя или пароль"});
 if(user.is_banned)return res.status(403).json({error:"Аккаунт заблокирован"});
 await regenerateSession(req);req.session.userId=user.id;await saveSession(req);res.json({user:await getProfile(user.id)});
}));
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
app.post("/api/shop/buy",requireAuth,asyncRoute(async(req,res)=>{
 const item=catalog.find(x=>x.id===req.body.itemId);if(!item)return res.status(404).json({error:"Товар не найден"});
 try{await withTransaction(async tx=>{
  const owned=await tx.query("SELECT 1 FROM inventory WHERE user_id=$1 AND item_id=$2",[req.session.userId,item.id]);if(owned.rowCount)throw Error("Уже куплено");
  const user=(await tx.query("SELECT coins FROM users WHERE id=$1 FOR UPDATE",[req.session.userId])).rows[0];if(!user||user.coins<item.price)throw Error("Недостаточно монет");
  await tx.query("UPDATE users SET coins=coins-$1 WHERE id=$2",[item.price,req.session.userId]);await tx.query("INSERT INTO inventory(user_id,item_id) VALUES($1,$2)",[req.session.userId,item.id]);
 });res.json({user:await getProfile(req.session.userId)});}catch(e){res.status(400).json({error:e.message});}
}));
app.post("/api/shop/equip",requireAuth,asyncRoute(async(req,res)=>{
 const id=String(req.body.itemId||"");if(!(await db.prepare("SELECT 1 FROM inventory WHERE user_id=? AND item_id=?").get(req.session.userId,id)))return res.status(400).json({error:"Сначала приобретите эту обложку"});
 await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("equipped:"+req.session.userId,id);res.json({user:await getProfile(req.session.userId)});
}));
app.post("/api/shop/table-buy",requireAuth,asyncRoute(async(req,res)=>{
 const item=tableCatalog.find(x=>x.id===req.body.itemId);if(!item)return res.status(404).json({error:"Скин стола не найден"});
 try{await withTransaction(async tx=>{
  const owned=await tx.query("SELECT 1 FROM inventory WHERE user_id=$1 AND item_id=$2",[req.session.userId,item.id]);if(owned.rowCount)throw Error("Уже куплено");
  const user=(await tx.query("SELECT coins FROM users WHERE id=$1 FOR UPDATE",[req.session.userId])).rows[0];if(!user||user.coins<item.price)throw Error("Недостаточно монет");
  await tx.query("UPDATE users SET coins=coins-$1 WHERE id=$2",[item.price,req.session.userId]);await tx.query("INSERT INTO inventory(user_id,item_id) VALUES($1,$2)",[req.session.userId,item.id]);
 });res.json({user:await getProfile(req.session.userId)});}catch(e){res.status(400).json({error:e.message});}
}));
app.post("/api/shop/table-equip",requireAuth,asyncRoute(async(req,res)=>{
 const id=String(req.body.itemId||"");if(!tableCatalog.some(x=>x.id===id)||!(await db.prepare("SELECT 1 FROM inventory WHERE user_id=? AND item_id=?").get(req.session.userId,id)))return res.status(400).json({error:"Сначала приобретите этот стол"});
 await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("table-skin:"+req.session.userId,id);res.json({user:await getProfile(req.session.userId)});
}));
app.get("/api/leaderboard",asyncRoute(async(req,res)=>{
 const players=(await pool.query(`SELECT u.id,u.username,u.total_score,u.games_played,COALESCE(s.value,'🙂') AS avatar FROM users u LEFT JOIN settings s ON s.key=('avatar:' || u.id::text) WHERE u.is_banned=0 ORDER BY u.total_score DESC LIMIT 30`)).rows;res.json({players});
}));
app.get("/api/admin/overview",requireAdmin,asyncRoute(async(req,res)=>{
 const [users,rooms,matches]=await Promise.all([
  db.prepare("SELECT id,username,coins,total_score,games_played,is_banned,is_admin,created_at FROM users ORDER BY id DESC LIMIT 200").all(),
  db.prepare("SELECT code,host_id,state,created_at,updated_at FROM rooms ORDER BY updated_at DESC").all(),
  db.prepare("SELECT id,room_code,completed_at,round_count,results_json FROM matches ORDER BY id DESC LIMIT 30").all()
 ]);res.json({users,rooms,matches});
}));
app.post("/api/admin/user/:id/ban",requireAdmin,asyncRoute(async(req,res)=>{
 const id=Number(req.params.id),reason=String(req.body.reason||"Нарушение правил").slice(0,200),user=await db.prepare("SELECT id,is_admin FROM users WHERE id=?").get(id);
 if(!user||user.is_admin)return res.status(400).json({error:"Нельзя заблокировать этого пользователя"});
 await db.prepare("UPDATE users SET is_banned=1 WHERE id=?").run(id);await db.prepare("INSERT INTO bans(user_id,reason) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,created_at=CURRENT_TIMESTAMP").run(id,reason);
 for(const sock of io.sockets.sockets.values())if(sock.userId===id)sock.disconnect(true);res.json({ok:true});
}));
app.post("/api/admin/user/:id/unban",requireAdmin,asyncRoute(async(req,res)=>{
 await db.prepare("UPDATE users SET is_banned=0 WHERE id=?").run(Number(req.params.id));await db.prepare("DELETE FROM bans WHERE user_id=?").run(Number(req.params.id));res.json({ok:true});
}));
app.post("/api/admin/user/:id/coins",requireAdmin,asyncRoute(async(req,res)=>{
 const amount=Number(req.body.amount);if(!Number.isInteger(amount)||amount < -100000||amount>100000)return res.status(400).json({error:"Введите целое число от -100000 до 100000"});
 await db.prepare("UPDATE users SET coins=GREATEST(0,coins+?) WHERE id=?").run(amount,Number(req.params.id));res.json({ok:true});
}));
app.post("/api/admin/room/:code/delete",requireAdmin,asyncRoute(async(req,res)=>{
 const code=String(req.params.code).toUpperCase();await db.prepare("DELETE FROM rooms WHERE code=?").run(code);roomCache.delete(code);
 io.to(code).emit("room:closed",{message:"Комната закрыта администратором"});io.in(code).socketsLeave(code);res.json({ok:true});
}));

const roomCache = new Map();
const roomTimers = new Map();
async function persistRoom(room) {
 const snapshot=JSON.stringify(room);
 await withTransaction(async tx=>{
  await tx.query(`INSERT INTO rooms(code,host_id,state,updated_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT(code) DO UPDATE SET host_id=excluded.host_id,state=excluded.state,updated_at=CURRENT_TIMESTAMP`,[room.code,room.hostId,snapshot]);
  await tx.query("DELETE FROM room_players WHERE room_code=$1",[room.code]);
  for(let i=0;i<room.players.length;i++){const p=room.players[i];await tx.query("INSERT INTO room_players(room_code,user_id,seat,score,is_host) VALUES($1,$2,$3,$4,$5)",[room.code,p.id,i,p.score||0,p.id===room.hostId?1:0]);}
 });
}
function safeRoom(r, userId) {
  const ownPlayer=r.players.find(p=>p.id===userId);
  return {
    code:r.code,hostId:r.hostId,status:r.status,round:r.round,maxRounds:r.maxRounds,
    settings:{rounds:r.settings?.rounds||5,thinkSeconds:r.settings?.thinkSeconds||30,chooseSeconds:r.settings?.chooseSeconds||45},
    players:r.players.map(p=>({id:p.id,username:p.username,avatar:p.avatar||"🙂",score:p.score,online:!!p.socketId,skin:p.skin||"cover_default"})),
    situation:r.situation,
    options:r.status==="guessing"?r.options:undefined,
    guesses:r.status==="guessing"?Object.keys(r.guesses||{}).length:undefined,
    target:r.status==="results"?r.target:undefined,
    results:r.results||null,
    chooserId:r.chooserId,
    chooserName:r.players.find(p=>p.id===r.chooserId)?.username,
    timerEndsAt:r.timerEndsAt||null,
    timerDuration:r.timerDuration||null,
    answers:r.status==="results"?r.players.map(p=>({
      id:p.id,username:p.username,avatar:p.avatar||"🙂",
      isChooser:p.id===r.chooserId,
      meme:p.id===r.chooserId?r.target:((r.guesses||{})[p.id]||null),
      correct:p.id===r.chooserId?null:((r.guesses||{})[p.id]===r.target),
      answered:p.id===r.chooserId?true:!!(r.guesses||{})[p.id]
    })):undefined,
    myHand:ownPlayer?.hand?ownPlayer.hand.slice():[],
    deckCount:ownPlayer?.deck?.length||0,
    discardedCount:ownPlayer?.discarded?.length||0
  };
}
function emitRoom(r) {
  persistRoom(r).catch(err=>console.error("Не удалось сохранить комнату",r.code,err));
  for(const p of r.players) if(p.socketId) io.to(p.socketId).emit("room:update",safeRoom(r,p.id));
}
function shuffleCards(cards) {
  const result=cards.slice();
  for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function dealPlayerCards(player) {
  const shuffled=shuffleCards(memes);
  player.hand=shuffled.slice(0,6);
  player.deck=shuffled.slice(6);
  player.discarded=[];
}
function dealRoomCards(r) {
  r.players.forEach(dealPlayerCards);
  r.cardsInitialized=true;
}
function usePlayerCard(player,target) {
  if(!Array.isArray(player.hand)||!player.hand.includes(target)) return false;
  player.hand=player.hand.filter(card=>card!==target);
  if(!Array.isArray(player.discarded)) player.discarded=[];
  player.discarded.push(target);
  if(Array.isArray(player.deck)&&player.deck.length) player.hand.push(player.deck.shift());
  return true;
}
async function roomCode() {let code,exists;do{code=crypto.randomBytes(3).toString("hex").toUpperCase();exists=roomCache.has(code)||await db.prepare("SELECT 1 FROM rooms WHERE code=?").get(code);}while(exists);return code;}
function clearRoomTimer(r) {
  const timer=roomTimers.get(r.code);
  if(timer) clearTimeout(timer);
  roomTimers.delete(r.code);
  r.timerEndsAt=null;
  r.timerDuration=null;
}
function startRound(r) {
  clearRoomTimer(r);
  if(!r.cardsInitialized || r.players.some(p=>!Array.isArray(p.hand)||!Array.isArray(p.deck))) dealRoomCards(r);
  r.status="choosing"; r.round=Math.min(r.round,r.maxRounds);
  r.situation=null; r.options=[]; r.target=null; r.guesses={}; r.results=null;
  r.chooserId=r.players[(r.round-1)%r.players.length].id;
  const seconds=r.settings?.chooseSeconds||45;
  r.timerDuration=seconds;
  r.timerEndsAt=Date.now()+seconds*1000;
  io.to(r.code).emit("round:choosing",{chooserId:r.chooserId,chooserName:r.players.find(p=>p.id===r.chooserId)?.username,round:r.round,maxRounds:r.maxRounds});
  emitRoom(r);
  io.to(r.code).emit("phase:timer",{phase:"choosing",endsAt:r.timerEndsAt,duration:seconds});
  roomTimers.set(r.code,setTimeout(()=>{
    if(r.status!=="choosing") return;
    const chooser=r.players.find(p=>p.id===r.chooserId);
    if(!chooser||!Array.isArray(chooser.hand)||!chooser.hand.length) return finishGameForEmptyHand(r);
    const target=chooser.hand[Math.floor(Math.random()*chooser.hand.length)];
    const situation=situationsByMeme[target]?.[Math.floor(Math.random()*(situationsByMeme[target]?.length||1))]||"Когда всё пошло совсем не по плану";
    usePlayerCard(chooser,target);
    applyChoice(r,situation,target);
  },seconds*1000));
}
function finishGameForEmptyHand(r) {
  const chooser=r.players.find(p=>p.id===r.chooserId);
  if(chooser && Array.isArray(chooser.deck) && chooser.deck.length && Array.isArray(chooser.hand) && !chooser.hand.length) chooser.hand.push(...chooser.deck.splice(0,6));
  if(chooser && chooser.hand.length) {
    const target=chooser.hand[0];
    usePlayerCard(chooser,target);
    const situation=situationsByMeme[target]?.[0]||"Когда всё пошло не по плану";
    applyChoice(r,situation,target);
  } else {
    // Обычно недостижимо в матче до 10 раундов; завершаем фазу безопасно.
    r.status="results";r.results={correctIds:[],noOne:true};emitRoom(r);
    for(const p of r.players) if(p.socketId) io.to(p.socketId).emit("round:results",{room:safeRoom(r,p.id),correctIds:[],noOne:true});
  }
}
function applyChoice(r,situation,target) {
  clearRoomTimer(r);
  const distractors=memes.filter(m=>m!==target).sort(()=>Math.random()-0.5).slice(0,2);
  r.situation=situation;r.options=[target,...distractors].sort(()=>Math.random()-0.5);r.target=target;r.status="guessing";r.guesses={};
  const seconds=r.settings?.thinkSeconds||30;
  r.timerDuration=seconds;
  r.timerEndsAt=Date.now()+seconds*1000;
  emitRoom(r);io.to(r.code).emit("round:started",{situation,options:r.options,chooserId:r.chooserId});
  io.to(r.code).emit("phase:timer",{phase:"guessing",endsAt:r.timerEndsAt,duration:seconds});
  roomTimers.set(r.code,setTimeout(()=>{if(r.status==="guessing")finishRound(r);},seconds*1000));
}
async function completeGame(r) {
 if(r.status==="completed")return;clearRoomTimer(r);r.status="completed";
 const resultList=[...r.players].sort((a,b)=>b.score-a.score);
 const matchId=await withTransaction(async tx=>{
  const ins=await tx.query("INSERT INTO matches(room_code,round_count,results_json) VALUES($1,$2,$3) RETURNING id",[r.code,r.round,JSON.stringify(resultList.map(p=>({id:p.id,username:p.username,score:p.score})))]);
  const id=ins.rows[0].id;
  for(const p of r.players){const reward=Math.max(0,p.score)*10;await tx.query("UPDATE users SET coins=coins+$1,total_score=total_score+$2,games_played=games_played+1 WHERE id=$3",[reward,p.score,p.id]);await tx.query("INSERT INTO match_payouts(match_id,user_id,coins) VALUES($1,$2,$3)",[id,p.id,reward]);}
  return id;
 });
 r.results=resultList.map(p=>({id:p.id,username:p.username,score:p.score,coins:Math.max(0,p.score)*10}));emitRoom(r);io.to(r.code).emit("game:completed",{results:r.results,matchId});
}
function finishRound(r) {
  if(r.status!=="guessing") return;
  clearRoomTimer(r);
  const correct=Object.entries(r.guesses).filter(([id,guess])=>guess===r.target).map(([id])=>Number(id));
  if(correct.length) correct.forEach(id=>{const p=r.players.find(x=>x.id===id);if(p)p.score+=2;});
  else {const chooser=r.players.find(p=>p.id===r.chooserId);if(chooser)chooser.score+=3;}
  r.status="results"; r.results={correctIds:correct,noOne:correct.length===0};
  emitRoom(r);
  for(const p of r.players) if(p.socketId) io.to(p.socketId).emit("round:results",{room:safeRoom(r,p.id),correctIds:correct,noOne:correct.length===0});
}
async function nextRound(r) { if(r.round>=r.maxRounds) await completeGame(r); else {r.round++;startRound(r);} }

io.engine.use(sessionMiddleware);
io.use((socket,next)=>{
 const uid=socket.request.session?.userId;if(!uid)return next(new Error("Нужно войти в аккаунт"));
 db.prepare("SELECT id,username,is_banned FROM users WHERE id=?").get(uid).then(user=>{if(!user||user.is_banned)return next(new Error("Аккаунт недоступен"));socket.userId=user.id;socket.username=user.username;next();}).catch(next);
});
io.on("connection",socket=>{
 const safeOn=(event,handler)=>socket.on(event,(...args)=>Promise.resolve(handler(...args)).catch(err=>{console.error("Socket handler failed:",event,err);socket.emit("error:message","Ошибка связи с базой данных. Попробуй ещё раз.");}));
 safeOn("room:create",async()=>{
    if(socket.roomCode) return;
    const code=await roomCode(),profile=await getProfile(socket.userId);
    const r={code,hostId:socket.userId,status:"waiting",round:0,maxRounds:5,settings:{rounds:5,thinkSeconds:30,chooseSeconds:45},
      players:[{id:socket.userId,username:socket.username,avatar:profile?.avatar||"🙂",score:0,socketId:socket.id,skin:profile?.equipped}],
      createdAt:Date.now(),guesses:{},options:[]};
    roomCache.set(code,r);socket.roomCode=code;socket.join(code);emitRoom(r);
  });
  socket.on("room:settings",({rounds,thinkSeconds,chooseSeconds}={})=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.hostId!==socket.userId||r.status!=="waiting") return;
    const allowedRounds=[3,5,7,10], allowedTimes=[15,30,45,60,90];
    if(!allowedRounds.includes(Number(rounds))||!allowedTimes.includes(Number(thinkSeconds))||!allowedTimes.includes(Number(chooseSeconds))) return socket.emit("error:message","Некорректные настройки комнаты");
    r.settings={rounds:Number(rounds),thinkSeconds:Number(thinkSeconds),chooseSeconds:Number(chooseSeconds)};r.maxRounds=r.settings.rounds;emitRoom(r);
  });
  safeOn("room:join",async({code}={})=>{
    code=String(code||"").toUpperCase();
    let r=roomCache.get(code);
    if(!r) {
      const saved=await db.prepare("SELECT state FROM rooms WHERE code=?").get(code);
      if(saved) { try {r=JSON.parse(saved.state);r.players.forEach(p=>p.socketId=null);roomCache.set(code,r);} catch {} }
    }
    if(!r) return socket.emit("error:message","Комната не найдена");
    if(r.status==="completed") return socket.emit("error:message","Игра завершена");
    if(!r.players.some(p=>p.id===socket.userId)&&r.players.length>=8) return socket.emit("error:message","В комнате максимум 8 игроков");
    if(r.status!=="waiting"&&(!r.cardsInitialized||r.players.some(p=>!Array.isArray(p.hand)||!Array.isArray(p.deck)))) dealRoomCards(r);
    if(socket.roomCode&&socket.roomCode!==code) socket.leave(socket.roomCode);
    let player=r.players.find(p=>p.id===socket.userId);
    if(!player) {const profile=await getProfile(socket.userId);player={id:socket.userId,username:socket.username,avatar:profile?.avatar||"🙂",score:0,skin:profile?.equipped};if(r.status!=="waiting")dealPlayerCards(player);r.players.push(player);}
    player.socketId=socket.id; socket.roomCode=code; socket.join(code); emitRoom(r);
  });
  socket.on("game:start",()=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.hostId!==socket.userId||r.status!=="waiting") return;
    if(r.players.length<3) return socket.emit("error:message","Для игры нужно минимум 3 игрока");
    r.round=1;r.maxRounds=r.settings?.rounds||5;dealRoomCards(r);startRound(r);
  });
  socket.on("round:choose",({situation,target}={})=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.status!=="choosing"||r.chooserId!==socket.userId) return;
    const chooser=r.players.find(p=>p.id===socket.userId);
    const cleanSituation=String(situation||"").trim().slice(0,240);
    if(!chooser||!Array.isArray(chooser.hand)||!chooser.hand.includes(target)||cleanSituation.length<3) return socket.emit("error:message","Выбери мем из своей руки и напиши ситуацию (не менее 3 символов)");
    // Использованная карта уходит в сброс до конца матча; игрок добирает верхнюю карту своей личной колоды.
    usePlayerCard(chooser,target);
    applyChoice(r,cleanSituation,target);
  });
  socket.on("round:guess",({meme}={})=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.status!=="guessing"||socket.userId===r.chooserId||!r.options.includes(meme)||r.guesses[socket.userId]) return;
    r.guesses[socket.userId]=meme;emitRoom(r);
    const guessers=r.players.filter(p=>p.id!==r.chooserId);
    if(guessers.every(p=>r.guesses[p.id])) finishRound(r);
  });
  safeOn("round:next",async()=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.status!=="results"||!r.players.some(p=>p.id===socket.userId))return;
    await nextRound(r);
  });
  socket.on("game:restart",()=>{
    const r=roomCache.get(socket.roomCode);
    if(!r||r.hostId!==socket.userId||r.status!=="completed") return;
    r.players.forEach(p=>p.score=0);r.round=1;r.maxRounds=r.settings?.rounds||5;r.guesses={};r.results=null;dealRoomCards(r);startRound(r);
  });
  safeOn("room:leave",async()=>{
    const r=roomCache.get(socket.roomCode);if(!r)return;
    r.players=r.players.filter(p=>p.id!==socket.userId);
    if(!r.players.length){clearRoomTimer(r);roomCache.delete(r.code);await db.prepare("DELETE FROM rooms WHERE code=?").run(r.code);}
    else{if(r.hostId===socket.userId)r.hostId=r.players[0].id;emitRoom(r);}
    socket.leave(r.code);socket.roomCode=null;
  });
  socket.on("disconnect",()=>{
    const r=roomCache.get(socket.roomCode);if(!r)return;
    const p=r.players.find(p=>p.id===socket.userId);if(p)p.socketId=null;
    emitRoom(r);
  });
});

async function initDatabase(){
 await pool.query(`
 CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,coins INTEGER NOT NULL DEFAULT 0,total_score INTEGER NOT NULL DEFAULT 0,games_played INTEGER NOT NULL DEFAULT 0,is_admin SMALLINT NOT NULL DEFAULT 0,is_banned SMALLINT NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS inventory(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_id TEXT NOT NULL,PRIMARY KEY(user_id,item_id));
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,host_id INTEGER NOT NULL,state TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS room_players(room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id),seat INTEGER NOT NULL,score INTEGER NOT NULL DEFAULT 0,is_host INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(room_code,user_id));
 CREATE TABLE IF NOT EXISTS matches(id SERIAL PRIMARY KEY,room_code TEXT NOT NULL,completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,round_count INTEGER NOT NULL,results_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS match_payouts(match_id INTEGER NOT NULL REFERENCES matches(id),user_id INTEGER NOT NULL REFERENCES users(id),coins INTEGER NOT NULL,PRIMARY KEY(match_id,user_id));
 CREATE TABLE IF NOT EXISTS bans(user_id INTEGER PRIMARY KEY REFERENCES users(id),reason TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS migration_imports(name TEXT PRIMARY KEY,imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
 `);
}
async function importLegacySqliteIfPresent(){
 const file=process.env.LEGACY_SQLITE_PATH||path.join(__dirname,"data","game.db");
 if(!fs.existsSync(file)){console.log("Старая SQLite-база не найдена; внешняя база готова.");return;}
 const done=await pool.query("SELECT 1 FROM migration_imports WHERE name=$1",["sqlite-v1"]);if(done.rowCount)return;
 const legacy=new Database(file,{readonly:true,fileMustExist:true}),client=await pool.connect();
 try{
  await client.query("BEGIN");
  const copy=async(table,cols)=>{
   const rows=legacy.prepare(`SELECT ${cols.join(",")} FROM ${table}`).all();
   for(const row of rows){const values=cols.map(c=>row[c]),marks=values.map((_,i)=>"$"+(i+1)).join(",");await client.query(`INSERT INTO ${table}(${cols.join(",")}) VALUES(${marks}) ON CONFLICT DO NOTHING`,values);}
   console.log(`Перенесено ${table}: ${rows.length}`);
  };
  await copy("users",["id","username","password_hash","created_at","coins","total_score","games_played","is_admin","is_banned"]);
  await copy("inventory",["user_id","item_id"]);await copy("settings",["key","value"]);await copy("rooms",["code","host_id","state","created_at","updated_at"]);
  await copy("room_players",["room_code","user_id","seat","score","is_host"]);await copy("matches",["id","room_code","completed_at","round_count","results_json"]);
  await copy("match_payouts",["match_id","user_id","coins"]);await copy("bans",["user_id","reason","created_at"]);
  await client.query("SELECT setval(pg_get_serial_sequence('users','id'),GREATEST(COALESCE((SELECT MAX(id) FROM users),1),1),EXISTS(SELECT 1 FROM users))");
  await client.query("SELECT setval(pg_get_serial_sequence('matches','id'),GREATEST(COALESCE((SELECT MAX(id) FROM matches),1),1),EXISTS(SELECT 1 FROM matches))");
  await client.query("INSERT INTO migration_imports(name) VALUES($1) ON CONFLICT DO NOTHING",["sqlite-v1"]);await client.query("COMMIT");console.log("Импорт SQLite завершён.");
 }catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}finally{client.release();legacy.close();}
}
async function seedAdmin(){
 if(!process.env.ADMIN_PASSWORD)return;const name=process.env.ADMIN_USERNAME||"admin",exists=await db.prepare("SELECT id FROM users WHERE username=?").get(name);
 if(!exists)await db.prepare("INSERT INTO users(username,password_hash,is_admin) VALUES(?,?,1)").run(name,bcrypt.hashSync(process.env.ADMIN_PASSWORD,12));
}
async function restoreRooms(){
 const rows=await db.prepare("SELECT code,state FROM rooms").all();
 for(const row of rows){try{const r=JSON.parse(row.state);if(r.status!=="completed"){r.players.forEach(p=>p.socketId=null);roomCache.set(row.code,r);}}catch(e){console.error("Не удалось восстановить комнату",row.code,e);}}
}
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.use((err,req,res,next)=>{console.error("HTTP handler error:",err);if(res.headersSent)return next(err);res.status(500).json({error:"Внутренняя ошибка сервера"});});
async function bootstrap(){await initDatabase();await importLegacySqliteIfPresent();await seedAdmin();await restoreRooms();server.listen(PORT,()=>console.log(`УГАДАЙ МЕМ (PostgreSQL): http://localhost:${PORT}`));}
bootstrap().catch(e=>{console.error("Не удалось запустить PostgreSQL:",e);process.exit(1);});
