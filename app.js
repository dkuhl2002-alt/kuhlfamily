import {firebaseConfig,vapidKey} from "./firebase-config.js";

const configured=firebaseConfig.apiKey&&!firebaseConfig.apiKey.includes("HIER_");
let fb=null,db=null,auth=null;

if(configured){
  try{
    const [a,u,f]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
    ]);
    const app=a.initializeApp(firebaseConfig);
    auth=u.getAuth(app);
    await u.signInAnonymously(auth);
    db=f.getFirestore(app);
    fb={f};
  }catch(e){
    console.warn("Firebase konnte nicht gestartet werden.",e);
  }
}

const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];

function localDateISO(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
const today=()=>localDateISO();

function dateFromISO(iso){
  if(!iso) return null;
  const [y,m,d]=iso.split("-").map(Number);
  return new Date(y,m-1,d,12,0,0,0);
}
function addDaysToISO(iso,n){
  const d=dateFromISO(iso||today());
  d.setDate(d.getDate()+n);
  return localDateISO(d);
}
function addMonthsToISO(iso,n){
  const d=dateFromISO(iso||today());
  const day=d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth()+n);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return localDateISO(d);
}
function nextDue(iso,recurrence){
  if(!iso) return "";
  if(recurrence==="Täglich") return addDaysToISO(iso,1);
  if(recurrence==="Wöchentlich") return addDaysToISO(iso,7);
  if(recurrence==="Alle 2 Wochen") return addDaysToISO(iso,14);
  if(recurrence==="Monatlich") return addMonthsToISO(iso,1);
  return "";
}

const add=n=>addDaysToISO(today(),n);
const id=p=>p+"-"+crypto.randomUUID();
const fmt=x=>x?new Intl.DateTimeFormat("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"}).format(dateFromISO(x)):"";
const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function isOverdue(task){return !task.done&&task.due&&task.due<today()}
function isDueToday(task){return !task.done&&task.due===today()}
function wasDoneToday(task){return !!task.done&&String(task.doneAt||"").slice(0,10)===today()}

function completionLabel(task){
  if(!task.doneBy) return "";
  if(!task.doneAt) return "Erledigt von "+task.doneBy;
  const d=new Date(task.doneAt);
  const when=Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit"}).format(d);
  return "Erledigt von "+task.doneBy+(when?" · "+when+" Uhr":"");
}
function dueLabel(task){
  if(!task.due) return "Ohne Fälligkeit";
  if(isOverdue(task)) return "Überfällig · "+fmt(task.due);
  if(task.due===today()) return "Heute";
  if(task.due===add(1)) return "Morgen";
  return fmt(task.due);
}
function recurrenceShort(value){
  return value&&value!=="Nein"?"↻ "+value:"";
}

const demo={
  tasks:[
    {id:"t1",title:"Müll rausstellen",due:today(),priority:"Normal",done:false,recurrence:"Wöchentlich",reminder:"Am Fälligkeitstag"},
    {id:"t2",title:"Rechnung bezahlen",due:today(),priority:"Dringend",done:false,recurrence:"Nein",reminder:"1 Tag vorher"}
  ],
  shopping:[
    {id:"s1",title:"Milch",done:false},
    {id:"s2",title:"Bananen",done:false},
    {id:"s3",title:"Windeln",done:false}
  ],
  events:[
    {id:"e1",title:"Kinderarzt",date:add(1),time:"16:30",person:"Malia",category:"Arzt",location:""},
    {id:"e2",title:"Familienzeit",date:add(3),time:"11:00",person:"Familie",category:"Freizeit",location:""}
  ],
  pinboard:[{id:"p1",text:"Paket kommt heute."}],
  expenses:[],
  recipes:[{title:"Spaghetti Bolognese"},{title:"Hähnchen mit Reis"},{title:"Wraps"}],
  products:[
    {id:"p1",name:"Milch",shop:"REWE"},
    {id:"p2",name:"Windeln",shop:"dm"},
    {id:"p3",name:"Wasser",shop:"REWE"},
    {id:"p4",name:"Feuchttücher",shop:"dm"}
  ]
};

