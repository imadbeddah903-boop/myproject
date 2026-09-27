const SUPABASE_URL="https://oqhfvtdsagjktexwxbpl.supabase.co";
const SUPABASE_KEY="sb_publishable_bCHLZuGNNuxs3mhzsjLa5A_ZJqwtmlW";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let places=[];

const labels={nature:"الطبيعة",adventure:"المغامرة",culture:"الثقافة",relaxation:"الاسترخاء"};
const icons={nature:"🌿",adventure:"🥾",culture:"🏛️",relaxation:"🌊"};
const travelModes={flight:"✈️ طائرة",car:"🚗 سيارة",train:"🚆 قطار",bus:"🚌 حافلة",ferry:"🚢 عبّارة / باخرة",mixed:"🔄 مختلط"};
const googleMode={car:"driving",train:"transit",bus:"transit",mixed:"transit"};

const moroccoDestinations=[
["طنجة","طنجة-تطوان-الحسيمة","culture","مدينة ساحلية بإطلالات على مضيق جبل طارق",350],
["شفشاون","طنجة-تطوان-الحسيمة","nature","جبال الريف والمدينة الزرقاء",300],
["الحسيمة","طنجة-تطوان-الحسيمة","relaxation","سواحل الريف وشواطئ المتوسط",400],
["وجدة","الشرق","culture","مدينة شرقية وتجربة حضرية محلية",280],
["السعيدية","الشرق","relaxation","شاطئ البحر المتوسط",350],
["فاس","فاس-مكناس","culture","المدينة العتيقة والأسواق والحرف",350],
["مكناس","فاس-مكناس","culture","تراث تاريخي وأسوار ومعالم",300],
["إفران","فاس-مكناس","nature","غابات الأطلس المتوسط وأجواء جبلية",350],
["الرباط","الرباط-سلا-القنيطرة","culture","العاصمة والمعالم الثقافية",350],
["القنيطرة","الرباط-سلا-القنيطرة","nature","مناطق طبيعية وقرب الساحل",280],
["أزيلال","بني ملال-خنيفرة","adventure","جبال وشلالات ومسارات طبيعية",400],
["بني ملال","بني ملال-خنيفرة","nature","جبال ومناطق خضراء",300],
["الدار البيضاء","الدار البيضاء-سطات","culture","واجهة بحرية وحياة حضرية",400],
["الجديدة","الدار البيضاء-سطات","relaxation","ساحل الأطلسي والمدينة البرتغالية",350],
["مراكش","مراكش-آسفي","culture","المدينة العتيقة والأسواق والساحات",450],
["الصويرة","مراكش-آسفي","relaxation","ساحل الأطلسي والمدينة القديمة",400],
["آسفي","مراكش-آسفي","relaxation","ساحل الأطلسي وتجربة محلية",320],
["ورزازات","درعة-تافيلالت","nature","بوابة الجنوب والقصبات",400],
["مرزوكة","درعة-تافيلالت","adventure","كثبان الصحراء وتجربة الجنوب الشرقي",450],
["وادي درعة","درعة-تافيلالت","nature","واحات ومناظر جنوبية",350],
["أكادير","سوس-ماسة","relaxation","شاطئ الأطلسي والواجهة البحرية",400],
["تارودانت","سوس-ماسة","culture","مدينة تاريخية وأسواق محلية",300],
["تيزنيت","سوس-ماسة","culture","تراث محلي وقرب الجنوب",300],
["سيدي إفني","كلميم-واد نون","relaxation","ساحل الأطلسي ومناظر صخرية",350],
["كلميم","كلميم-واد نون","nature","بوابة الجنوب ومناطق طبيعية",300],
["طرفاية","العيون-الساقية الحمراء","nature","ساحل الأطلسي ومناظر صحراوية",350],
["العيون","العيون-الساقية الحمراء","culture","مدينة جنوبية وتجربة محلية",350],
["الداخلة","الداخلة-وادي الذهب","adventure","بحيرة ومحيط وأنشطة بحرية",500]
];

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mapsUrl=name=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(name);
const mapsDir=(name,origin="",mode="")=>"https://www.google.com/maps/dir/?api=1"+(origin?"&origin="+encodeURIComponent(origin):"")+"&destination="+encodeURIComponent(name)+(mode?"&travelmode="+mode:"");

