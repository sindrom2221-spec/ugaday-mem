const $=s=>document.querySelector(s),app=$("#app"),nav=$("#nav"),chip=$("#user-chip");
function avatarView(value, cls="avatar-image"){const v=String(value||"🙂");return v.startsWith("data:image/")?`<img class="${cls}" src="${v}" alt="Аватар">`:esc(v)}
let me=null,socket=null,room=null,view="home",selectedSituation=null,selectedMeme=null,selectedOptions=[],errorText="",phaseTimerInterval=null,viewRenderId=0;
const situationsByMeme={"Да поебать мне":["Когда тебе сообщили, что завтра опять понедельник","Когда узнал, что цены снова выросли","Когда друг в пятый раз отменил встречу"],"Завтрак чемпиона":["Когда на завтрак осталось три крошки и чай","Когда решил питаться правильно, но увидел вчерашнюю пиццу","Когда до зарплаты ещё неделя, а холодильник уже пуст"],"Вас заметили":["Когда пытался незаметно списать, но учитель смотрит прямо на тебя","Когда лайкнул фото пятилетней давности","Когда зашёл не в тот кабинет и все обернулись"],"Пиздец, где я?":["Когда проснулся после вечеринки и не узнаёшь комнату","Когда свернул не туда и телефон потерял сеть","Когда открыл историю браузера после друга"],"Бильярд":["Когда хотел сыграть одну партию, а уже закрывают заведение","Когда объясняешь правила, хотя сам играешь впервые","Когда случайно сделал идеальный удар и делаешь вид, что так и задумано"],"OZON ПИВZON":["Когда зашёл забрать одну посылку и вышел с пятью","Когда пункт выдачи стал твоим вторым домом","Когда заказал полезную вещь, а пришло что-то совершенно другое"],"Суровый тип":["Когда сказали, что сегодня без домашнего задания","Когда в компании начался спор и ты решил молча наблюдать","Когда попросили помочь с переездом в воскресенье утром"],"Хаййвет, плесень":["Когда встретил знакомого, которого не видел со школы","Когда зашёл в чат после месяца молчания","Когда увидел старые фотографии и вспомнил всё"],"Сладкое ёжки":["Когда увидел скидку на любимые конфеты","Когда обещал съесть только одну печеньку","Когда принесли десерт, хотя ты уже наелся"],"Нет, я с горла":["Когда предложили попробовать напиток с непонятным составом","Когда все чокаются, а ты не знаешь, что налили","Когда официант спрашивает, будете ли добавку"],"Весёлый / не весёлый":["Когда говоришь «всё нормально», хотя день пошёл не по плану","Когда увидел оценку за контрольную","Когда друг спросил, как прошли выходные"],"Очень близко":["Когда почти попал в автобус, но двери закрылись перед носом","Когда до дедлайна осталось две минуты, а файл не сохранился","Когда промахнулся на один балл до победы"],"Урологическое отделение №2":["Когда перепутал дверь и понял это слишком поздно","Когда пришёл по одному адресу, а вывеска обещает совсем другое","Когда навигатор привёл тебя в максимально странное место"],"Да ладно? Серьёзно?":["Когда друг сказал, что посмотрел весь сериал за ночь","Когда увидел сумму в чеке после фразы «это недорого»","Когда узнал, что завтра выходной"],"Шок":["Когда случайно отправил сообщение не в тот чат","Когда увидел результат экзамена","Когда приложение списало деньги за подписку, о которой ты забыл"],"Пожимает плечами":["Когда спросили, почему всё сломалось, а ты просто проходил мимо","Когда никто не знает, кто съел последний кусок","Когда план провалился, но запасного плана не было"],"Сомнительно, но окей":["Когда друг предлагает «короткий путь» через лес","Когда незнакомец говорит, что знает способ заработать за час","Когда инструкция состоит из слов «просто нажми сюда»"],"Срамота!":["Когда на весь класс включилось твоё случайное аудио","Когда споткнулся на ровном месте перед толпой","Когда назвал преподавателя мамой"],"Ну как так-то?":["Когда интернет пропал ровно перед отправкой работы","Когда приготовил ужин и уронил его на пол","Когда автобус уехал, пока ты доставал проездной"]};
const memes=["Да поебать мне","Завтрак чемпиона","Вас заметили","Пиздец, где я?","Бильярд","OZON ПИВZON","Суровый тип","Хаййвет, плесень","Сладкое ёжки","Нет, я с горла","Весёлый / не весёлый","Очень близко","Урологическое отделение №2","Да ладно? Серьёзно?","Шок","Пожимает плечами","Сомнительно, но окей","Срамота!","Ну как так-то?"];
const externalMemeImages={
  "Да ладно? Серьёзно?":"https://i.pinimg.com/736x/97/75/d1/9775d1435c793177443b28716a173c0d.jpg",
  "Шок":"https://kor.ill.in.ua/m/1200x0/1972590.jpg",
  "Пожимает плечами":"https://images.meme-arsenal.com/f9738a51af6d57a1e5f1e681b8dc1817.jpg",
  "Сомнительно, но окей":"https://i.pinimg.com/736x/6b/4e/8f/6b4e8fa07f1b44ecf3fd13428db27e76.jpg",
  "Срамота!":"https://funny.klev.club/uploads/posts/2024-03/thumbs/funny-klev-club-p-smeshnie-kartinki-smirnovi-3.jpg",
  "Ну как так-то?":"https://cs10.pikabu.ru/post_img/2018/04/17/10/1523986124183988023.jpg"
};
const memeImage=m=>externalMemeImages[m]||`/memes/meme-${String(memes.indexOf(m)+1).padStart(2,"0")}.jpg`;
const memeChoice=(m,attr,selected=false)=>`<button class="choice meme-choice ${selected?"selected":""}" ${attr}="${esc(m)}"><img src="${memeImage(m)}" alt="${esc(m)}" loading="lazy"><span>${esc(m)}</span></button>`;
function generateSituation(meme){const list=situationsByMeme[meme]||[];if(!list.length)return "Когда всё пошло совсем не по плану";const options=list.filter(x=>x!==selectedSituation);return options[Math.floor(Math.random()*options.length)]||list[0];}
async function api(url,opts={}){const r=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Ошибка запроса");return d}
function setView(v){
  if(v===view)return;
  view=v;
  const token=++viewRenderId;
  // Убираем старый раздел сразу: асинхронная загрузка нового не должна оставлять магазин/профиль на экране.
  app.classList.remove("page-transition");
  app.innerHTML=`<div class="view-loading" aria-live="polite"><span class="view-loading-spinner"></span><span>Открываем раздел…</span></div>`;
  void app.offsetWidth;
  app.classList.add("page-transition");
  render(token);
}
function header(){
  document.body.dataset.theme=me?.theme||"dark";
  document.body.dataset.cardSkin=me?.equipped||"cover_default";
  document.body.dataset.tableSkin=me?.tableSkin||"table_classic";
  nav.innerHTML=me
    ? `<a href="#" data-view="home">Главная</a><a href="#" data-view="game">Играть</a><a href="#" data-view="shop">Магазин</a><a href="#" data-view="leaderboard">Рейтинг</a><a href="#" data-view="profile">Профиль</a>${me.is_admin?'<a href="#" data-view="admin">Админка</a>':''}`
    : `<a href="#" data-view="home">Главная</a><a href="#" data-view="shop">Магазин</a><a href="#" data-view="leaderboard">Рейтинг</a><a class="nav-anchor" href="#how-to-play">Правила</a>`;
  nav.querySelectorAll("[data-view]").forEach(a=>{
    if(a.dataset.view===view)a.setAttribute("aria-current","page");
    a.onclick=e=>{
      e.preventDefault();
      if(!me&&["shop","leaderboard"].includes(a.dataset.view)){setView("login");return;}
      setView(a.dataset.view);
    };
  });
  chip.innerHTML=me
    ? `<span class="chip-avatar">${avatarView(me.avatar,"avatar-image")}</span><span class="header-user-name">${esc(me.username)}</span><span class="header-user-coins">${me.coins} монет</span>`
    : `<button class="header-login" id="header-login" type="button">Войти</button>`;
  $("#header-login")?.addEventListener("click",()=>setView("login"));
}
function render(token=viewRenderId){
  header();
  if(!me&&["game","shop","admin","profile"].includes(view))view="home";
  if(view==="home")home();
  else if(view==="login")auth(false);
  else if(view==="register")auth(true);
  else if(view==="game")gamePage();
  else if(view==="shop")shopPage(token);
  else if(view==="leaderboard")leaderboard(token);
  else if(view==="profile")profilePage(token);
  else if(view==="admin")adminPage(token);
}
function trollfaceForTheme(theme){
  const t=["dark","comic","light","neon","vaporwave","8bit","horror","y2k","hacker","pastel"].includes(theme)?theme:"dark";
  const faces={
    dark:{
      label:"Классический Trollface с короной",
      bg:"",
      head:'<path class="tf-head" d="M105 82C111 40 159 22 225 27c75-7 128 29 135 89 16 18 21 43 12 70-7 16-21 28-39 34-11 53-58 84-111 84-58 0-104-32-116-86-30-8-49-31-49-61 0-19 10-36 28-48z"/>',
      eyes:'<path class="tf-line" d="M139 118c14-18 36-22 55-10m51-5c19-14 43-12 58 4"/><path class="tf-eye" d="M145 130c14-13 31-13 45 0-2 17-11 25-23 24-13-1-21-10-22-24zm103-11c15-12 33-9 44 5-3 16-13 23-25 21-13-2-20-11-19-26z"/>',
      mouth:'<path class="tf-mouth" d="M126 176c28-29 60-32 91-14 17 10 37 9 55-2 29-17 60-12 82 12-13 51-52 79-114 80-58 1-100-24-114-76z"/><path class="tf-teeth" d="M145 181c17-12 36-14 54-6l-3 26c-16-5-30-2-44 7zm62-8c18 4 34 3 50-4l8 25c-18 8-37 8-56 2zm69-5c16-5 30-2 43 8l-14 24c-11-7-21-8-34-4z"/>',
      extra:'<path class="tf-crown" d="M174 35l9-28 29 21 24-24 22 29 29-13 4 40-116 5z"/><path class="tf-crown-line" d="M174 62l119-2"/>'
    },
    comic:{
      label:"Комиксный Trollface — громко смеётся",
      bg:'<path class="tf-burst" d="M24 76l44 12-28-35 52 11-15-42 47 29 8-45 28 40 35-38 5 52 47-29-8 47 53-13-28 38 54 8-49 25 39 27-53 3 23 43-49-18 5 49-38-31-13 50-26-43-29 39-8-49-42 30 8-52-48 16 29-42-53-5 46-27-42-26 54-2z"/>',
      head:'<path class="tf-head" d="M103 78c12-42 60-60 124-54 72-4 121 35 128 92 22 20 23 54 4 75-16 17-39 22-58 17-22 46-70 69-121 59-50-9-83-39-88-83-26-7-42-29-42-55 0-22 18-43 53-51z"/>',
      eyes:'<path class="tf-brow" d="M135 111l-8-15 69-6 6 17m42-20l8-17 68 18-10 15"/><ellipse class="tf-eye-wide" cx="166" cy="135" rx="25" ry="32"/><ellipse class="tf-eye-wide" cx="278" cy="129" rx="25" ry="32"/><circle class="tf-pupil" cx="172" cy="137" r="9"/><circle class="tf-pupil" cx="272" cy="132" r="9"/>',
      mouth:'<path class="tf-mouth" d="M111 175c8-25 37-35 70-29 30 5 48 21 74 12 33-12 77-9 91 18 18 38-7 89-53 105-61 22-138 5-168-31-18-22-23-51-14-75z"/>',
      extra:'<path class="tf-teeth-wide" d="M132 174l32-9 7 31-30 5zm44-9l34 3 2 29-34-2zm45 4l32-8 8 28-36 8zm48-11l31-1 2 30-33 2zm-126 50l32-6 9 27-29 8zm47-6l34-1 3 29-31 2zm48 1l35-6 7 27-37 8z"/><path class="tf-tongue" d="M201 250c22-18 49-17 69 1-8 17-20 26-36 26-18 0-28-9-33-27z"/><path class="tf-exclaim" d="M360 43l11-35 8 3-8 35zm18 20l23-15 4 7-23 15z"/>'
    },
    light:{
      label:"Добрый Trollface с нимбом и крыльями",
      bg:'<path class="tf-cloud" d="M15 245c-15-22 2-46 29-43 2-28 43-38 59-13 23-12 48 8 39 30 28 7 31 36 5 47H31c-10-4-16-10-16-21zm307-175c-8-20 11-37 31-29 8-25 43-23 50 2 24-2 32 27 12 39h-75c-10-1-16-5-18-12z"/>',
      head:'<path class="tf-head" d="M111 84c12-42 59-60 120-55 69-4 119 34 125 91 20 19 23 50 6 71-12 16-33 24-53 20-19 48-66 74-117 65-51-8-86-40-91-84-28-7-44-29-44-55 0-22 18-43 54-53z"/>',
      eyes:'<path class="tf-line" d="M137 134c12 16 29 16 43-1m68 0c12 16 29 16 43-1"/>',
      mouth:'<path class="tf-mouth-light" d="M139 177c19 35 46 52 84 52 41 0 68-19 87-53-30 11-56 13-86 13-31 0-57-3-85-12z"/>',
      extra:'<ellipse class="tf-halo" cx="230" cy="24" rx="63" ry="15"/><path class="tf-wing" d="M93 145c-39-30-64-20-71 4 20-6 34 3 44 22-26-7-38 8-39 26 24-10 43-3 59 16m220-68c39-30 64-20 71 4-20-6-34 3-44 22 26-7 38 8 39 26-24-10-43-3-59 16"/><path class="tf-cheek" d="M132 165c12 7 22 7 32 1m132-1c12 7 22 7 32 1"/>'
    },
    neon:{
      label:"Неоновый Trollface в светящихся очках",
      bg:'<path class="tf-neon-ring" d="M28 92l35-35 35 35-35 35zM362 51l30 30-30 30-30-30zM382 242l20 20-20 20-20-20z"/>',
      head:'<path class="tf-head" d="M109 83c12-44 60-60 122-55 70-4 119 34 126 91 20 20 22 51 4 72-13 16-34 23-54 19-20 48-66 75-118 65-51-8-85-40-91-84-28-7-44-29-44-55 0-22 18-43 55-53z"/>',
      eyes:'<path class="tf-glasses" d="M127 118l86-13 9 48c-3 20-18 30-42 29-27-1-42-15-46-38zm121-13l86-4-4 49c-5 21-23 31-46 29-25-2-40-16-40-38z"/><path class="tf-glint" d="M147 129l36-14m-23 27l16-6m94-11l39-10"/>',
      mouth:'<path class="tf-mouth" d="M129 183c27-26 57-28 89-12 17 9 35 8 53-2 29-16 59-10 79 12-12 47-52 74-112 75-56 0-97-23-109-73z"/><path class="tf-teeth" d="M148 187l46-7-1 27-42 6zm57-8l50-4 2 28-50 3zm61-7l45 2-8 26-40-1z"/>',
      extra:'<path class="tf-lightning" d="M370 134l-26 49h23l-14 39 43-60h-25l16-28z"/><path class="tf-circuit" d="M68 210h28v20h-28m278 37h26v-17h24"/>'
    },
    vaporwave:{
      label:"Vaporwave Trollface в ретро-очках",
      bg:'<circle class="tf-sun" cx="323" cy="83" r="49"/><path class="tf-sun-lines" d="M274 77h98m-95 20h92m-80 20h67"/>',
      head:'<path class="tf-head" d="M109 83c12-44 60-60 122-55 70-4 119 34 126 91 20 20 22 51 4 72-13 16-34 23-54 19-20 48-66 75-118 65-51-8-85-40-91-84-28-7-44-29-44-55 0-22 18-43 55-53z"/>',
      eyes:'<path class="tf-shades" d="M126 119q43-31 86-7l8 39q-34 31-78 3zm124-7q46-25 87 5l-10 37q-42 24-74-5z"/><path class="tf-shade-line" d="M145 128l54 22m69-26l48 22"/>',
      mouth:'<path class="tf-mouth" d="M130 180c26-24 57-28 87-11 18 10 36 9 53-2 29-17 61-11 81 13-13 47-54 72-114 72-55 0-95-23-107-72z"/><path class="tf-teeth" d="M148 184l45-7-1 27-43 6zm58-9l48-3 2 28-49 3zm59-7l44 2-8 26-39-2z"/>',
      extra:'<path class="tf-palm" d="M85 290h270"/><path class="tf-star" d="M88 70l7 16 17 1-13 11 4 17-15-9-15 9 4-17-13-11 17-1zM390 175l6 13 14 1-11 9 3 14-12-7-12 7 3-14-11-9 14-1z"/>'
    },
    "8bit":{
      label:"Пиксельный Trollface из 8-bit игры",
      bg:'<path class="tf-pixel-bg" d="M28 46h38v38H28zm310 0h38v38h-38zM12 254h34v34H12zm340-10h42v42h-42z"/><path class="tf-pixel-star" d="M75 34h15v15H75zm255 260h15v15h-15z"/>',
      head:'<path class="tf-pixel-head" d="M112 64h210v24h27v31h24v108h-24v38h-37v24H142v-24h-37v-38H81V119h31z"/>',
      eyes:'<path class="tf-pixel-eye" d="M130 128h51v26h-51zm140 0h51v26h-51z"/><path class="tf-pixel-pupil" d="M156 128h25v26h-25zm140 0h25v26h-25z"/>',
      mouth:'<path class="tf-pixel-mouth" d="M116 180h26v-12h52v12h52v-12h52v12h38v62h-26v26H142v-26h-26z"/><path class="tf-pixel-teeth" d="M142 180h36v25h-36zm55 0h36v25h-36zm55 0h36v25h-36zm-83 42h36v22h-36zm55 0h36v22h-36zm55 0h36v22h-36z"/>',
      extra:'<path class="tf-pixel-cap" d="M148 46h128v18H148zm22-20h82v20h-82z"/><path class="tf-pixel-body" d="M120 285h190v42H120z"/>'
    },
    horror:{
      label:"Зловещий Trollface с красными глазами и клыками",
      bg:'<path class="tf-horror-smoke" d="M20 90c32-57 65-36 75 8-38-2-45 28-75 30zm330-53c39-38 70-15 76 24-32-7-50 6-76-24zM20 270c32-37 49-13 55 23-29-9-44 1-55-23z"/>',
      head:'<path class="tf-horror-head" d="M111 80c14-48 64-62 124-55 71-4 121 36 127 94 22 19 25 52 7 75-13 16-35 22-55 17-20 48-67 73-119 63-51-8-85-40-91-85-29-7-45-29-45-56 0-23 18-43 52-53z"/>',
      eyes:'<path class="tf-horror-brow" d="M126 117l75 24m-75-24l76-3m61-2l78-20m-76 44l76-24"/><ellipse class="tf-horror-eye" cx="166" cy="143" rx="16" ry="9"/><ellipse class="tf-horror-eye" cx="291" cy="137" rx="16" ry="9"/><circle class="tf-horror-glow" cx="167" cy="143" r="6"/><circle class="tf-horror-glow" cx="291" cy="137" r="6"/>',
      mouth:'<path class="tf-horror-mouth" d="M116 178c29-23 58-22 92-9 18 8 35 7 53-4 31-19 67-11 89 13-9 54-49 81-111 82-60 0-107-26-123-82z"/><path class="tf-fang" d="M143 180l22 4-8 28zm50 4l21 2-9 30zm94-6l22-2-14 29zm-45 38l-17 27-15-28z"/>',
      extra:'<path class="tf-horror-shadow" d="M96 105q-30 39-6 76m286-74q22 42 0 77"/><path class="tf-horror-scratch" d="M370 210l-13 29 11 18-24 27"/>'
    },
    y2k:{
      label:"Y2K Trollface со звёздными очками",
      bg:'<path class="tf-chrome" d="M24 50l30-30 30 30-30 30zm320 210l24-24 24 24-24 24z"/>',
      head:'<path class="tf-head tf-head-y2k" d="M109 83c12-44 60-60 122-55 70-4 119 34 126 91 20 20 22 51 4 72-13 16-34 23-54 19-20 48-66 75-118 65-51-8-85-40-91-84-28-7-44-29-44-55 0-22 18-43 55-53z"/>',
      eyes:'<path class="tf-y2k-glasses" d="M130 115h80l10 53h-92zm126 0h78l-9 53h-90z"/><path class="tf-star-eyes" d="M166 128l7 14 16 2-12 11 3 15-14-8-14 8 3-15-12-11 16-2zm125 0l7 14 16 2-12 11 3 15-14-8-14 8 3-15-12-11 16-2z"/>',
      mouth:'<path class="tf-mouth" d="M132 180c25-25 55-29 86-12 18 10 36 9 53-2 29-17 60-11 80 13-13 46-53 72-113 72-55 0-94-23-106-71z"/><path class="tf-teeth" d="M149 184l44-7-1 27-42 6zm58-9l48-3 2 28-49 3zm60-7l43 2-8 26-38-2z"/>',
      extra:'<path class="tf-y2k-shine" d="M90 115l12-25 12 25 25 12-25 12-12 25-12-25-25-12zM350 105l8-18 8 18 18 8-18 8-8 18-8-18-18-8z"/>'
    },
    hacker:{
      label:"Хакерский Trollface в капюшоне",
      bg:'<path class="tf-hood" d="M94 112c-4-82 53-119 136-111 75 6 124 51 129 127l-28-22c-18-29-52-42-99-43-51-2-91 12-113 49z"/><path class="tf-code" d="M44 70l9 13-9 13m22-26l-9 13 9 13m284 89l9 13-9 13m22-26l-9 13 9 13"/>',
      head:'<path class="tf-hacker-head" d="M121 102c18-39 62-54 111-52 61-3 103 25 119 72 14 20 13 47-4 64-12 12-28 18-45 15-20 39-58 61-108 54-45-7-74-33-80-71-23-7-36-25-36-46 0-15 15-29 43-36z"/>',
      eyes:'<path class="tf-hacker-eye" d="M139 141l45-12 19 12-20 9h-40zm107-3l48-17 14 14-19 11h-42z"/><path class="tf-hacker-glow" d="M150 143h37m79-3h38"/>',
      mouth:'<path class="tf-hacker-mouth" d="M140 183c23-21 48-24 76-10 16 8 31 7 47-2 27-14 53-8 70 12-12 39-46 61-98 61-48 0-81-20-95-61z"/><path class="tf-hacker-teeth" d="M155 186h40v22h-40zm51-7h42v24h-42zm54 0h37l-6 23h-36z"/>',
      extra:'<path class="tf-code" d="M68 151h18m-9-9v18m282-106h18m-9-9v18M80 250h18m-9-9v18m262 44h18m-9-9v18"/>'
    },
    pastel:{
      label:"Милый пастельный Trollface с румянцем",
      bg:'<path class="tf-heart" d="M42 104c-18-21-51 4-10 39 41-35 8-60-10-39zm328-41c-18-21-51 4-10 39 41-35 8-60-10-39zM348 260c-18-21-51 4-10 39 41-35 8-60-10-39z"/>',
      head:'<path class="tf-head tf-head-pastel" d="M109 83c12-44 60-60 122-55 70-4 119 34 126 91 20 20 22 51 4 72-13 16-34 23-54 19-20 48-66 75-118 65-51-8-85-40-91-84-28-7-44-29-44-55 0-22 18-43 55-53z"/>',
      eyes:'<path class="tf-heart-eyes" d="M139 128c-17-17-39 5 0 35 39-30 17-52 0-35zm124-1c-17-17-39 5 0 35 39-30 17-52 0-35z"/>',
      mouth:'<path class="tf-pastel-mouth" d="M154 189c18 17 43 25 72 25 29 0 52-8 70-25-18 32-41 47-70 47-30 0-55-15-72-47z"/>',
      extra:'<ellipse class="tf-blush" cx="125" cy="173" rx="22" ry="10"/><ellipse class="tf-blush" cx="326" cy="173" rx="22" ry="10"/><path class="tf-hand" d="M93 215c-13-15-32-9-29 9 2 12 17 21 35 27m268-36c13-15 32-9 29 9-2 12-17 21-35 27"/>'
    }
  };
  const v=faces[t]||faces.dark;
  return `<svg class="troll-illustration trollface-${t}" viewBox="0 0 420 340" role="img" aria-label="${v.label}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="tf-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="11" stdDeviation="9" flood-color="#000" flood-opacity=".42"/></filter>
      <filter id="tf-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="tf-silver" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".52" stop-color="#e7e9ef"/><stop offset="1" stop-color="#aeb8c5"/></linearGradient>
    </defs>
    ${v.bg}
    <g filter="url(#tf-shadow)">
      <path class="tf-body" d="M58 338c7-50 37-80 92-91h117c55 10 89 42 98 91z"/>
      ${v.head}
      ${v.eyes}
      ${v.mouth}
      ${t==="dark"?'<path class="tf-hand-point" d="M312 265c15-18 32-20 45-8l35 39-17 17-39-27-9 54h-27l4-53-18 17-17-17z"/>':""}
      ${t==="light"?'<path class="tf-wing" d="M75 178c-44-25-59-9-61 11 21-5 34 4 43 20-21-2-30 12-29 25 21-9 39-2 54 13m260-69c44-25 59-9 61 11-21-5-34 4-43 20 21-2 30 12 29 25-21-9-39-2-54 13"/>':""}
    </g>
  </svg>`;
}

function home(){
  const trollface=trollfaceForTheme(me?.theme || "dark")
  app.innerHTML=`<section class="reference-home">
    <div class="reference-home-copy">
      <h1>УГАДАЙ МЕМ</h1>
      <p>Угадывай мемы, собирай очки<br class="desktop-break"> и побеждай друзей!</p>
      <div class="reference-home-actions">
        <button class="btn primary reference-play" id="${me?"go-game":"go-register"}" type="button">Начать игру <span aria-hidden="true">→</span></button>
        ${me?'<button class="reference-logout" id="logout" type="button">Выйти из аккаунта</button>':''}
      </div>
    </div>
    <div class="reference-home-art">${trollface}</div>
  </section>
  <section class="reference-feature-strip" id="how-to-play" aria-label="Особенности игры">
    <div class="reference-feature">
      <svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="10" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 24c.5-5 3-7.5 7.5-7.5s7 2.5 7.5 7.5M20 6a3.5 3.5 0 010 7M21 17c3 .4 4.5 2.5 4.8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>3–8 игроков</span>
    </div>
    <div class="reference-feature">
      <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M16.5 1.8L5.7 15.2h7.1l-1.4 11L22.5 11h-7.2z" fill="currentColor"/></svg>
      <span>Динамичные раунды</span>
    </div>
    <div class="reference-feature">
      <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M8 3h12v5c0 4-2.5 7-6 7s-6-3-6-7zM8 5H3v3c0 3 2 5 5 5M20 5h5v3c0 3-2 5-5 5M14 15v6m-5 4h10m-8-4h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Рейтинги и награды</span>
    </div>
  </section>`;
  $("#go-game")?.addEventListener("click",()=>setView("game"));
  $("#go-register")?.addEventListener("click",()=>setView("register"));
  $("#logout")?.addEventListener("click",async()=>{await api("/api/logout",{method:"POST"});if(socket)socket.disconnect();me=null;room=null;setView("home")});
}
function auth(reg){app.innerHTML=`<div class="card form"><div class="eyebrow">${reg?"Новый игрок":"С возвращением"}</div><h1>${reg?"Создать аккаунт":"Войти"}</h1><div id="auth-error"></div><form id="auth-form"><div class="field"><label>Имя игрока</label><input name="username" minlength="3" maxlength="18" required autocomplete="username"></div><div class="field"><label>Пароль</label><input name="password" type="password" minlength="8" required autocomplete="${reg?"new-password":"current-password"}"></div><button class="btn primary" type="submit">${reg?"Зарегистрироваться":"Войти"}</button></form><div class="switch">${reg?"Уже есть аккаунт?":"Впервые здесь?"} <a id="auth-switch">${reg?"Войти":"Создать аккаунт"}</a></div></div>`;$("#auth-switch").onclick=()=>setView(reg?"login":"register");$("#auth-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const d=await api(reg?"/api/register":"/api/login",{method:"POST",body:JSON.stringify({username:f.get("username"),password:f.get("password")})});me=d.user;connect();setView("home")}catch(err){$("#auth-error").innerHTML=`<div class="notice">${esc(err.message)}</div>`}}}
function connect(){if(socket)socket.disconnect();socket=io();socket.on("connect_error",e=>{errorText=e.message});socket.on("room:update",r=>{room=r;if(view==="game")gamePage()});socket.on("round:choosing",d=>{room={...room,status:"choosing",round:d.round,maxRounds:d.maxRounds,chooserId:d.chooserId,chooserName:d.chooserName};if(view==="game")gamePage()});socket.on("round:started",d=>{room={...room,status:"guessing",situation:d.situation,options:d.options,chooserId:d.chooserId};if(view==="game")gamePage()});socket.on("phase:timer",d=>{if(room){room.timerEndsAt=d.endsAt;room.timerDuration=d.duration||(d.phase==="choosing"?room.settings?.chooseSeconds:room.settings?.thinkSeconds)};startPhaseTimer()});socket.on("round:results",d=>{room=d.room;room.status="results";if(view==="game")gamePage()});socket.on("game:completed",d=>{if(room){room.status="completed";room.results=d.results}api("/api/me").then(x=>{me=x.user;header()});if(view==="game")gamePage()});socket.on("error:message",m=>{errorText=m;if(view==="game")gamePage()});socket.on("room:closed",d=>{room=null;errorText=d.message;gamePage()})}
function gamePage(){if(!socket)connect();document.body.dataset.tableSkin=me?.tableSkin||"table_classic";app.innerHTML=`<div class="page-head"><div><div class="eyebrow">Игровая комната</div><h1>Играть</h1><p class="muted">Создай новую комнату или введи код друга.</p></div></div>${errorText?`<div class="notice">${esc(errorText)}</div>`:""}${room?roomMarkup():`<div class="grid"><div class="card"><h2>Новая комната</h2><p>Ты станешь ведущим. Начать можно, когда соберутся минимум три игрока.</p><button class="btn primary" id="create-room">Создать комнату</button></div><div class="card"><h2>Присоединиться</h2><p>Введи шестизначный код комнаты.</p><div class="field"><input id="join-code" maxlength="6" placeholder="НАПРИМЕР A1B2C3"></div><button class="btn" id="join-room">Войти в комнату</button></div></div>`}`;$("#create-room")?.addEventListener("click",()=>socket.emit("room:create"));$("#join-room")?.addEventListener("click",()=>socket.emit("room:join",{code:$("#join-code").value}));bindRoom();startPhaseTimer();updateFullscreenButton()}
function phaseTimerMarkup(phase){
  const choosing=phase==="choosing";
  const fallback=choosing?(room.settings?.chooseSeconds||45):(room.settings?.thinkSeconds||30);
  const duration=Number(room.timerDuration)||fallback;
  const endsAt=Number(room.timerEndsAt)||Date.now()+duration*1000;
  return `<div class="phase-timer" data-ends-at="${endsAt}" data-duration="${duration}" role="timer" aria-live="off">
    <div class="phase-timer-head"><span>${choosing?"⏳ Время на выбор":"⏱ Время на ответ"}</span><strong class="timer-value">--:--</strong></div>
    <div class="phase-timer-track"><span class="phase-timer-fill"></span></div>
    <div class="phase-timer-foot"><span>${choosing?"Выбор мема и ситуации":"Выбор подходящего мема"}</span><b class="timer-caption"></b></div>
  </div>`;
}
function updatePhaseTimer(){
  const timers=document.querySelectorAll(".phase-timer");
  if(!timers.length){if(phaseTimerInterval){clearInterval(phaseTimerInterval);phaseTimerInterval=null}return}
  timers.forEach(el=>{
    const left=Math.max(0,Number(el.dataset.endsAt)-Date.now());
    const total=Math.max(1,Number(el.dataset.duration)||1);
    const seconds=Math.ceil(left/1000);
    const value=el.querySelector(".timer-value"),fill=el.querySelector(".phase-timer-fill"),caption=el.querySelector(".timer-caption");
    if(value)value.textContent=Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
    if(fill)fill.style.width=Math.max(0,Math.min(100,left/(total*1000)*100))+"%";
    el.classList.toggle("timer-urgent",seconds<=10&&seconds>0);
    el.classList.toggle("timer-expired",seconds===0);
    if(caption)caption.textContent=seconds===0?"Время вышло":seconds<=10?"Поторопись!":"Осталось секунд";
  });
}
function startPhaseTimer(){
  updatePhaseTimer();
  if(!phaseTimerInterval&&document.querySelector(".phase-timer"))phaseTimerInterval=setInterval(updatePhaseTimer,100);
}
function roomMarkup(){
  const host=room.hostId===me.id, chooser=room.chooserId===me.id, hand=room.myHand||[];
  const handPanel=(interactive=false)=>`<section class="hand-panel"><div class="hand-heading"><div><h3>Твоя рука</h3><p class="muted">Использованная карта уходит до конца матча. Новая берётся из твоей колоды.</p></div><div class="deck-counter"><b>${hand.length}</b><span>в руке</span><small>В запасе: ${room.deckCount||0}</small></div></div><div class="choices hand-choices">${hand.length?hand.map(m=>interactive?memeChoice(m,"data-target",selectedMeme===m):`<div class="choice meme-choice hand-card"><img src="${memeImage(m)}" alt="${esc(m)}" loading="lazy"><span>${esc(m)}</span></div>`).join(""):`<div class="empty">Карты закончились</div>`}</div></section>`;
  let body="";
  if(room.status==="waiting")body=`<div class="card"><div class="small">КОД ДЛЯ ДРУЗЕЙ</div><div class="room-code">${room.code}</div><p class="muted">Отправь код друзьям. Нужно минимум 3 игрока, максимум 8.</p><div class="players">${room.players.map(p=>`<div class="player"><span class="player-avatar">${avatarView(p.avatar,"avatar-image")}</span>${esc(p.username)} ${p.id===room.hostId?"★":""}<small>${p.online?"В комнате":"Не в сети"}</small></div>`).join("")}</div>${host?`<div class="room-settings"><h3>Настройки комнаты</h3><div class="settings-grid"><label>Количество раундов<select id="setting-rounds"><option value="3" ${room.settings?.rounds===3?"selected":""}>3 раунда</option><option value="5" ${(!room.settings||room.settings.rounds===5)?"selected":""}>5 раундов</option><option value="7" ${room.settings?.rounds===7?"selected":""}>7 раундов</option><option value="10" ${room.settings?.rounds===10?"selected":""}>10 раундов</option></select></label><label>Время на размышление<select id="setting-think"><option value="15" ${room.settings?.thinkSeconds===15?"selected":""}>15 секунд</option><option value="30" ${(!room.settings||room.settings.thinkSeconds===30)?"selected":""}>30 секунд</option><option value="45" ${room.settings?.thinkSeconds===45?"selected":""}>45 секунд</option><option value="60" ${room.settings?.thinkSeconds===60?"selected":""}>60 секунд</option><option value="90" ${room.settings?.thinkSeconds===90?"selected":""}>90 секунд</option></select></label><label>Время на загадывание<select id="setting-choose"><option value="15" ${room.settings?.chooseSeconds===15?"selected":""}>15 секунд</option><option value="30" ${room.settings?.chooseSeconds===30?"selected":""}>30 секунд</option><option value="45" ${(!room.settings||room.settings.chooseSeconds===45)?"selected":""}>45 секунд</option><option value="60" ${room.settings?.chooseSeconds===60?"selected":""}>60 секунд</option><option value="90" ${room.settings?.chooseSeconds===90?"selected":""}>90 секунд</option></select></label></div><button class="btn" id="save-room-settings">Сохранить настройки</button></div><button class="btn primary" id="start-game" ${room.players.length<3?"disabled":""}>Начать игру</button>`:"<p class='muted'>Ожидаем ведущего…</p>"}</div>`;
  if(room.status==="choosing")body=`<div class="card"><div class="eyebrow">Раунд ${room.round} / ${room.maxRounds}</div><div class="progress"><span style="width:${room.round/room.maxRounds*100}%"></span></div><h2>${chooser?"Твоя очередь: выбери мем и придумай ситуацию":"Ждём очередь игрока"}</h2>${phaseTimerMarkup("choosing")}<p class="muted">${chooser?"Выбери одну из шести карт в своей руке. После выбора она отправится в сброс, а ты возьмёшь новую из запаса.":`Сейчас выбирает ${esc(room.chooserName||"следующий игрок")}. Очередь идёт по часовой стрелке.`}</p>${chooser?`${handPanel(true)}${selectedMeme?`<h3>Ситуация для мема «${esc(selectedMeme)}»</h3><div class="situation-compose"><textarea id="custom-situation" maxlength="240" rows="3" placeholder="Напиши ситуацию, которая подходит к этому мему…">${esc(selectedSituation||"")}</textarea><button class="btn generate-btn" id="generate-situation" type="button">✦ Сгенерировать</button></div><div class="small situation-help">От 3 до 240 символов. Можно написать свою или сгенерировать вариант.</div>`:"<p class='muted'>Выбери мем-карту выше, чтобы написать ситуацию.</p>"}<button class="btn primary" id="submit-choice" ${!selectedSituation?.trim()||!selectedMeme?"disabled":""}>Начать угадывание</button>`:`<div class="empty">Сейчас выбирает: ${esc(room.chooserName||"Игрок")}</div>${handPanel(false)}`}</div>`;
  if(room.status==="guessing")body=`<div class="card"><div class="eyebrow">Раунд ${room.round} / ${room.maxRounds}</div><h2>${esc(room.situation||"Ситуация")}</h2>${phaseTimerMarkup("guessing")}${chooser?`<p class="muted">Игроки выбирают мем. Ждём ответы…</p>`:`<p class="muted">Какой мем лучше всего подходит? Выбери один вариант.</p><div class="choices">${(room.options||[]).map(m=>memeChoice(m,"data-guess")).join("")}</div>`}${handPanel(false)}<div class="players">${room.players.map(p=>`<div class="player"><span class="player-avatar">${avatarView(p.avatar,"avatar-image")}</span>${esc(p.username)}<small>${p.id===room.chooserId?"Ведущий":p.id===me.id?"Ты":""}</small></div>`).join("")}</div></div>`;
  if(room.status==="results")body=`<div class="card"><div class="eyebrow">Результат раунда ${room.round}</div><h2>${room.results?.noOne?"Никто не угадал":"Есть правильные ответы!"}</h2><p class="muted">Правильный мем:</p>${room.target?`<div class="result-meme"><img src="${memeImage(room.target)}" alt="${esc(room.target)}"><b>${esc(room.target)}</b></div>`:""}<section class="answer-reveal"><h3>Кто что выбрал</h3><div class="answer-list">${(room.answers||[]).map(a=>`<div class="answer-row ${a.isChooser?"answer-chooser":a.correct?"answer-correct":a.answered?"answer-wrong":"answer-missed"}"><span class="answer-avatar">${avatarView(a.avatar,"avatar-image")}</span><div class="answer-person"><b>${esc(a.username)}</b><small>${a.isChooser?"Загадал этот мем":a.answered?"Выбрал ответ":"Не успел ответить"}</small></div><div class="answer-choice">${a.meme?`<img src="${memeImage(a.meme)}" alt=""><span>${esc(a.meme)}</span>`:`<span class="muted">—</span>`}</div><strong class="answer-status">${a.isChooser?"Ведущий":a.correct?"Угадал":a.answered?"Не угадал":"Пропуск"}</strong></div>`).join("")}</div></section><div class="players">${room.players.slice().sort((a,b)=>b.score-a.score).map(p=>`<div class="player"><span class="player-avatar">${avatarView(p.avatar,"avatar-image")}</span>${esc(p.username)}<small>${p.score} очков</small></div>`).join("")}</div><button class="btn primary" id="next-round">${room.round>=room.maxRounds?"Завершить игру":"Следующий игрок по часовой стрелке"}</button></div>`;
  if(room.status==="completed")body=`<div class="card"><div class="eyebrow">Игра завершена</div><h2>Итоги матча</h2><div class="players">${(room.results||room.players).slice().sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="player"><span class="player-avatar">${avatarView(p.avatar,"avatar-image")}</span>${i+1}. ${esc(p.username)}<small>${p.score} очков · +${p.coins??Math.max(0,p.score)*10} монет</small></div>`).join("")}</div>${host?`<button class="btn primary" id="restart-game">Сыграть ещё раз</button>`:"<p class='muted'>Ведущий может запустить новый матч.</p>"}</div>`;
  return `<div class="game-table"><div class="inline room-toolbar" style="justify-content:space-between;margin-bottom:16px"><div><div class="small">КОМНАТА</div><b>${room.code}</b></div><div class="inline"><button class="btn" id="fullscreen-room" type="button">⛶ На весь экран</button><button class="btn danger" id="leave-room">Покинуть комнату</button></div></div>${body}</div>`;
}
function bindRoom(){
  if(!room)return;
  $("#save-room-settings")?.addEventListener("click",()=>socket.emit("room:settings",{rounds:Number($("#setting-rounds").value),thinkSeconds:Number($("#setting-think").value),chooseSeconds:Number($("#setting-choose").value)}));
  $("#start-game")?.addEventListener("click",()=>socket.emit("game:start"));
  $("#leave-room")?.addEventListener("click",()=>{socket.emit("room:leave");room=null;gamePage()});
  $("#next-round")?.addEventListener("click",()=>socket.emit("round:next"));
  $("#restart-game")?.addEventListener("click",()=>socket.emit("game:restart"));
  document.querySelectorAll("[data-situation]").forEach(b=>b.onclick=()=>{selectedSituation=b.dataset.situation;gamePage()});
  document.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{selectedMeme=b.dataset.target;selectedSituation=null;gamePage()});
  $("#custom-situation")?.addEventListener("input",e=>{selectedSituation=e.target.value;const submit=$("#submit-choice");if(submit)submit.disabled=!selectedMeme||selectedSituation.trim().length<3});
  $("#generate-situation")?.addEventListener("click",()=>{if(!selectedMeme)return;selectedSituation=generateSituation(selectedMeme);const field=$("#custom-situation");if(field){field.value=selectedSituation;field.focus()}const submit=$("#submit-choice");if(submit)submit.disabled=false});
  $("#submit-choice")?.addEventListener("click",()=>{const text=$("#custom-situation")?.value?.trim()||"";socket.emit("round:choose",{situation:text,target:selectedMeme});selectedSituation=null;selectedMeme=null});
  document.querySelectorAll("[data-guess]").forEach(b=>b.onclick=()=>{b.classList.add("card-played");socket.emit("round:guess",{meme:b.dataset.guess})});
  $("#fullscreen-room")?.addEventListener("click",async()=>{
    try{
      if(document.body.classList.contains("room-window-fullscreen")){document.body.classList.remove("room-window-fullscreen");}
      else if(document.fullscreenElement){await document.exitFullscreen();}
      else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();}
      else document.body.classList.add("room-window-fullscreen");
    }catch{document.body.classList.add("room-window-fullscreen");}
    updateFullscreenButton();
  });
}
function updateFullscreenButton(){const b=$("#fullscreen-room");if(b)b.textContent=document.fullscreenElement||document.body.classList.contains("room-window-fullscreen")?"↙ Выйти из полного экрана":"⛶ На весь экран";}
document.addEventListener("fullscreenchange",updateFullscreenButton);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("room-window-fullscreen")){document.body.classList.remove("room-window-fullscreen");updateFullscreenButton()}});

async function profilePage(token=viewRenderId){
  if(token!==viewRenderId||view!=="profile")return;
  const current=me.theme||"dark";
  const avatars=["🙂","😎","🤩","😂","😈","👻","🤖","🐱","🐸","🦊","🐼","🐵","🐙","🦄","💀","👑"];
  const themes=[
    ["dark","Тёмная","Чёрно-серый фон, светлый текст и лаймовый акцент.","preview-dark","УГАДАЙ МЕМ","Тёмная тема","Минимализм и спокойные оттенки"],
    ["comic","Комикс","Жёлтые и красные акценты, жирные рамки и комиксное настроение.","preview-comic","БА-БАХ!","КОМИКС","Яркие цвета и контрастные контуры"],
    ["light","Светлая","Чистый светлый интерфейс с мягкими синими акцентами.","preview-light","GOOD VIBES","СВЕТЛАЯ","Воздух и простота"],
    ["neon","Неон","Тёмная сцена, яркие неоновые линии и свечение.","preview-neon","NEON MODE","НЕОН","Сияние ночного города"],
    ["vaporwave","Vaporwave","Розово-фиолетовый градиент и эстетика 80-х.","preview-vaporwave","ＡＥＳＴＨＥＴＩＣ","VAPORWAVE","Закат, пальмы и синтвейв"],
    ["8bit","Ретро 8-bit","Пиксельные формы и аркадная палитра.","preview-8bit","INSERT COIN","8-BIT","Настроение старых игр"],
    ["horror","Хоррор","Мрачные оттенки, кроваво-красные акценты.","preview-horror","DON’T LOOK BACK","ХОРРОР","Жуткая атмосфера"],
    ["y2k","Y2K","Глянцевые голубые и розовые оттенки начала 2000-х.","preview-y2k","★ FUTURE ★","Y2K","Хром и цифровой блеск"],
    ["hacker","Хакерская","Чёрный фон и терминальный зелёный.","preview-hacker","ACCESS GRANTED","ХАКЕРСКАЯ","Зелёный код и терминал"],
    ["pastel","Пастель","Нежные пастельные цвета и мягкий контраст.","preview-pastel","SOFT MODE","ПАСТЕЛЬ","Спокойная палитра" ]
  ];
  app.innerHTML=`<div class="page-head"><div><div class="eyebrow">Персонализация</div><h1>Настройки профиля</h1><p class="muted">Настрой ник, аватар и оформление своего аккаунта.</p></div></div><section class="card profile-settings"><h2>Мой профиль</h2><div class="profile-avatar-current">${avatarView(me.avatar,"avatar-image")}</div><form id="profile-settings-form"><div class="field"><label for="profile-nickname">Игровой ник</label><input id="profile-nickname" name="username" minlength="3" maxlength="18" value="${esc(me.username)}" required /></div><div class="field"><label>Выбери аватар</label><div class="avatar-picker">${avatars.map(a=>`<button type="button" class="avatar-option ${a===(me.avatar||"🙂")?"selected":""}" data-avatar="${a}" aria-label="Аватар ${a}">${a}</button>`).join("")}</div><div class="field avatar-upload-field"><label for="avatar-file">Или загрузи своё изображение</label><input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp"><small class="muted">PNG, JPG или WebP · до 2 МБ</small><button type="button" class="btn" id="upload-avatar">Загрузить аватар</button></div></div><div id="profile-settings-message" class="small" aria-live="polite"></div><button class="btn primary" type="submit">Сохранить профиль</button></form></section><h2 class="section-heading">Тема оформления</h2><div class="grid theme-grid">${themes.map(t=>`<button class="card theme-card ${current===t[0]?"theme-selected":""}" data-theme-choice="${t[0]}"><div class="theme-preview ${t[3]}"><span>${t[4]}</span><b>${t[5]}</b><small>${t[6]}</small></div><h3>${t[1]}</h3><p>${t[2]}</p><span class="theme-status">${current===t[0]?"Выбрана":"Выбрать тему"}</span></button>`).join("")}</div><div id="theme-message" class="small" aria-live="polite"></div>`;
  let chosenAvatar=me.avatar||"🙂";
  document.querySelectorAll("[data-avatar]").forEach(b=>b.onclick=()=>{chosenAvatar=b.dataset.avatar;document.querySelectorAll("[data-avatar]").forEach(x=>x.classList.toggle("selected",x===b));document.querySelector(".profile-avatar-current").innerHTML=avatarView(chosenAvatar,"avatar-image")});
  $("#upload-avatar").onclick=async()=>{const file=$("#avatar-file").files[0];if(!file){$("#profile-settings-message").textContent="Сначала выбери изображение";return}if(file.size>2*1024*1024){$("#profile-settings-message").textContent="Файл слишком большой. Максимум 2 МБ";return}try{const response=await fetch("/api/profile/avatar-upload",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type},body:file});const d=await response.json();if(!response.ok)throw Error(d.error||"Не удалось загрузить аватар");me=d.user;chosenAvatar=me.avatar;$(".profile-avatar-current").innerHTML=avatarView(me.avatar,"avatar-image");header();$("#profile-settings-message").textContent="Аватар загружен и сохранён!"}catch(err){$("#profile-settings-message").textContent=err.message}};
  $("#profile-settings-form").onsubmit=async e=>{e.preventDefault();const username=new FormData(e.target).get("username").trim();try{const d=await api("/api/profile/update",{method:"POST",body:JSON.stringify({username,...(chosenAvatar.startsWith("data:image/")?{}:{avatar:chosenAvatar})})});me=d.user;header();$("#profile-settings-message").textContent="Профиль сохранён!"}catch(err){$("#profile-settings-message").textContent=err.message}};
  document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=async()=>{try{const d=await api("/api/profile/theme",{method:"POST",body:JSON.stringify({theme:b.dataset.themeChoice})});me=d.user;document.body.dataset.theme=me.theme;profilePage()}catch(e){$("#theme-message").textContent=e.message}});
}
async function shopPage(token=viewRenderId){if(token!==viewRenderId||view!=="shop")return;try{const d=await api("/api/shop"),fresh=await api("/api/me");if(token!==viewRenderId||view!=="shop")return;me=fresh.user;document.body.dataset.theme=me.theme||"dark";document.body.dataset.cardSkin=me.equipped||"cover_default";document.body.dataset.tableSkin=me.tableSkin||"table_classic";const renderItems=(items,type)=>items.map(it=>{const owned=me.owned.includes(it.id),equipped=type==="table"?me.tableSkin===it.id:me.equipped===it.id;return `<div class="card"><div class="${type==="table"?"table-skin-preview":"skin-pair-preview"}"><div class="${type==="table"?"table-sample "+it.className:"cover "+it.className+" preview-meme"}">${type==="table"?"<span>УГАДАЙ МЕМ</span><small>ИГРОВОЙ СТОЛ</small>":"<span class=\"cover-inner\"><span class=\"cover-emblem\">М</span><span class=\"cover-title\">МЕМ</span><span class=\"cover-bottom\">MEME CARD</span></span>"}</div>${type==="table"?"":`<div class="cover ${it.className} preview-situation"><span class="cover-inner"><span class="cover-emblem">С</span><span class="cover-title">СИТУАЦИЯ</span><span class="cover-bottom">SITUATION CARD</span></span></div>`}</div><h3>${it.name}</h3><p>${it.description}</p><div class="inline" style="justify-content:space-between"><b>${it.price?it.price+" монет":"Бесплатно"}</b><button class="btn ${equipped?"":"primary"}" data-${type}-item="${it.id}" ${equipped?"disabled":""}>${equipped?"Выбрано":owned?"Надеть":"Купить"}</button></div></div>`}).join("");app.innerHTML=`<div class="page-head"><div><div class="eyebrow">Коллекция</div><h1>Магазин</h1><p class="muted">Комбинируй любые обложки карт с любым игровым столом.</p></div><div class="stat"><b>${me.coins}</b><span>Твой баланс</span></div></div><h2>Обложки карт</h2><div class="grid">${renderItems(d.items,"card")}</div><h2 style="margin-top:32px">Игровые столы</h2><p class="muted">Стол — отдельный скин. Он не меняет обложки карт, поэтому можно собирать собственные сочетания.</p><div class="grid">${renderItems(d.tableItems||[],"table")}</div>`;document.querySelectorAll("[data-card-item]").forEach(b=>b.onclick=()=>shopAction(b,"card"));document.querySelectorAll("[data-table-item]").forEach(b=>b.onclick=()=>shopAction(b,"table"));}catch(e){if(token===viewRenderId&&view==="shop")app.innerHTML=`<div class="notice">${esc(e.message)}</div>`}}
async function shopAction(b,type){try{const id=b.dataset[type+"Item"],owned=me.owned.includes(id),path=type==="table"?(owned?"/api/shop/table-equip":"/api/shop/table-buy"):(owned?"/api/shop/equip":"/api/shop/buy");const d=await api(path,{method:"POST",body:JSON.stringify({itemId:id})});me=d.user;shopPage()}catch(e){alert(e.message)}}
async function leaderboard(token=viewRenderId){if(token!==viewRenderId||view!=="leaderboard")return;try{const d=await api("/api/leaderboard");if(token!==viewRenderId||view!=="leaderboard")return;app.innerHTML=`<div class="page-head"><div><div class="eyebrow">Лучшие игроки</div><h1>Рейтинг</h1></div></div><div class="card table-wrap"><table><thead><tr><th>Место</th><th>Игрок</th><th>Всего очков</th><th>Матчей</th></tr></thead><tbody>${d.players.map((p,i)=>`<tr><td>${i+1}</td><td><span class="leader-avatar">${avatarView(p.avatar,"avatar-image")}</span> ${esc(p.username)}</td><td>${p.total_score}</td><td>${p.games_played}</td></tr>`).join("")}</tbody></table></div>`}catch(e){if(token===viewRenderId&&view==="leaderboard")app.innerHTML=`<div class="notice">${esc(e.message)}</div>`}}
async function adminPage(token=viewRenderId){if(token!==viewRenderId||view!=="admin")return;try{const d=await api("/api/admin/overview");if(token!==viewRenderId||view!=="admin")return;app.innerHTML=`<div class="page-head"><div><div class="eyebrow">Управление проектом</div><h1>Админ-панель</h1></div></div><h2>Игроки</h2><div class="card table-wrap"><table><thead><tr><th>ID</th><th>Игрок</th><th>Монеты</th><th>Очки</th><th>Статус</th><th>Действия</th></tr></thead><tbody>${d.users.map(u=>`<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${u.coins}</td><td>${u.total_score}</td><td>${u.is_banned?"Заблокирован":"Активен"}</td><td>${u.is_admin?`Админ`:`${u.is_banned?"Заблокирован":""}`} <button class="btn ${u.id===me.id?"primary":""}" data-coins="${u.id}">${u.id===me.id?"Изменить мои монеты":"Изменить монеты"}</button> ${u.is_admin?"":`<button class="btn ${u.is_banned?"":"danger"}" data-ban="${u.id}" data-state="${u.is_banned}">${u.is_banned?"Разблокировать":"Блокировать"}</button>`}</td></tr>`).join("")}</tbody></table></div><h2 style="margin-top:28px">Комнаты</h2><div class="card table-wrap"><table><thead><tr><th>Код</th><th>Состояние</th><th>Обновлена</th><th></th></tr></thead><tbody>${d.rooms.map(r=>`<tr><td>${r.code}</td><td>${esc(r.state.status)}</td><td>${r.updated_at}</td><td><button class="btn danger" data-room="${r.code}">Удалить</button></td></tr>`).join("")}</tbody></table></div><h2 style="margin-top:28px">Последние матчи</h2><div class="card table-wrap"><table><thead><tr><th>ID</th><th>Комната</th><th>Раундов</th><th>Дата</th></tr></thead><tbody>${d.matches.map(m=>`<tr><td>${m.id}</td><td>${m.room_code}</td><td>${m.round_count}</td><td>${m.completed_at}</td></tr>`).join("")}</tbody></table></div>`;document.querySelectorAll("[data-ban]").forEach(b=>b.onclick=async()=>{const banned=b.dataset.state==="1";await api(`/api/admin/user/${b.dataset.ban}/${banned?"unban":"ban"}`,{method:"POST",body:JSON.stringify({reason:"Решение администратора"})});adminPage()});document.querySelectorAll("[data-coins]").forEach(b=>b.onclick=async()=>{const amount=prompt(`Игрок: ${b.closest("tr").children[1].textContent}. Сколько монет добавить или снять? Введите целое число (например, 100 или -50).`);if(amount===null)return;await api(`/api/admin/user/${b.dataset.coins}/coins`,{method:"POST",body:JSON.stringify({amount:Number(amount)})});adminPage()});document.querySelectorAll("[data-room]").forEach(b=>b.onclick=async()=>{if(confirm("Удалить комнату?")){await api(`/api/admin/room/${b.dataset.room}/delete`,{method:"POST"});adminPage()}})}catch(e){if(token===viewRenderId&&view==="admin")app.innerHTML=`<div class="notice">${esc(e.message)}</div>`}}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
(async()=>{try{me=(await api("/api/me")).user;if(me)connect()}catch{}render()})();


