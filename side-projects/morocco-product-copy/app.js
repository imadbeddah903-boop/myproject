const SUPABASE_URL="https://oqhfvtdsagjktexwxbpl.supabase.co";
const SUPABASE_KEY="sb_publishable_bCHLZuGNNuxs3mhzsjLa5A_ZJqwtmlW";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let outputs={ar:"",fr:"",wa:"",fb:""},current="ar";

function value(id){return document.getElementById(id).value.trim()}

function setDbStatus(ok){
  const badge=document.getElementById("dbBadge");
  badge.textContent=ok?"Supabase ✓":"Mode local";
  badge.classList.toggle("ok",ok);
}

async function loadTemplates(){
  try{
    const {data,error}=await supabaseClient
      .from("product_copy_templates")
      .select("template_key,title,platform,description")
      .order("created_at",{ascending:true});
    if(error) throw error;
    setDbStatus(true);
    const box=document.getElementById("templates");
    box.innerHTML=(data||[]).map(t=>'<div class="template"><b>'+escapeHtml(t.title)+'</b><span>'+escapeHtml(t.description)+'</span></div>').join("");
    document.getElementById("status").textContent="تم الاتصال بـ Supabase وتحميل قوالب WasfPro ✓";
  }catch(error){
    setDbStatus(false);
    document.getElementById("status").textContent="التوليد المحلي يعمل؛ تعذر تحميل القوالب من Supabase.";
  }
}

function escapeHtml(text){
  return String(text??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function generate(){
 const name=value("name")||"منتج جديد";
 const price=value("price");
 const details=value("details")||"جودة مميزة وتصميم عملي";
 const category=value("category")||"منتج";
 const audience=value("audience")||"عام";
 const tone=value("tone")||"احترافي";
 const priceAr=price?"\\n💰 الثمن: "+price:"";
 const priceFr=price?"\\n💰 Prix : "+price:"";
 outputs.ar="🛍️ "+name+"\\n\\n"+name+" هو "+category+" مناسب لـ"+audience+".\\n\\n"+details+"\\n\\nأسلوب: "+tone+"\\n\\nمميزات المنتج: جودة، استعمال عملي وتصميم مناسب للاستعمال اليومي."+priceAr+"\\n🚚 التوصيل متوفر حسب المنطقة.\\n📩 تواصل معنا للطلب والاستفسار.";
 outputs.fr="🛍️ "+name+"\\n\\nDécouvrez "+name+", un "+category+" adapté à "+audience+".\\n\\n"+details+"\\n\\nStyle : "+tone+"."+priceFr+"\\n🚚 Livraison selon la région.\\n📩 Contactez-nous pour commander.";
 outputs.wa="🔥 "+name+"\\n\\n"+details+(price?"\\n💰 "+price:"")+"\\n\\n🚚 Livraison disponible.\\n📲 Pour commander, envoyez-nous un message sur WhatsApp.";
 outputs.fb="🛍️ "+name+"\\n\\n"+details+"\\n\\n✨ مناسب لـ"+audience+"\\n"+(price?"💰 "+price+"\\n":"")+"🚚 التوصيل متوفر حسب المنطقة.\\n📩 راسلنا للطلب والمزيد من المعلومات.";
 document.getElementById("result").classList.remove("hidden");
 showTab("ar");
 document.getElementById("status").textContent="تم إنشاء المحتوى بنجاح ✓";
}

function showTab(tab){
 current=tab;
 document.getElementById("preview").textContent=outputs[tab]||"";
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
}

async function copyText(){
 try{await navigator.clipboard.writeText(outputs[current]);document.getElementById("status").textContent="تم نسخ النص ✓"}
 catch(e){document.getElementById("status").textContent="حدد النص وانسخه يدوياً."}
}

function clearAll(){
 ["name","price","details"].forEach(id=>document.getElementById(id).value="");
 document.getElementById("result").classList.add("hidden");
 document.getElementById("status").textContent="";
}

document.getElementById("productForm").addEventListener("submit",e=>{e.preventDefault();generate()});
loadTemplates();