const state={user:null,data:structuredClone(demo)};
const keys=["tasks","shopping","events","pinboard","expenses","recipes","products"];

function load(){
  if(!db){
    try{
      state.data={...state.data,...JSON.parse(localStorage.getItem("kuhlfamily-v2")||"{}")}
    }catch{}
  }
}
function store(){
  if(!db)localStorage.setItem("kuhlfamily-v2",JSON.stringify(state.data));
}

async function save(key,item){
  if(db){
    await fb.f.setDoc(fb.f.doc(db,key,item.id),item,{merge:true});
  }else{
    const i=state.data[key].findIndex(x=>x.id===item.id);
    i>=0?state.data[key][i]={...state.data[key][i],...item}:state.data[key].unshift(item);
    store();
    render();
  }
}
async function remove(key,itemId){
  if(db){
    await fb.f.deleteDoc(fb.f.doc(db,key,itemId));
  }else{
    state.data[key]=state.data[key].filter(x=>x.id!==itemId);
    store();
    render();
  }
}
async function watch(){
  if(db){
    for(const key of keys){
      fb.f.onSnapshot(fb.f.collection(db,key),s=>{
        state.data[key]=s.docs.map(d=>({id:d.id,...d.data()}));
        render();
      });
    }
  }else render();
}

function item(icon,title,sub=""){
  return `<div class="item"><span>${icon}</span><div><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:""}</div></div>`;
}
function toast(t){
  const x=$("#toast");
  x.textContent=t;
  x.classList.add("show");
  setTimeout(()=>x.classList.remove("show"),1800);
}

$$('[data-user]').forEach(b=>b.onclick=()=>{
  state.user=b.dataset.user;
  $("#gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#hello").textContent="Hallo "+state.user;
  $("#date").textContent=new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long"}).format(new Date());
  render();
});

$("#changeUser").onclick=()=>{
  $("#app").classList.add("hidden");
  $("#gate").classList.remove("hidden");
};

$$('[data-nav]').forEach(b=>b.onclick=()=>{
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#'+b.dataset.nav).classList.add('active');
  $$('[data-nav]').forEach(x=>x.classList.toggle('active',x===b));
  scrollTo({top:0,behavior:"smooth"});
});

function renderTaskDashboard(openT){
  const overdue=openT.filter(isOverdue);
  const todayTasks=openT.filter(isDueToday);
  const doneToday=state.data.tasks.filter(wasDoneToday);

  const stats=`
    <div class="task-stats">
      <div><strong>${openT.length}</strong><small>offen</small></div>
      <div class="${todayTasks.length?"stat-accent":""}"><strong>${todayTasks.length}</strong><small>heute</small></div>
      <div class="${overdue.length?"stat-danger":""}"><strong>${overdue.length}</strong><small>überfällig</small></div>
      <div><strong>${doneToday.length}</strong><small>heute erledigt</small></div>
    </div>`;

  const preview=openT
    .sort((a,b)=>{
      if(isOverdue(a)!==isOverdue(b)) return isOverdue(a)?-1:1;
      if(a.due&&b.due) return a.due.localeCompare(b.due);
      if(a.due) return -1;
      if(b.due) return 1;
      return (a.title||"").localeCompare(b.title||"");
    })
    .slice(0,3)
    .map(x=>item(isOverdue(x)?"⚠️":"✅",x.title,dueLabel(x)+" · "+(x.priority||"Normal")))
    .join("");

  $("#taskPreview").innerHTML=stats+(preview||item("✓","Alles erledigt","Für heute ist Ruhe."));
}