// Рекламная плашка PORNHUB запускает скример после явного клика пользователя.
(()=>{
  const ad=document.getElementById('pornhub-ad');
  const overlay=document.getElementById('jumpscare');
  const close=document.getElementById('close-jumpscare');
  if(!ad||!overlay||!close)return;
  let audioContext=null, soundTimer=null;
  function stopScare(){
    overlay.classList.remove('active');overlay.setAttribute('aria-hidden','true');
    if(soundTimer){clearTimeout(soundTimer);soundTimer=null;}
    if(audioContext){try{audioContext.close()}catch{}audioContext=null;}
  }
  function screamForThreeSeconds(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioContext=new AC();const ctx=audioContext,now=ctx.currentTime,duration=3;
      // Синтезированный хоррор-крик: шумовой выдох + два резко меняющихся формантных тона.
      const length=Math.floor(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<length;i++){
        const t=i/ctx.sampleRate,env=Math.min(1,t/.045)*Math.min(1,(duration-t)/.18);
        data[i]=(Math.random()*2-1)*env*(.62+.38*Math.sin(2*Math.PI*7*t));
      }
      const noise=ctx.createBufferSource();noise.buffer=buffer;
      const band=ctx.createBiquadFilter();band.type='bandpass';band.Q.value=1.1;
      band.frequency.setValueAtTime(950,now);band.frequency.linearRampToValueAtTime(1750,now+.42);band.frequency.linearRampToValueAtTime(720,now+1.25);band.frequency.linearRampToValueAtTime(1450,now+2.05);band.frequency.linearRampToValueAtTime(900,now+duration);
      const ng=ctx.createGain();ng.gain.setValueAtTime(.0001,now);ng.gain.linearRampToValueAtTime(.42,now+.06);ng.gain.setValueAtTime(.34,now+2.65);ng.gain.linearRampToValueAtTime(.0001,now+duration);
      noise.connect(band);band.connect(ng);ng.connect(ctx.destination);noise.start(now);noise.stop(now+duration);
      [0,1].forEach((n)=>{
        const osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
        osc.type=n?'sawtooth':'triangle';
        const base=n?510:330;
        osc.frequency.setValueAtTime(base,now);osc.frequency.linearRampToValueAtTime(base*1.8,now+.35);osc.frequency.linearRampToValueAtTime(base*.72,now+1.15);osc.frequency.linearRampToValueAtTime(base*1.55,now+2.05);osc.frequency.linearRampToValueAtTime(base*.85,now+duration);
        osc.detune.value=n?13:-9;filter.type=' bandpass'.trim();filter.frequency.value=n?1250:850;filter.Q.value=2.2;
        gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(n?.11:.16,now+.05);gain.gain.setValueAtTime(n?.09:.13,now+2.65);gain.gain.linearRampToValueAtTime(.0001,now+duration);
        osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+duration);
      });
      soundTimer=setTimeout(()=>{if(audioContext){try{audioContext.close()}catch{}audioContext=null;}soundTimer=null;},3100);
    }catch{}
  }
  ad.addEventListener('click',()=>{
    overlay.classList.add('active');overlay.setAttribute('aria-hidden','false');
    screamForThreeSeconds();
  });
  close.addEventListener('click',stopScare);
  overlay.addEventListener('click',e=>{if(e.target===overlay)stopScare()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')stopScare()});
})();