function mergePlaces(rows){
 const db=(rows||[]).map(p=>({...p,source:"db"}));
 const existing=new Set(db.map(p=>String(p.name).trim().toLowerCase()));
 const local=moroccoDestinations.filter(x=>!existing.has(x[0].toLowerCase())).map((x,i)=>({id:"local-"+i,name:x[0],region:x[1],category:x[2],description:x[3],estimated_daily_cost_dh:x[4],source:"local"}));
 return [...db,...local];
}

async function loadCountries(){
 try{
  const res=await fetch("https://restcountries.com/v3.1/all?fields=name");
  const data=await res.json();
  data.sort((a,b)=>(a.name.common||"").localeCompare(b.name.common||""));
  const options=data.map(c=>"<option value=\""+esc(c.name.common)+"\">"+esc(c.name.common)+"</option>").join("");
  document.querySelector("#country").innerHTML=options;
  document.querySelector("#startCountry").innerHTML=options;
  document.querySelector("#country").value="Spain";
  document.querySelector("#startCountry").value="Morocco";
 }catch(e){}
}

async function loadPlaces(){
 const {data,error}=await sb.from("trip_planner_places").select("*").order("name");
 places=mergePlaces(data||[]);
 document.querySelector("#dbBadge").textContent=error?"Mode hybride":"Supabase ✓ + اقتراحات";
 renderPlaces();
}

function renderPlaces(){
 document.querySelector("#places").innerHTML=places.map(p=>'<article class="place"><div class="placeTop"><span class="tag">'+icons[p.category]+' '+esc(labels[p.category]||p.category)+'</span><span class="region">'+esc(p.region)+'</span></div><h3>'+esc(p.name)+'</h3><p class="muted">'+esc(p.description)+'</p><strong>تقدير يومي: '+Number(p.estimated_daily_cost_dh||0).toLocaleString("ar-MA")+' DH</strong><div class="placeActions"><a target="_blank" rel="noopener" href="'+mapsUrl(p.name)+'">📍 Google Maps</a></div></article>').join("");
}

function routeInfo(){
 const sc=document.querySelector("#startCountry").value;
 const dc=document.querySelector("#country").value;
 const s=document.querySelector("#start").value.trim();
 const d=document.querySelector("#destination").value.trim();
 const mode=document.querySelector("#transport").value;
 const box=document.querySelector("#routeSummary");
 if(!s||!d){box.innerHTML='<div class="notice">دخل مدينة الانطلاق ومدينة الوجهة باش يظهر لك المسار.</div>';return;}
 const origin=s+", "+sc, dest=d+", "+dc;
 const url=mapsDir(dest,origin,googleMode[mode]||"");
 box.innerHTML='<div class="routeCard"><div><b>'+esc(origin)+' → '+esc(dest)+'</b><p class="muted">'+esc(travelModes[mode])+' • Google Maps يقدر يبيّن المسافة ووقت التنقل المتاح للمسار.</p></div><a class="mapAll" target="_blank" rel="noopener" href="'+url+'">🗺️ افتح المسار</a></div>';
}

function scorePlace(p,type,region,budgetPerDay){
 let score=0;
 if(p.category===type)score+=5;
 if(region&&p.region===region)score+=8;
 const cost=Number(p.estimated_daily_cost_dh||0);
 if(cost<=budgetPerDay)score+=3;
 score+=Math.max(0,2-Math.abs(cost-budgetPerDay)/250);
 return score;
}