function render(){
  const openT=state.data.tasks.filter(x=>!x.done);
  const openS=state.data.shopping.filter(x=>!x.done);
  const up=[...state.data.events]
    .filter(x=>x.date>=today())
    .sort((a,b)=>((a.date||"")+(a.time||"")).localeCompare((b.date||"")+(b.time||"")));

  renderTaskDashboard(openT);

  $("#shopPreview").innerHTML=openS.slice(0,4).map(x=>item("🛒",x.title)).join("")||item("🛒","Liste ist leer");
  $("#eventPreview").innerHTML=up.slice(0,3).map(x=>item("📅",x.title,fmt(x.date)+" "+(x.time||"")+" · "+x.person)).join("")||item("📅","Keine Termine");
  $("#pinPreview").innerHTML=state.data.pinboard.slice(0,3).map(x=>item("📌",x.text)).join("")||item("📌","Keine Hinweise");

  const important=[
    ...openT.filter(isOverdue).map(x=>({icon:"⚠️",t:x.title,s:"Überfällig seit "+fmt(x.due),rank:1})),
    ...openT.filter(x=>x.priority==="Dringend"&&!isOverdue(x)).map(x=>({icon:"🚨",t:x.title,s:x.due?dueLabel(x):"Dringend",rank:2})),
    ...openT.filter(x=>x.priority==="Wichtig"&&isDueToday(x)).map(x=>({icon:"❗",t:x.title,s:"Heute · Wichtig",rank:3})),
    ...up.filter(x=>x.date<=add(1)).map(x=>({icon:"📅",t:x.title,s:fmt(x.date)+" "+(x.time||""),rank:4}))
  ].sort((a,b)=>a.rank-b.rank);

  $("#important").innerHTML=important.slice(0,5).map(x=>item(x.icon,x.t,x.s)).join("")||item("✓","Nichts Dringendes","Alles im grünen Bereich.");

  renderTasks();
  renderShopping();
  renderProducts();
  renderEvents();
}

function renderTasks(){
  const open=[...state.data.tasks]
    .filter(x=>!x.done)
    .sort((a,b)=>{
      if(isOverdue(a)!==isOverdue(b)) return isOverdue(a)?-1:1;
      if(a.due&&b.due) return a.due.localeCompare(b.due);
      if(a.due) return -1;
      if(b.due) return 1;
      const rank={Dringend:0,Wichtig:1,Normal:2};
      return (rank[a.priority]??3)-(rank[b.priority]??3);
    });

  const completed=[...state.data.tasks]
    .filter(x=>x.done)
    .sort((a,b)=>String(b.doneAt||"").localeCompare(String(a.doneAt||"")))
    .slice(0,12);

  const overdueCount=open.filter(isOverdue).length;
  const todayCount=open.filter(isDueToday).length;

  let html=`
    <div class="task-overview">
      <div><b>${open.length}</b><span>offen</span></div>
      <div class="${todayCount?"hot":""}"><b>${todayCount}</b><span>heute</span></div>
      <div class="${overdueCount?"danger":""}"><b>${overdueCount}</b><span>überfällig</span></div>
      <div><b>${state.data.tasks.filter(wasDoneToday).length}</b><span>heute erledigt</span></div>
    </div>
    <div class="task-section-title">Offene Aufgaben</div>`;

  html+=open.map(taskRow).join("")||`<div class="empty-state">🎉 Alles erledigt. Dat kann sich sehen lassen.</div>`;

  if(completed.length){
    html+=`<div class="task-section-title completed-title">Zuletzt erledigt</div>`;
    html+=completed.map(taskRow).join("");
  }

  $("#taskList").innerHTML=html;

  $$('[data-task-toggle]').forEach(b=>b.onclick=()=>toggleTask(b.dataset.taskToggle));
  $$('[data-task-delete]').forEach(b=>b.onclick=()=>deleteTask(b.dataset.taskDelete));
}

function taskRow(x){
  const priorityClass=x.priority==="Dringend"?"urgent":x.priority==="Wichtig"?"important-priority":"normal";
  const status=isOverdue(x)?"overdue":x.done?"completed":"";
  const meta=x.done
    ? completionLabel(x)
    : dueLabel(x)+(x.reminder&&x.reminder!=="Keine"?" · 🔔 "+x.reminder:"");

  return `
    <div class="row task-row ${status}">
      <button class="check ${x.done?'done':''}" data-task-toggle="${x.id}" aria-label="Aufgabe erledigen">${x.done?'✓':''}</button>
      <div class="grow">
        <b class="task-title">${esc(x.title)}</b>
        <small class="${isOverdue(x)?"overdue-text":""}">${esc(meta)}</small>
        <div class="task-tags">
          <span class="priority ${priorityClass}">${esc(x.priority||"Normal")}</span>
          ${recurrenceShort(x.recurrence)?`<span class="recurrence">${esc(recurrenceShort(x.recurrence))}</span>`:""}
        </div>
      </div>
      <button class="task-delete" data-task-delete="${x.id}" title="Aufgabe löschen">×</button>
    </div>`;
}

