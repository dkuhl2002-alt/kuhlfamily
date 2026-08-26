import {firebaseConfig,vapidKey} from "./firebase-config.js";

const configured=firebaseConfig.apiKey&&!firebaseConfig.apiKey.includes("HIER_");
let fb=null,db=null,auth=null;
let firebaseReady=false;

async function initFirebase(){
  if(!configured){
    render();
    return;
  }

  try{
    const [a,u,f]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
    ]);

    const firebaseApp=a.initializeApp(firebaseConfig);
    auth=u.getAuth(firebaseApp);

    // Wichtig: Die Oberfläche und Benutzerwahl warten NICHT auf Firebase.
    // Firebase verbindet sich im Hintergrund.
    await Promise.race([
      u.signInAnonymously(auth),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("Firebase-Anmeldung Timeout")),8000))
    ]);

    db=f.getFirestore(firebaseApp);
    fb={f};
    firebaseReady=true;
    watch();
  }catch(e){
    console.warn("Firebase konnte nicht gestartet werden. KuhlFamily läuft zunächst lokal weiter.",e);
    render();
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

function addYearsToISO(iso,n){
  const d=dateFromISO(iso||today());
  const month=d.getMonth();
  const day=d.getDate();
  d.setDate(1);
  d.setFullYear(d.getFullYear()+n);
  d.setMonth(month);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return localDateISO(d);
}

function nextEventDate(iso,recurrence){
  if(!iso) return "";
  if(recurrence==="Wöchentlich") return addDaysToISO(iso,7);
  if(recurrence==="Monatlich") return addMonthsToISO(iso,1);
  if(recurrence==="Jährlich") return addYearsToISO(iso,1);
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


const householdTemplates={
  "Flur":{
    icon:"🚪",
    tasks:[
      {title:"Manuell saugen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Schuhbereich aufräumen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Spiegel reinigen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Fußleisten reinigen",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Kinderzimmer":{
    icon:"🧸",
    tasks:[
      {title:"Aufräumen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Manuell saugen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Staub wischen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Oberflächen reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Bettwäsche wechseln",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Spielzeug sortieren",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Schlafzimmer":{
    icon:"🛏️",
    tasks:[
      {title:"Manuell saugen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Staub wischen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Nachttische und Oberflächen reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Bettwäsche wechseln",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Unter dem Bett saugen",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Bad":{
    icon:"🛁",
    tasks:[
      {title:"WC reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Waschbecken reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Dusche / Badewanne reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Spiegel reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Handtücher wechseln",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Armaturen entkalken",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Abfluss reinigen",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Gäste-WC":{
    icon:"🚻",
    tasks:[
      {title:"WC reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Waschbecken reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Spiegel reinigen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Handtuch wechseln",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Oberflächen reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"}
    ]
  },
  "Küche":{
    icon:"🍳",
    tasks:[
      {title:"Arbeitsflächen gründlich reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Spüle reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Herd reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Kühlschrank kontrollieren",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Kühlschrank reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Backofen reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Küchenfronten reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Dunstabzug reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Mülleimer reinigen",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Wohnzimmer":{
    icon:"🛋️",
    tasks:[
      {title:"Manuell saugen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Sofa absaugen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Staub wischen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Oberflächen reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Unter Möbeln saugen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Fußleisten reinigen",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Balkon":{
    icon:"🌿",
    tasks:[
      {title:"Balkon fegen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Balkonmöbel reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Geländer reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Ablauf kontrollieren",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Balkontür / Scheibe reinigen",recurrence:"Monatlich",rhythm:"Monatlich"}
    ]
  },
  "Allgemein":{
    icon:"🏠",
    tasks:[
      {title:"Wäsche waschen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Wäsche zusammenlegen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Handtücher waschen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Fenster putzen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Türen und Lichtschalter reinigen",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Papier / Glas wegbringen",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"}
    ]
  },
  "Charlie":{
    icon:"🐈",
    tasks:[
      {title:"Katzenklo reinigen",recurrence:"Täglich",rhythm:"Täglich"},
      {title:"Katzenstreu komplett wechseln",recurrence:"Alle 2 Wochen",rhythm:"Alle 2 Wochen"},
      {title:"Futter auffüllen",recurrence:"Täglich",rhythm:"Täglich"},
      {title:"Wasser wechseln",recurrence:"Täglich",rhythm:"Täglich"},
      {title:"Futternäpfe reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Wassernapf / Trinkbrunnen reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Katzenhaare von Sofa / Decken entfernen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Kratzbaum absaugen / reinigen",recurrence:"Wöchentlich",rhythm:"Wöchentlich"},
      {title:"Spielzeug kontrollieren",recurrence:"Monatlich",rhythm:"Monatlich"},
      {title:"Katzenstreu vor dem Klo saugen",recurrence:"Nein",rhythm:"Nach Bedarf"}
    ]
  }
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
  if(db&&fb){
    try{
      await fb.f.setDoc(fb.f.doc(db,key,item.id),item,{merge:true});
      return;
    }catch(e){
      console.warn("Firebase-Speichern fehlgeschlagen, lokale Sicherung wird verwendet.",e);
    }
  }

  const i=state.data[key].findIndex(x=>x.id===item.id);
  i>=0?state.data[key][i]={...state.data[key][i],...item}:state.data[key].unshift(item);
  store();
  render();
}
async function remove(key,itemId){
  if(db&&fb){
    try{
      await fb.f.deleteDoc(fb.f.doc(db,key,itemId));
      return;
    }catch(e){
      console.warn("Firebase-Löschen fehlgeschlagen, lokale Sicherung wird verwendet.",e);
    }
  }

  state.data[key]=state.data[key].filter(x=>x.id!==itemId);
  store();
  render();
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
    .map(x=>item(isOverdue(x)?"⚠️":"✅",x.title,dueLabel(x)+" · "+(x.priority||"Normal")+(x.area?" · "+x.area:"")))
    .join("");

  $("#taskPreview").innerHTML=stats+(preview||item("✓","Alles erledigt","Für heute ist Ruhe."));
}


function eventReminderDate(eventDate,reminder){
  if(!eventDate||!reminder||reminder==="Keine") return "";
  if(reminder==="Am selben Tag") return eventDate;
  if(reminder==="1 Tag vorher") return addDaysToISO(eventDate,-1);
  if(reminder==="1 Woche vorher") return addDaysToISO(eventDate,-7);
  return "";
}

function eventRecurrenceLabel(value){
  return value&&value!=="Nein"?"↻ "+value:"";
}

function eventOccurrenceKey(e){
  return (e.date||"")+" "+(e.time||"")+" "+(e.title||"");
}

function upcomingEventOccurrences(days=370){
  const from=today();
  const until=addDaysToISO(from,days);
  const out=[];

  for(const source of state.data.events){
    if(!source?.date) continue;

    const recurrence=source.recurrence||"Nein";

    if(recurrence==="Nein"){
      if(source.date>=from&&source.date<=until){
        out.push({...source,sourceId:source.id,occurrenceDate:source.date});
      }
      continue;
    }

    let occurrence=source.date;
    let guard=0;

    // Springt bei alten Serien bis zur ersten noch relevanten Wiederholung.
    while(occurrence<from&&guard<1000){
      const next=nextEventDate(occurrence,recurrence);
      if(!next||next===occurrence) break;
      occurrence=next;
      guard++;
    }

    while(occurrence&&occurrence<=until&&guard<1200){
      if(occurrence>=from){
        out.push({...source,date:occurrence,sourceId:source.id,occurrenceDate:occurrence});
      }
      const next=nextEventDate(occurrence,recurrence);
      if(!next||next===occurrence) break;
      occurrence=next;
      guard++;
    }
  }

  return out.sort((a,b)=>eventOccurrenceKey(a).localeCompare(eventOccurrenceKey(b)));
}

function formatMonthTitle(iso){
  return new Intl.DateTimeFormat("de-DE",{month:"long",year:"numeric"}).format(dateFromISO(iso));
}

function dayNumber(iso){
  return String(dateFromISO(iso)?.getDate()||"").padStart(2,"0");
}

function monthShort(iso){
  return new Intl.DateTimeFormat("de-DE",{month:"short"}).format(dateFromISO(iso)).replace(".","");
}

function eventDateLabel(iso){
  if(iso===today()) return "Heute";
  if(iso===addDaysToISO(today(),1)) return "Morgen";
  return fmt(iso);
}

function render(){
  const openT=state.data.tasks.filter(x=>!x.done);
  const openS=state.data.shopping.filter(x=>!x.done);
  const up=upcomingEventOccurrences(370);

  renderTaskDashboard(openT);

  $("#shopPreview").innerHTML=openS.slice(0,4).map(x=>item("🛒",x.title)).join("")||item("🛒","Liste ist leer");
  $("#eventPreview").innerHTML=up.slice(0,3).map(x=>item(
    x.category==="Geburtstag"?"🎂":"📅",
    x.title,
    eventDateLabel(x.date)+" "+(x.time||"")+" · "+(x.person||"Familie")
  )).join("")||item("📅","Keine Termine");
  $("#pinPreview").innerHTML=state.data.pinboard.slice(0,3).map(x=>item("📌",x.text)).join("")||item("📌","Keine Hinweise");

  const eventReminders=up
    .filter(x=>{
      const reminderDate=eventReminderDate(x.date,x.reminder||"Keine");
      return reminderDate&&reminderDate<=today()&&x.date>=today();
    })
    .map(x=>({
      icon:x.category==="Geburtstag"?"🎂":"🔔",
      t:x.title,
      s:(x.reminder||"Erinnerung")+" · "+eventDateLabel(x.date)+(x.time?" "+x.time:""),
      rank:3
    }));

  const important=[
    ...openT.filter(isOverdue).map(x=>({icon:"⚠️",t:x.title,s:"Überfällig seit "+fmt(x.due),rank:1})),
    ...openT.filter(x=>x.priority==="Dringend"&&!isOverdue(x)).map(x=>({icon:"🚨",t:x.title,s:x.due?dueLabel(x):"Dringend",rank:2})),
    ...openT.filter(x=>x.priority==="Wichtig"&&isDueToday(x)).map(x=>({icon:"❗",t:x.title,s:"Heute · Wichtig",rank:3})),
    ...eventReminders,
    ...up.filter(x=>x.date<=add(1)).map(x=>({icon:x.category==="Geburtstag"?"🎂":"📅",t:x.title,s:eventDateLabel(x.date)+" "+(x.time||""),rank:4}))
  ].sort((a,b)=>a.rank-b.rank);

  const uniqueImportant=[];
  const seenImportant=new Set();
  for(const x of important){
    const key=x.t+"|"+x.s;
    if(!seenImportant.has(key)){
      seenImportant.add(key);
      uniqueImportant.push(x);
    }
  }

  $("#important").innerHTML=uniqueImportant.slice(0,5).map(x=>item(x.icon,x.t,x.s)).join("")||item("✓","Nichts Dringendes","Alles im grünen Bereich.");

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
  $$('[data-task-edit]').forEach(b=>b.onclick=()=>openTaskEditor(b.dataset.taskEdit));
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
          ${x.area?`<span class="task-area">${x.area==="Charlie"?"🐈":"📍"} ${esc(x.area)}</span>`:""}
          ${recurrenceShort(x.recurrence)?`<span class="recurrence">${esc(recurrenceShort(x.recurrence))}</span>`:""}
        </div>
      </div>
      <div class="task-row-actions">
        <button class="task-edit" data-task-edit="${x.id}" title="Aufgabe bearbeiten">✎</button>
        <button class="task-delete" data-task-delete="${x.id}" title="Aufgabe löschen">×</button>
      </div>
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
          area:x.area||"",
          templateKey:x.templateKey||"",
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


function taskSelectOptions(values,current){
  return values.map(v=>`<option value="${esc(v)}" ${v===current?"selected":""}>${esc(v||"Kein Bereich")}</option>`).join("");
}

function taskFormHtml(task={}){
  const areas=["","Flur","Kinderzimmer","Schlafzimmer","Bad","Gäste-WC","Küche","Wohnzimmer","Balkon","Allgemein","Charlie"];
  return `
    <input type="hidden" name="kind" value="task">
    <input type="hidden" name="editId" value="${esc(task.id||"")}">
    <input type="hidden" name="templateKey" value="${esc(task.templateKey||"")}">

    <label>Aufgabe *
      <input name="title" required value="${esc(task.title||"")}" placeholder="z. B. Bad reinigen">
    </label>

    <label>Bereich
      <select name="area">${taskSelectOptions(areas,task.area||"")}</select>
    </label>

    <div class="form-two">
      <label>Fällig / Start
        <input name="due" type="date" value="${esc(task.due||today())}">
      </label>
      <label>Priorität
        <select name="priority">${taskSelectOptions(["Normal","Wichtig","Dringend"],task.priority||"Normal")}</select>
      </label>
    </div>

    <div class="form-two">
      <label>Wiederholung
        <select name="recurrence">${taskSelectOptions(["Nein","Täglich","Wöchentlich","Alle 2 Wochen","Monatlich"],task.recurrence||"Nein")}</select>
      </label>
      <label>Erinnerung
        <select name="reminder">${taskSelectOptions(["Keine","Am Fälligkeitstag","1 Tag vorher","2 Tage vorher"],task.reminder||"Keine")}</select>
      </label>
    </div>

    ${task.rhythm&&task.rhythm!==task.recurrence?`<div class="template-rhythm-note">Vorschlag: ${esc(task.rhythm)}</div>`:""}

    <button class="primary wide">${task.id?"Änderungen speichern":"Aufgabe speichern"}</button>
  `;
}

function openTaskEditor(taskOrId=""){
  let task={};

  if(typeof taskOrId==="string"&&taskOrId){
    task=state.data.tasks.find(x=>x.id===taskOrId)||{};
  }else if(taskOrId&&typeof taskOrId==="object"){
    task={...taskOrId};
  }

  if($("#quick").open) $("#quick").close();
  $("#editorTitle").textContent=task.id?"Aufgabe bearbeiten":"Aufgabe hinzufügen";
  $("#editorForm").innerHTML=taskFormHtml(task);
  $("#editor").showModal();
}

function ensureHouseholdExtras(){
  if($("#householdDialog")) return;

  document.body.insertAdjacentHTML("beforeend",`
    <dialog id="householdDialog" class="household-dialog">
      <div class="dialog-head">
        <div>
          <span class="kicker">HAUSHALT</span>
          <h3 id="householdTitle">Aufgabenvorschläge</h3>
        </div>
        <button class="close" id="closeHousehold">×</button>
      </div>

      <div id="householdIntro" class="household-intro">
        Raum oder Bereich auswählen. Danach einfach eine Aufgabe antippen.
      </div>

      <div id="householdContent"></div>
    </dialog>
  `);

  $("#closeHousehold").onclick=()=>$("#householdDialog").close();
}

function openHouseholdSuggestions(){
  ensureHouseholdExtras();
  renderHouseholdAreas();
  $("#householdDialog").showModal();
}

function renderHouseholdAreas(){
  $("#householdTitle").textContent="Aufgabenvorschläge";
  $("#householdIntro").textContent="Raum oder Bereich auswählen. Danach einfach eine Aufgabe antippen.";

  $("#householdContent").innerHTML=`
    <div class="household-area-grid">
      ${Object.entries(householdTemplates).map(([area,data])=>`
        <button class="household-area-card" data-household-area="${esc(area)}">
          <span>${data.icon}</span>
          <b>${esc(area)}</b>
          <small>${data.tasks.length} Vorschläge</small>
        </button>
      `).join("")}
    </div>
  `;

  $$("[data-household-area]").forEach(b=>b.onclick=()=>renderHouseholdTasks(b.dataset.householdArea));
}

function renderHouseholdTasks(area){
  const data=householdTemplates[area];
  if(!data) return;

  $("#householdTitle").textContent=data.icon+" "+area;
  $("#householdIntro").innerHTML=`<button id="householdBack" class="household-back">← Bereiche</button>`;

  $("#householdContent").innerHTML=`
    <div class="household-task-list">
      ${data.tasks.map((task,index)=>`
        <button class="household-task-card" data-template-index="${index}">
          <div>
            <b>${esc(task.title)}</b>
            <small>${esc(task.rhythm||task.recurrence||"Nach Bedarf")}</small>
          </div>
          <span>＋</span>
        </button>
      `).join("")}
    </div>
  `;

  $("#householdBack").onclick=renderHouseholdAreas;

  $$("[data-template-index]").forEach(b=>b.onclick=()=>{
    const template=data.tasks[Number(b.dataset.templateIndex)];
    $("#householdDialog").close();

    openTaskEditor({
      title:template.title,
      area,
      due:today(),
      priority:"Normal",
      recurrence:template.recurrence||"Nein",
      reminder:template.recurrence&&template.recurrence!=="Nein"?"Am Fälligkeitstag":"Keine",
      rhythm:template.rhythm||"",
      templateKey:area+"|"+template.title
    });
  });
}

let shoppingHistoryOpen=false;
let scannerStream=null;
let scannerLoop=null;
let barcodeDraft=null;

function ensureShoppingExtras(){
  if($("#shoppingTools")) return;

  $("#shopForm").insertAdjacentHTML("afterend",`
    <div id="shoppingTools" class="shopping-tools">
      <button id="scanBarcode" class="shop-tool">▦ <span>Barcode scannen</span></button>
      <button id="addSavedProduct" class="shop-tool">＋ <span>Produkt speichern</span></button>
      <button id="toggleShopHistory" class="shop-tool">🕘 <span>Verlauf</span></button>
    </div>
  `);

  $("#shopList").insertAdjacentHTML("afterend",`
    <div id="shopHistoryPanel" class="shop-history hidden">
      <div class="section-head">
        <div>
          <span class="kicker">ZULETZT GEKAUFT</span>
          <h3>Verlauf</h3>
        </div>
      </div>
      <div id="shopHistory"></div>
    </div>
  `);

  const sub=$("#shopping .sub");
  sub.insertAdjacentHTML("afterend",`
    <p class="product-hint">Gespeicherte Produkte werden nach euren Käufen sortiert. Ein Tipp reicht und sie stehen wieder auf der Liste.</p>
  `);

  document.body.insertAdjacentHTML("beforeend",`
    <dialog id="barcodeDialog" class="scanner-dialog">
      <div class="dialog-head">
        <div>
          <span class="kicker">EINKAUF</span>
          <h3>Barcode scannen</h3>
        </div>
        <button class="close" id="closeBarcode">×</button>
      </div>

      <div class="scanner-box">
        <video id="barcodeVideo" playsinline muted></video>
        <div class="scanner-frame"></div>
        <div id="scannerMessage" class="scanner-message">Kamera noch nicht gestartet.</div>
      </div>

      <button id="startBarcodeCamera" class="primary wide">📷 Kamera starten</button>

      <form id="barcodeManualForm" class="barcode-manual">
        <label>Barcode alternativ eingeben
          <div class="barcode-input-row">
            <input id="barcodeManualInput" inputmode="numeric" autocomplete="off" placeholder="z. B. 4008400404127">
            <button class="pill" type="submit">Suchen</button>
          </div>
        </label>
      </form>

      <div id="barcodeResult"></div>
    </dialog>

    <dialog id="productDialog" class="product-dialog">
      <div class="dialog-head">
        <div>
          <span class="kicker">PRODUKTKARTE</span>
          <h3 id="productDialogTitle">Produkt speichern</h3>
        </div>
        <button class="close" id="closeProduct">×</button>
      </div>

      <form id="productForm">
        <input type="hidden" name="id">

        <div id="productImagePreview" class="product-image-preview">🛍️</div>

        <label>Produktname *
          <input name="name" required placeholder="z. B. Vollmilch 3,5 %">
        </label>

        <div class="form-two">
          <label>Marke
            <input name="brand" placeholder="z. B. ja!">
          </label>
          <label>Variante / Details
            <input name="details" placeholder="z. B. 1 Liter">
          </label>
        </div>

        <div class="form-two">
          <label>Bevorzugter Laden
            <select name="shop">
              <option value="">Nicht festgelegt</option>
              <option>dm</option>
              <option>REWE</option>
              <option>Aldi</option>
              <option>Lidl</option>
              <option>Edeka</option>
              <option>Rossmann</option>
              <option>Sonstiges</option>
            </select>
          </label>
          <label>Preis optional
            <input name="price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00">
          </label>
        </div>

        <label>Barcode
          <input name="barcode" inputmode="numeric" autocomplete="off">
        </label>

        <label>Bild-URL optional
          <input name="image" type="url" placeholder="https://...">
        </label>

        <button class="primary wide">Produkt speichern</button>
      </form>
    </dialog>
  `);

  $("#scanBarcode").onclick=()=>openBarcodeDialog();
  $("#addSavedProduct").onclick=()=>openProductEditor();
  $("#toggleShopHistory").onclick=()=>{
    shoppingHistoryOpen=!shoppingHistoryOpen;
    $("#shopHistoryPanel").classList.toggle("hidden",!shoppingHistoryOpen);
    $("#toggleShopHistory").classList.toggle("active",shoppingHistoryOpen);
  };

  $("#closeBarcode").onclick=()=>$("#barcodeDialog").close();
  $("#closeProduct").onclick=()=>$("#productDialog").close();
  $("#barcodeDialog").addEventListener("close",stopBarcodeCamera);
  $("#startBarcodeCamera").onclick=startBarcodeCamera;
  $("#barcodeManualForm").onsubmit=e=>{
    e.preventDefault();
    const code=$("#barcodeManualInput").value.trim();
    if(code) handleBarcode(code);
  };

  $("#productForm").addEventListener("input",e=>{
    if(e.target.name==="image") updateProductImagePreview(e.target.value);
  });

  $("#productForm").onsubmit=saveProductFromForm;
}

function formatMoney(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>0
    ? new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n)
    : "";
}

function productImage(p){
  if(p.image){
    return `<img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='🛍️'">`;
  }
  return `<span>🛍️</span>`;
}

function productMeta(p){
  const parts=[];
  if(p.shop) parts.push(p.shop);
  if(Number(p.price)>0) parts.push(formatMoney(p.price));
  if(p.barcode) parts.push("EAN "+p.barcode);
  return parts.join(" · ");
}

function cleanText(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function firstBrand(value){
  const text=cleanText(value);
  if(!text) return "";
  return text.split(",")[0].trim();
}

function buildProductDisplayName(product){
  const brand=cleanText(product.brand||product.brands||"");
  const brandShort=firstBrand(brand);
  let name=cleanText(product.name||product.product_name_de||product.product_name||"");
  let generic=cleanText(product.generic_name_de||product.generic_name||product.details||"");
  let quantity=cleanText(product.quantity||"");

  if(!name && generic) name=generic;
  if(!name && quantity) name=quantity;
  if(!name) name=brandShort || "Produkt";

  const lowName=name.toLowerCase();
  const lowBrand=brandShort.toLowerCase();

  if(brandShort && lowName===lowBrand){
    if(generic) name=brandShort+" – "+generic;
    else if(quantity) name=brandShort+" "+quantity;
    else name=brandShort;
  }

  if(brandShort && lowName!==lowBrand && !lowName.startsWith(lowBrand) && name.length<18 && generic && !generic.toLowerCase().includes(lowName)){
    name=name+" – "+generic;
  }

  if(!generic && quantity) generic=quantity;
  if(generic && quantity && !generic.toLowerCase().includes(quantity.toLowerCase())){
    generic=generic+" · "+quantity;
  }

  return {
    brand:brandShort || brand,
    name:cleanText(name),
    details:cleanText(generic)
  };
}

function linkedProduct(item){
  if(item.productId) return state.data.products.find(p=>p.id===item.productId) || null;
  return null;
}

function thumbMarkup(item){
  const product=linkedProduct(item);
  const image=(item.image||product?.image||"").trim();
  if(image){
    return `<div class="shopping-thumb"><img src="${esc(image)}" alt="" loading="lazy"></div>`;
  }
  return `<div class="shopping-thumb emoji">${item.productId?"🛍️":"📝"}</div>`;
}

function renderShopping(){
  const open=[...state.data.shopping]
    .filter(x=>!x.done)
    .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

  const history=[...state.data.shopping]
    .filter(x=>x.done)
    .sort((a,b)=>String(b.doneAt||"").localeCompare(String(a.doneAt||"")))
    .slice(0,30);

  $("#shopList").innerHTML=open.map(x=>`
    <div class="row shopping-row">
      <button class="check" data-shop-toggle="${x.id}" aria-label="Als gekauft markieren"></button>
      ${thumbMarkup(x)}
      <div class="grow">
        <b>${esc(x.title)}</b>
        ${x.brand?`<small>${esc(x.brand)}${x.details?" · "+esc(x.details):""}</small>`:""}
        ${x.shop?`<span class="shop-chip">${esc(x.shop)}</span>`:""}
      </div>
      <button class="shop-delete" data-shop-delete="${x.id}" title="Von Liste löschen">×</button>
    </div>
  `).join("")||`<div class="empty-state">🛒 Die Einkaufsliste ist leer.</div>`;

  $("#shopHistory").innerHTML=history.map(x=>{
    const when=x.doneAt
      ? new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(x.doneAt))
      : "";
    return `
      <div class="history-row">
        <div class="history-icon">✓</div>
        ${thumbMarkup(x)}
        <div class="grow">
          <b>${esc(x.title)}</b>
          <small>${esc(x.doneBy||"")} ${when?"· "+esc(when):""}</small>
        </div>
        <button class="pill" data-history-repeat="${x.id}">Nochmal</button>
      </div>`;
  }).join("")||`<div class="empty-state small-empty">Noch keine erledigten Einkäufe.</div>`;

  $$('[data-shop-toggle]').forEach(b=>b.onclick=()=>toggleShopping(b.dataset.shopToggle));
  $$('[data-shop-delete]').forEach(b=>b.onclick=()=>deleteShoppingItem(b.dataset.shopDelete));
  $$('[data-history-repeat]').forEach(b=>b.onclick=()=>repeatShoppingItem(b.dataset.historyRepeat));
}


async function toggleShopping(itemId){
  const x=state.data.shopping.find(t=>t.id===itemId);
  if(!x) return;

  // Bereits gekauft -> wieder zurück auf die offene Liste
  if(x.done){
    await save("shopping",{
      ...x,
      done:false,
      doneBy:null,
      doneAt:null
    });
    toast("Wieder auf der Einkaufsliste");
    return;
  }

  const doneAt=new Date().toISOString();

  await save("shopping",{
    ...x,
    done:true,
    doneBy:state.user,
    doneAt
  });

  // Bei gespeicherten Produkten die Kaufhäufigkeit erhöhen
  if(x.productId){
    const p=state.data.products.find(p=>p.id===x.productId);
    if(p){
      await save("products",{
        ...p,
        buyCount:Number(p.buyCount||0)+1,
        lastBoughtAt:doneAt,
        updatedBy:state.user,
        updatedAt:doneAt
      });
    }
  }

  toast("Als gekauft markiert");
}

async function deleteShoppingItem(itemId){
  const x=state.data.shopping.find(t=>t.id===itemId);
  if(!x) return;

  if(!confirm('"' + (x.title||"Artikel") + '" wirklich von der Einkaufsliste löschen?')) return;

  await remove("shopping",itemId);
  toast("Artikel gelöscht");
}

async function repeatShoppingItem(itemId){
  const x=state.data.shopping.find(t=>t.id===itemId);
  if(!x) return;

  const duplicate=state.data.shopping.some(s=>
    !s.done&&(
      (x.productId&&s.productId===x.productId)||
      (!x.productId&&String(s.title||"").toLowerCase()===String(x.title||"").toLowerCase())
    )
  );

  if(duplicate){
    toast("Steht schon auf der Liste");
    return;
  }

  await save("shopping",{
    id:id("s"),
    title:x.title||"Artikel",
    brand:x.brand||"",
    details:x.details||"",
    shop:x.shop||"",
    image:x.image||"",
    productId:x.productId||"",
    barcode:x.barcode||"",
    done:false,
    doneBy:null,
    doneAt:null,
    addedBy:state.user,
    createdAt:new Date().toISOString()
  });

  toast((x.title||"Artikel")+" wieder hinzugefügt");
}

function renderProducts(){
  const products=[...state.data.products]
    .sort((a,b)=>{
      const c=Number(b.buyCount||0)-Number(a.buyCount||0);
      if(c) return c;
      const l=String(b.lastBoughtAt||"").localeCompare(String(a.lastBoughtAt||""));
      if(l) return l;
      return String(a.name||"").localeCompare(String(b.name||""),"de");
    });

  $("#products").innerHTML=products.map(p=>`
    <article class="product-card">
      <div class="product-card-image">${productImage(p)}</div>
      <div class="product-card-body">
        ${p.brand?`<small class="product-brand">${esc(p.brand)}</small>`:""}
        <b>${esc(p.name||"Produkt")}</b>
        ${p.details?`<small class="product-details">${esc(p.details)}</small>`:""}
        ${productMeta(p)?`<small class="product-meta">${esc(productMeta(p))}</small>`:""}
        ${Number(p.buyCount||0)>0?`<span class="buy-count">Schon ${Number(p.buyCount)}× gekauft</span>`:""}
      </div>
      <div class="product-card-actions">
        <button class="primary" data-product-add="${p.id}">＋ Liste</button>
        <button class="pill" data-product-edit="${p.id}">Bearbeiten</button>
        <button class="product-delete" data-product-delete="${p.id}" title="Produkt löschen" aria-label="Produkt löschen">🗑️</button>
      </div>
    </article>
  `).join("")||`
    <div class="empty-state product-empty">
      Noch keine Produkte gespeichert.<br>
      <small>Barcode scannen oder „Produkt speichern“ wählen.</small>
    </div>`;

  $$('[data-product-add]').forEach(b=>b.onclick=()=>{
    const p=state.data.products.find(x=>x.id===b.dataset.productAdd);
    if(p)addProductToShopping(p);
  });

  $$('[data-product-edit]').forEach(b=>b.onclick=()=>{
    const p=state.data.products.find(x=>x.id===b.dataset.productEdit);
    if(p)openProductEditor(p);
  });

  $$('[data-product-delete]').forEach(b=>b.onclick=()=>{
    deleteProduct(b.dataset.productDelete);
  });
}


async function deleteProduct(productId){
  const p=state.data.products.find(x=>x.id===productId);
  if(!p) return;

  if(!confirm('Gespeichertes Produkt "'+(p.name||"Produkt")+'" wirklich löschen?')) return;

  await remove("products",productId);
  toast("Produkt gelöscht");
}

async function addProductToShopping(p){
  const display=buildProductDisplayName(p);
  const duplicate=state.data.shopping.some(s=>
    !s.done&&(
      (p.id&&s.productId===p.id)||
      String(s.title||"").toLowerCase()===String(display.name||"").toLowerCase()
    )
  );

  if(duplicate){
    toast(display.name+" steht schon auf der Liste");
    return;
  }

  await save("shopping",{
    id:id("s"),
    title:display.name||"Produkt",
    brand:display.brand||"",
    details:display.details||"",
    shop:p.shop||"",
    image:p.image||"",
    productId:p.id||"",
    barcode:p.barcode||"",
    done:false,
    addedBy:state.user,
    createdAt:new Date().toISOString()
  });

  toast(display.name+" hinzugefügt");
}

function openProductEditor(product={}){
  ensureShoppingExtras();
  const form=$("#productForm");

  form.elements.id.value=product.id||"";
  form.elements.name.value=product.name||"";
  form.elements.brand.value=product.brand||"";
  form.elements.details.value=product.details||"";
  form.elements.shop.value=product.shop||"";
  form.elements.price.value=Number(product.price)>0?Number(product.price):"";
  form.elements.barcode.value=product.barcode||"";
  form.elements.image.value=product.image||"";

  $("#productDialogTitle").textContent=product.id?"Produkt bearbeiten":"Produkt speichern";
  updateProductImagePreview(product.image||"");
  $("#productDialog").showModal();
}

function updateProductImagePreview(url){
  const box=$("#productImagePreview");
  if(url){
    box.innerHTML=`<img src="${esc(url)}" alt="Produktbild" onerror="this.parentElement.textContent='🛍️'">`;
  }else{
    box.textContent="🛍️";
  }
}

async function saveProductFromForm(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const barcode=String(f.get("barcode")||"").trim();
  const existingId=String(f.get("id")||"").trim();
  const byBarcode=barcode?state.data.products.find(p=>String(p.barcode||"")===barcode):null;
  const existing=state.data.products.find(p=>p.id===existingId)||byBarcode;

  const rawProduct={
    id:existing?.id||existingId||(barcode?"prod-"+barcode:id("p")),
    name:String(f.get("name")||"").trim(),
    brand:String(f.get("brand")||"").trim(),
    details:String(f.get("details")||"").trim(),
    shop:String(f.get("shop")||"").trim(),
    price:Number(f.get("price")||0),
    barcode,
    image:String(f.get("image")||"").trim(),
    buyCount:Number(existing?.buyCount||0),
    lastBoughtAt:existing?.lastBoughtAt||"",
    updatedBy:state.user,
    updatedAt:new Date().toISOString()
  };

  const display=buildProductDisplayName(rawProduct);
  const product={...rawProduct,name:display.name,brand:display.brand,details:rawProduct.details||display.details};

  if(!product.name) return;

  await save("products",product);
  $("#productDialog").close();
  toast("Produkt gespeichert");

  if($("#barcodeDialog").open){
    barcodeDraft=product;
    renderBarcodeResult(product,true);
  }
}

function openBarcodeDialog(){
  ensureShoppingExtras();
  barcodeDraft=null;
  $("#barcodeResult").innerHTML="";
  $("#barcodeManualInput").value="";
  $("#scannerMessage").textContent="Kamera noch nicht gestartet.";
  $("#barcodeDialog").showModal();
}

async function startBarcodeCamera(){
  stopBarcodeCamera();

  if(!navigator.mediaDevices?.getUserMedia){
    $("#scannerMessage").textContent="Kamera ist auf diesem Gerät nicht verfügbar. Barcode bitte unten eingeben.";
    return;
  }

  if(!("BarcodeDetector" in window)){
    $("#scannerMessage").textContent="Der automatische Barcode-Scanner wird von diesem Browser nicht unterstützt. Barcode bitte unten eingeben.";
    return;
  }

  try{
    const formats=["ean_13","ean_8","upc_a","upc_e","code_128"];
    const detector=new BarcodeDetector({formats});

    scannerStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},
      audio:false
    });

    const video=$("#barcodeVideo");
    video.srcObject=scannerStream;
    await video.play();
    $("#scannerMessage").textContent="Barcode in den Rahmen halten …";

    let busy=false;

    const scan=async()=>{
      if(!scannerStream||!$("#barcodeDialog").open) return;
      if(!busy){
        busy=true;
        try{
          const codes=await detector.detect(video);
          if(codes?.length){
            const code=String(codes[0].rawValue||"").trim();
            if(code){
              $("#barcodeManualInput").value=code;
              stopBarcodeCamera();
              await handleBarcode(code);
              return;
            }
          }
        }catch{}
        busy=false;
      }
      scannerLoop=requestAnimationFrame(scan);
    };

    scan();
  }catch(e){
    console.warn(e);
    $("#scannerMessage").textContent="Kamera konnte nicht gestartet werden. Barcode bitte unten eingeben.";
  }
}

function stopBarcodeCamera(){
  if(scannerLoop){
    cancelAnimationFrame(scannerLoop);
    scannerLoop=null;
  }
  if(scannerStream){
    scannerStream.getTracks().forEach(t=>t.stop());
    scannerStream=null;
  }
  const video=$("#barcodeVideo");
  if(video) video.srcObject=null;
}

async function handleBarcode(code){
  code=String(code||"").trim();
  if(!code) return;

  stopBarcodeCamera();
  $("#scannerMessage").textContent="Barcode erkannt: "+code;
  $("#barcodeResult").innerHTML=`<div class="barcode-loading">🔎 Produkt wird gesucht …</div>`;

  const known=state.data.products.find(p=>String(p.barcode||"")===code);
  if(known){
    barcodeDraft=known;
    renderBarcodeResult(known,true);
    return;
  }

  let draft={barcode:code,name:"",brand:"",details:"",shop:"",price:0,image:"",buyCount:0};

  try{
    const fields="code,product_name,product_name_de,generic_name,generic_name_de,brands,quantity,image_front_url,image_front_small_url";
    const response=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${fields}`);
    if(response.ok){
      const data=await response.json();
      if(data?.status===1&&data.product){
        const normalized=buildProductDisplayName({
          brand:data.product.brands||"",
          name:data.product.product_name_de||data.product.product_name||"",
          details:data.product.generic_name_de||data.product.generic_name||data.product.quantity||"",
          quantity:data.product.quantity||""
        });

        draft={
          ...draft,
          name:normalized.name||"",
          brand:normalized.brand||"",
          details:normalized.details||"",
          image:data.product.image_front_url||data.product.image_front_small_url||""
        };
      }
    }
  }catch(e){
    console.warn("Produktsuche nicht erreichbar.",e);
  }

  barcodeDraft=draft;
  renderBarcodeResult(draft,false);
}

function renderBarcodeResult(p,saved){
  const display=buildProductDisplayName(p);
  const product={...p,name:display.name,brand:display.brand,details:p.details||display.details};
  const hasName=!!String(product.name||"").trim();

  $("#barcodeResult").innerHTML=`
    <div class="barcode-product-card">
      <div class="barcode-product-image">${productImage(product)}</div>
      <div class="grow">
        <small>${saved?"Gespeichertes Produkt":hasName?"Produkt gefunden":"Noch unbekanntes Produkt"}</small>
        <b>${esc(product.name||"Produktdaten ergänzen")}</b>
        ${product.brand?`<span>${esc(product.brand)}</span>`:""}
        ${product.details?`<span>${esc(product.details)}</span>`:""}
        <span>EAN ${esc(product.barcode||"")}</span>
      </div>
    </div>
    <div class="barcode-actions">
      <button id="barcodeEditProduct" class="pill">${saved?"Bearbeiten":"Produktdaten ergänzen"}</button>
      ${hasName?`<button id="barcodeAddList" class="primary">＋ Auf Einkaufsliste</button>`:""}
    </div>
  `;

  $("#barcodeEditProduct").onclick=()=>openProductEditor(product);

  if($("#barcodeAddList")){
    $("#barcodeAddList").onclick=async()=>{
      let productToSave=product;

      if(!productToSave.id){
        productToSave={
          ...productToSave,
          id:productToSave.barcode?"prod-"+productToSave.barcode:id("p"),
          buyCount:Number(productToSave.buyCount||0),
          updatedBy:state.user,
          updatedAt:new Date().toISOString()
        };
        await save("products",productToSave);
      }

      await addProductToShopping(productToSave);
      $("#barcodeDialog").close();
    };
  }
}

function ensureCalendarExtras(){
  if($("#calendarOverview")) return;

  const legend=$("#calendar .legend");
  legend.insertAdjacentHTML("afterend",`
    <div id="calendarOverview" class="calendar-overview"></div>
    <div class="calendar-hint">Wiederkehrende Termine werden automatisch als nächste Vorkommen angezeigt. Bearbeiten oder Löschen wirkt auf die ganze Serie.</div>
  `);
}

function renderEvents(){
  ensureCalendarExtras();

  const occurrences=upcomingEventOccurrences(370);
  const todayCount=occurrences.filter(x=>x.date===today()).length;
  const weekCount=occurrences.filter(x=>x.date>=today()&&x.date<=addDaysToISO(today(),7)).length;
  const birthdayCount=occurrences.filter(x=>x.category==="Geburtstag"&&x.date<=addDaysToISO(today(),30)).length;

  $("#calendarOverview").innerHTML=`
    <div><b>${todayCount}</b><span>heute</span></div>
    <div><b>${weekCount}</b><span>7 Tage</span></div>
    <div><b>${birthdayCount}</b><span>Geburtstage 30 T.</span></div>
    <div><b>${occurrences.length}</b><span>kommende</span></div>
  `;

  if(!occurrences.length){
    $("#eventList").innerHTML=`<div class="empty-state">📅 Noch keine kommenden Termine.</div>`;
    return;
  }

  let html="";
  let month="";

  for(const x of occurrences.slice(0,100)){
    const currentMonth=x.date.slice(0,7);
    if(currentMonth!==month){
      month=currentMonth;
      html+=`<div class="calendar-month">${esc(formatMonthTitle(x.date))}</div>`;
    }

    const recurrence=eventRecurrenceLabel(x.recurrence||"Nein");
    const reminder=x.reminder&&x.reminder!=="Keine"?"🔔 "+x.reminder:"";
    const maps=x.location
      ? `<a class="event-map" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.location)}">📍 Maps</a>`
      : "";

    html+=`
      <article class="event-card person-${esc(x.person||"Familie")}">
        <div class="event-date-box">
          <strong>${dayNumber(x.date)}</strong>
          <span>${esc(monthShort(x.date))}</span>
        </div>

        <div class="event-main">
          <div class="event-topline">
            <div>
              <small class="event-day-label">${esc(eventDateLabel(x.date))}</small>
              <h4>${x.category==="Geburtstag"?"🎂 ":""}${esc(x.title)}</h4>
            </div>
            <span class="event-person">${esc(x.person||"Familie")}</span>
          </div>

          <div class="event-meta">
            ${x.time?`<span>🕒 ${esc(x.time)} Uhr</span>`:""}
            ${x.category?`<span>${esc(x.category)}</span>`:""}
            ${recurrence?`<span>${esc(recurrence)}</span>`:""}
            ${reminder?`<span>${esc(reminder)}</span>`:""}
          </div>

          ${x.location?`<div class="event-location">📍 ${esc(x.location)}</div>`:""}
          ${x.notes?`<div class="event-notes">${esc(x.notes)}</div>`:""}

          <div class="event-actions">
            ${maps}
            <button class="pill" data-event-edit="${esc(x.sourceId)}">Bearbeiten</button>
            <button class="event-delete" data-event-delete="${esc(x.sourceId)}" title="Termin löschen">🗑️</button>
          </div>
        </div>
      </article>
    `;
  }

  $("#eventList").innerHTML=html;

  $$('[data-event-edit]').forEach(b=>b.onclick=()=>openEventEditor(b.dataset.eventEdit));
  $$('[data-event-delete]').forEach(b=>b.onclick=()=>deleteEvent(b.dataset.eventDelete));
}

function eventFormHtml(event={}){
  const recurrence=event.recurrence||"Nein";
  const reminder=event.reminder||"Keine";

  const selectOptions=(values,current)=>values.map(v=>`<option ${v===current?"selected":""}>${v}</option>`).join("");

  return `
    <input type="hidden" name="kind" value="event">
    <input type="hidden" name="editId" value="${esc(event.id||"")}">

    <label>Termin *
      <input name="title" required value="${esc(event.title||"")}" placeholder="z. B. Kinderarzt">
    </label>

    <div class="form-two">
      <label>Datum *
        <input name="date" type="date" required value="${esc(event.date||today())}">
      </label>
      <label>Uhrzeit
        <input name="time" type="time" value="${esc(event.time||"")}">
      </label>
    </div>

    <div class="form-two">
      <label>Für wen?
        <select name="person">${selectOptions(["Dominic","Sabrina","Malia","Familie"],event.person||"Familie")}</select>
      </label>
      <label>Kategorie
        <select name="category">${selectOptions(["Familie","Malia","Geburtstag","Arzt","Kita","Freizeit","Sonstiges"],event.category||"Familie")}</select>
      </label>
    </div>

    <div class="form-two">
      <label>Wiederholung
        <select name="recurrence">${selectOptions(["Nein","Wöchentlich","Monatlich","Jährlich"],recurrence)}</select>
      </label>
      <label>Erinnerung
        <select name="reminder">${selectOptions(["Keine","Am selben Tag","1 Tag vorher","1 Woche vorher"],reminder)}</select>
      </label>
    </div>

    <label>Ort
      <input name="location" value="${esc(event.location||"")}" placeholder="Adresse oder Ort">
    </label>

    <label>Notiz
      <textarea name="notes" placeholder="Hinweise zum Termin …">${esc(event.notes||"")}</textarea>
    </label>

    <button class="primary wide">${event.id?"Änderungen speichern":"Termin speichern"}</button>
  `;
}

function openEventEditor(eventId=""){
  const event=eventId?state.data.events.find(x=>x.id===eventId)||{}:{};
  $("#quick").close();
  $("#editorTitle").textContent=event.id?"Termin bearbeiten":"Termin hinzufügen";
  $("#editorForm").innerHTML=eventFormHtml(event);
  $("#editor").showModal();
}

async function deleteEvent(eventId){
  const event=state.data.events.find(x=>x.id===eventId);
  if(!event) return;

  const series=event.recurrence&&event.recurrence!=="Nein";
  const question=series
    ? `Terminserie "${event.title}" wirklich komplett löschen?`
    : `Termin "${event.title}" wirklich löschen?`;

  if(!confirm(question)) return;

  await remove("events",eventId);
  toast(series?"Terminserie gelöscht":"Termin gelöscht");
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

  if(t==="task"){
    openTaskEditor();
    return;
  }

  if(t==="event"){
    openEventEditor();
    return;
  }

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

  if(t==="task"){
    const editId=String(d.get("editId")||"");
    const existing=editId?state.data.tasks.find(x=>x.id===editId):null;

    save("tasks",{
      ...(existing||{}),
      id:existing?.id||id("t"),
      title:String(d.get("title")||"").trim(),
      area:String(d.get("area")||""),
      templateKey:String(d.get("templateKey")||existing?.templateKey||""),
      due:d.get("due"),
      priority:d.get("priority"),
      recurrence:d.get("recurrence"),
      reminder:d.get("reminder"),
      done:existing?.done||false,
      doneBy:existing?.doneBy||null,
      doneAt:existing?.doneAt||null,
      createdBy:existing?.createdBy||state.user,
      createdAt:existing?.createdAt||new Date().toISOString(),
      updatedBy:state.user,
      updatedAt:new Date().toISOString()
    });
  }

  if(t==="event"){
    const editId=String(d.get("editId")||"");
    const existing=editId?state.data.events.find(x=>x.id===editId):null;
    const category=String(d.get("category")||"Familie");
    let recurrence=String(d.get("recurrence")||"Nein");

    // Geburtstage werden standardmäßig jährlich wiederholt.
    if(category==="Geburtstag"&&recurrence==="Nein") recurrence="Jährlich";

    save("events",{
      ...(existing||{}),
      id:existing?.id||id("e"),
      title:String(d.get("title")||"").trim(),
      date:d.get("date"),
      time:d.get("time"),
      person:d.get("person"),
      category,
      recurrence,
      reminder:d.get("reminder"),
      location:String(d.get("location")||"").trim(),
      notes:String(d.get("notes")||"").trim(),
      createdBy:existing?.createdBy||state.user,
      createdAt:existing?.createdAt||new Date().toISOString(),
      updatedBy:state.user,
      updatedAt:new Date().toISOString()
    });
  }

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

ensureShoppingExtras();
ensureHouseholdExtras();

$("#householdSuggestions").onclick=openHouseholdSuggestions;

load();
render();

// Firebase wird absichtlich erst NACH dem Aufbau der Oberfläche gestartet.
// Damit funktionieren Dominic / Sabrina / Familie auch dann sofort,
// wenn Firebase langsam ist oder kurzfristig nicht erreichbar ist.
initFirebase();

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js?v=9").catch(()=>{});
}