function plan(){
 const d=Math.max(1,Math.min(30,+document.querySelector("#days").value||1));
 const b=Math.max(0,+document.querySelector("#budget").value||0);
 const n=Math.max(1,Math.min(20,+document.querySelector("#people").value||1));
 const type=document.querySelector("#type").value;
 const region=(document.querySelector("#region").value||"").trim();
 const start=(document.querySelector("#start").value||"").trim();
 const startCountry=document.querySelector("#startCountry").value;
 const country=document.querySelector("#country").value;
 const destination=(document.querySelector("#destination").value||"").trim();
 const subregion=(document.querySelector("#subregion").value||"").trim();
 const transport=document.querySelector("#transport").value;
 const budgetPerDay=b/d;
 const ranked=[...places].sort((a,z)=>scorePlace(z,type,region,budgetPerDay)-scorePlace(a,type,region,budgetPerDay));
 const chosen=region ? ranked.filter(p=>p.region===region).slice(0,Math.max(1,Math.min(d,8))) : ranked.slice(0,Math.max(1,Math.min(d,8)));
 const finalPlaces=chosen.length?chosen:ranked.slice(0,Math.max(1,Math.min(d,8)));
 const daily=Math.floor(b/d),perPersonDay=Math.floor(b/(n*d));
 let daysHtml="";
 for(let i=1;i<=d;i++){
  const p=finalPlaces[(i-1)%finalPlaces.length];
  daysHtml+='<div class="day"><div class="dayHead"><strong>اليوم '+i+'</strong><a target="_blank" rel="noopener" href="'+mapsDir(p.name,[start,startCountry].filter(Boolean).join(", "),googleMode[transport]||"")+'">🧭 افتح المسار</a></div><h3>'+icons[p.category]+' '+esc(p.name)+'</h3><div class="time">08:00–10:00 • فطور وتجهيز</div><div class="time">10:30–15:30 • '+esc(labels[p.category])+' واكتشاف '+esc(p.name)+'</div><div class="time">16:00–19:00 • وقت حر / نشاط إضافي</div><div class="time">20:00–22:00 • عشاء وراحة</div></div>';
 }
 const checklist=["وثائق السفر","هاتف وشاحن وبطارية إضافية","ماء واحتياجات الطريق","ملابس مناسبة للطقس","حذاء مريح","تأمين/وثائق السفر عند الحاجة","تأكد من متطلبات الدخول والتأشيرة حسب الدولة","تأكد من أسعار وأوقات النقل قبل السفر"];
 const target=destination?destination+", "+country:country;
 const origin=start?start+", "+startCountry:"";
 const r=document.querySelector("#result");r.hidden=false;
 r.innerHTML='<div class="resultHead"><div><span class="badge">خطة مخصصة</span><h2>'+esc(origin?origin+" → ":"")+esc(target)+'</h2><p class="muted">'+icons[type]+' '+esc(labels[type])+' • '+esc(travelModes[transport])+(subregion?" • "+esc(subregion):"")+'</p></div><a class="mapAll" target="_blank" rel="noopener" href="'+mapsDir(target,origin,googleMode[transport]||"")+'">🗺️ افتح المسار</a></div><div class="planGrid"><div class="stat"><b>'+d+'</b><br>أيام</div><div class="stat"><b>'+b.toLocaleString("ar-MA")+' DH</b><br>الميزانية</div><div class="stat"><b>'+n+'</b><br>أشخاص</div><div class="stat"><b>'+daily.toLocaleString("ar-MA")+' DH</b><br>تقريباً/اليوم</div><div class="stat"><b>'+perPersonDay.toLocaleString("ar-MA")+' DH</b><br>للشخص/اليوم</div></div><p class="notice">💡 الأسعار والتكاليف إرشادية وليست أسعار حجز. Google Maps يمكنه عرض المسافة ووقت التنقل للمسارات المدعومة.</p><h3>🗺️ المسار المقترح</h3>'+daysHtml+'<h3>🎒 Checklist</h3>'+checklist.map(x=>'<div class="check">☐ '+esc(x)+'</div>').join("")+'<div class="resultActions"><button onclick="window.print()">🖨️ طبع / حفظ PDF</button></div>';
 document.querySelector("#status").textContent="تم إنشاء خطة سفر عالمية حسب اختياراتك";
 r.scrollIntoView({behavior:"smooth",block:"start"});
 routeInfo();
}

document.querySelector("#planBtn").addEventListener("click",plan);
document.querySelector("#transport").addEventListener("change",routeInfo);
document.querySelector("#start").addEventListener("input",routeInfo);
document.querySelector("#destination").addEventListener("input",routeInfo);
document.querySelector("#country").addEventListener("change",routeInfo);
document.querySelector("#startCountry").addEventListener("change",routeInfo);
loadCountries();
loadPlaces();
routeInfo();