async function toggleTask(taskId){
  const x=state.data.tasks.find(t=>t.id===taskId);
  if(!x) return;

  if(x.done){
    await save("tasks",{...x,done:false,doneBy:null,doneAt:null});
    toast("Aufgabe wieder geöffnet");
    return;
  }

  const doneAt=new Date().toISOString();
  const seriesId=x.seriesId||x.id;

  await save("tasks",{...x,seriesId,done:true,doneBy:state.user,doneAt});

  if(x.recurrence&&x.recurrence!=="Nein"&&x.due){
    const next=nextDue(x.due,x.recurrence);
    if(next){
      const exists=state.data.tasks.some(t=>
        !t.done&&t.id!==x.id&&(t.seriesId===seriesId)&&t.due===next
      );
      if(!exists){
        await save("tasks",{
          id:id("t"),
          title:x.title,
          due:next,
          priority:x.priority||"Normal",
          recurrence:x.recurrence,
          reminder:x.reminder||"Keine",
          done:false,
          doneBy:null,
          doneAt:null,
          seriesId,
          createdBy:state.user,
          createdAt:new Date().toISOString()
        });
      }
    }
  }

  toast("Erledigt von "+state.user);
}

async function deleteTask(taskId){
  const x=state.data.tasks.find(t=>t.id===taskId);
  if(!x) return;
  if(!confirm('Aufgabe "'+x.title+'" wirklich löschen?')) return;
  await remove("tasks",taskId);
  toast("Aufgabe gelöscht");
}

function renderShopping(){
  $("#shopList").innerHTML=state.data.shopping.map(x=>`
    <div class="row">
      <button class="check ${x.done?'done':''}" data-shop="${x.id}">${x.done?'✓':''}</button>
      <div class="grow">
        <b>${esc(x.title)}</b>
        ${x.doneBy?`<small>Erledigt von ${esc(x.doneBy)}</small>`:''}
      </div>
    </div>`).join("");

  $$('[data-shop]').forEach(b=>b.onclick=()=>{
    const x=state.data.shopping.find(t=>t.id===b.dataset.shop);
    save("shopping",{...x,done:!x.done,doneBy:!x.done?state.user:null,doneAt:!x.done?new Date().toISOString():null});
  });
}

function renderProducts(){
  $("#products").innerHTML=state.data.products.map(x=>`
    <button class="product" data-product="${x.id}">
      <span>${x.shop==='dm'?'🧴':'🛍️'}</span>
      <b>${esc(x.name)}</b>
      <small>${esc(x.shop)}</small>
    </button>`).join("");

  $$('[data-product]').forEach(b=>b.onclick=()=>{
    const p=state.data.products.find(x=>x.id===b.dataset.product);
    save("shopping",{id:id("s"),title:p.name,done:false,addedBy:state.user,createdAt:new Date().toISOString()});
    toast(p.name+" hinzugefügt");
  });
}

