let outputs={ar:"",fr:"",wa:"",fb:""},current="ar";

function value(id){return document.getElementById(id).value.trim()}

function generate(){
 const name=value("name")||"منتج جديد";
 const price=value("price");
 const details=value("details")||"جودة مميزة وتصميم عملي";
 const category=value("category")||"منتج";
 const audience=value("audience")||"عام";
 const tone=value("tone")||"احترافي";

 const priceAr=price?"\\n💰 الثمن: "+price:"";
 const priceFr=price?"\\n💰 Prix : "+price:"";
 outputs.ar="🛍️ "+name+"\\n\\n"+name+" هو "+category+" مناسب لـ"+audience+".\\n\\n"+details+"\\n\\nمميزات المنتج: جودة، استعمال عملي وتصميم مناسب للاستعمال اليومي."+priceAr+"\\n🚚 التوصيل متوفر حسب المنطقة.\\n📩 تواصل معنا للطلب والاستفسار.";
 outputs.fr="🛍️ "+name+"\\n\\nDécouvrez "+name+", un "+category+" adapté à "+audience+".\\n\\n"+details+"\\n\\nUn choix pratique avec une présentation claire et adaptée à un usage quotidien."+priceFr+"\\n🚚 Livraison selon la région.\\n📩 Contactez-nous pour commander.";
 outputs.wa="🔥 "+name+"\\n\\n"+details+(price?"\\n💰 "+price:"")+"\\n\\n🚚 Livraison disponible.\\n📲 Pour commander, envoyez-nous un message sur WhatsApp.";
 outputs.fb="🛍️ "+name+"\\n\\n"+details+"\\n\\n✨ مناسب لـ"+audience+"\\n"+(price?"💰 "+price+"\\n":"")+"🚚 التوصيل متوفر حسب المنطقة.\\n📩 راسلنا للطلب والمزيد من المعلومات.";
 document.getElementById("result").classList.remove("hidden");
 showTab("ar");
 document.getElementById("status").textContent="تم إنشاء المسودات بنجاح ✓";
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