function renderEvents(){
  $("#eventList").innerHTML=[...state.data.events]
    .sort((a,b)=>((a.date||"")+(a.time||"")).localeCompare((b.date||"")+(b.time||"")))
    .map(x=>`
      <div class="row person-${x.person}">
        <div class="grow">
          <b>${esc(x.title)}</b>
          <small>${fmt(x.date)} ${esc(x.time)} · ${esc(x.person)} · ${esc(x.category)}</small>
        </div>
        ${x.location?`<a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.location)}">Maps</a>`:''}
      </div>`).join("");
}

$("#shopForm").onsubmit=e=>{
  e.preventDefault();
  const v=$("#shopInput").value.trim();
  if(v){
    save("shopping",{id:id("s"),title:v,done:false,addedBy:state.user,createdAt:new Date().toISOString()});
    $("#shopInput").value="";
  }
};

$("#meal").onclick=()=>{
  const a=state.data.recipes;
  $("#mealResult").textContent=a.length?" "+a[Math.floor(Math.random()*a.length)].title:" Noch keine Rezepte";
};

$("#fab").onclick=()=>$("#quick").showModal();
$$('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());

function f(label,name,type='text',required=false){
  return `<label>${label}<input name="${name}" type="${type}" ${required?"required":""}></label>`;
}
function sel(label,name,a){
  return `<label>${label}<select name="${name}">${a.map(x=>`<option>${x}</option>`).join('')}</select></label>`;
}

$$('[data-add]').forEach(b=>b.onclick=()=>{
  const t=b.dataset.add;
  $("#quick").close();

  const h={
    task:"Aufgabe hinzufügen",
    event:"Termin hinzufügen",
    shopping:"Einkauf hinzufügen",
    expense:"Ausgabe erfassen",
    pin:"Pinnwand-Notiz"
  }[t];

  $("#editorTitle").textContent=h;
  let x="";

  if(t==="task"){
    x=
      f("Aufgabe","title","text",true)+
      f("Fällig am","due","date")+
      sel("Priorität","priority",["Normal","Wichtig","Dringend"])+
      sel("Wiederholung","recurrence",["Nein","Täglich","Wöchentlich","Alle 2 Wochen","Monatlich"])+
      sel("Erinnerung","reminder",["Keine","Am Fälligkeitstag","1 Tag vorher","2 Tage vorher"]);
  }
  if(t==="event"){
    x=
      f("Termin","title","text",true)+
      f("Datum","date","date",true)+
      f("Uhrzeit","time","time")+
      sel("Für wen?","person",["Dominic","Sabrina","Malia","Familie"])+
      sel("Kategorie","category",["Familie","Malia","Geburtstag","Arzt","Kita","Freizeit","Sonstiges"])+
      f("Ort","location");
  }
  if(t==="shopping")x=f("Artikel","title","text",true);
  if(t==="expense")x=f("Betrag","amount","number",true)+sel("Kategorie","category",["Lebensmittel","Drogerie","Freizeit","Auto","Kind","Wohnen","Sonstiges"])+f("Verwendungszweck optional","note");
  if(t==="pin")x='<label>Notiz<textarea name="text" required></textarea></label>';

  $("#editorForm").innerHTML=x+`<input type="hidden" name="kind" value="${t}"><button class="primary wide">Speichern</button>`;
  $("#editor").showModal();
});

$("#editorForm").onsubmit=e=>{
  e.preventDefault();
  const d=new FormData(e.target);
  const t=d.get("kind");

  if(t==="task")save("tasks",{
    id:id("t"),
    title:d.get("title"),
    due:d.get("due"),
    priority:d.get("priority"),
    recurrence:d.get("recurrence"),
    reminder:d.get("reminder"),
    done:false,
    doneBy:null,
    doneAt:null,
    createdBy:state.user,
    createdAt:new Date().toISOString()
  });

  if(t==="event")save("events",{
    id:id("e"),
    title:d.get("title"),
    date:d.get("date"),
    time:d.get("time"),
    person:d.get("person"),
    category:d.get("category"),
    location:d.get("location"),
    createdBy:state.user,
    createdAt:new Date().toISOString()
  });

  if(t==="shopping")save("shopping",{
    id:id("s"),
    title:d.get("title"),
    done:false,
    addedBy:state.user,
    createdAt:new Date().toISOString()
  });

  if(t==="expense")save("expenses",{
    id:id("x"),
    amount:Number(d.get("amount")),
    category:d.get("category"),
    note:d.get("note"),
    date:today(),
    createdAt:new Date().toISOString()
  });

  if(t==="pin")save("pinboard",{
    id:id("p"),
    text:d.get("text"),
    createdBy:state.user,
    createdAt:new Date().toISOString()
  });

  $("#editor").close();
  e.target.reset();
  toast("Gespeichert");
};

load();
watch();

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
