(function(){"use strict";
var API=((window.SENTINEL_CONFIG||{}).authApiUrl||"").replace(/\/+$/,""),$=function(id){return document.getElementById(id)},form=$("profile-form"),linksBox=$("links-list"),widgetsBox=$("widgets-list"),status=$("status"),saveStatus=$("save-status");
if (!form) return;
function say(el,text,error){el.textContent=text||"";el.classList.toggle("error",!!error)}
async function api(path,body){var r=await fetch(API+path,{method:body?"POST":"GET",credentials:"include",headers:body?{"Content-Type":"application/json","Accept":"application/json"}: {"Accept":"application/json"},body:body?JSON.stringify(body):undefined});if(r.status===204) return null;var j=null;try{j=await r.json()}catch(e){throw new Error("invalid json response")};if(!r.ok){var msg=(j&&j.error)||("http " + r.status);throw new Error(msg)};return j}
function val(name){return form.elements[name].value.trim()}
function addLink(link){link=link||{};if(linksBox.children.length>=12) return;var row=document.createElement("div");row.className="pe-row pe-link-row";var label=document.createElement("input");label.type="text";label.placeholder="Label";label.value=link.label||"";var url=document.createElement("input");url.type="text";url.placeholder="URL";url.value=link.url||"";row.appendChild(label);row.appendChild(url);linksBox.appendChild(row)}
function addWidget(widget){widget=widget||{};if(widgetsBox.children.length>=8) return;var card=document.createElement("div");card.className="pe-widget pe-widget-editor";widgetsBox.appendChild(card)}
function getLinks(){return Array.from(linksBox.querySelectorAll(".pe-link-row")).map(function(row){var i=row.querySelectorAll("input");return {label:i[0].value.trim(),url:i[1].value.trim()}}).filter(function(l){return l.url})}
function getWidgets(){return Array.from(widgetsBox.querySelectorAll(".pe-widget-editor")).map(function(card){return {type:card.querySelector("select").value,title:card.querySelectorAll("input")[0].value}})}
function setImage(el,url){if(el){if(url){el.src=url;el.classList.remove("pe-hide")}else{el.removeAttribute("src");el.classList.add("pe-hide")}}}
function getCustomization(){var names=["layout","cardStyle","contentWidth","bannerHeight","avatarShape","widgetColumns","alignment","spacing","pageColor","cardColor","textColor","mutedColor","borderRadius","cardOpacity"];var out={};names.forEach(function(n){var e=form.elements[n];if(!e) return; if(e.type==="checkbox") out[n]=!!e.checked; else out[n]=e.value});return out}
function applyCustomizationToForm(c){c=c||{};Object.keys(c).forEach(function(n){var el=form.elements[n];if(!el) return; if(el.type==="checkbox") el.checked=!!c[n]; else if(c[n]!==undefined) el.value=c[n]})}
function updateOutputs(){form.querySelectorAll("input[type=range]").forEach(function(el){var o=form.querySelector("[data-output=\""+el.name+"\"]"); if(o) o.textContent=el.value})}
function preview(){/* simplified preview omitted */}
function loadIntoEditor(profile,account){/* omitted for brevity in this small patch */}
var mediaAssets=[],selectedAudio=[];
function formatSize(n){return n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB"}
function mediaSay(text,error){var el=$("media-status"); if(el){el.textContent=text||""; el.classList.toggle("error",!!error)}}
function updateQuotas(counts){counts=counts||{};["image","audio","video"].forEach(function(k){var el=$("quota-"+k); if(el) el.textContent=(counts[k]||0)+" / "+({image:5,audio:3,video:3}[k])})}
function renderSelectedAudio(){var box=$("selected-audio-list"); if(!box) return; box.replaceChildren(); var selectedCount=$("audio-selected-count"); if(selectedCount) selectedCount.textContent=(selectedAudio.length||0)+" / 3"}
function assignAsset(a,role){if(!a) return; if(role==="avatar") form.elements.avatarUrl.value=a.url; else if(role==="banner") form.elements.bannerUrl.value=a.url; else if(role==="background") form.elements.backgroundUrl.value=a.url}
function renderMediaLibrary(){var box=$("media-library"); if(!box) return; box.replaceChildren(); if(!mediaAssets || !mediaAssets.length){var empty=document.createElement("div"); empty.className="media-empty"; empty.textContent="No media found."; box.appendChild(empty); return;} mediaAssets.forEach(function(a){ var wrap=document.createElement("div"); wrap.className="media-item"; var img=document.createElement("img"); img.setAttribute("alt",a.name||""); img.width=80; img.height=80; img.loading="lazy"; img.referrerPolicy="no-referrer"; img.src=a.url||""; img.dataset.fallback=(a.name||"").charAt(0).toUpperCase(); img.setAttribute("data-fallback",img.dataset.fallback); wrap.appendChild(img); var meta=document.createElement("div"); meta.className="media-meta"; meta.textContent=(a.kind||a.type||"").toUpperCase(); wrap.appendChild(meta); box.appendChild(wrap); })}

function normalizeAssetList(data){
  var list=[];
  if(!data) return list;
  if(Array.isArray(data)) list = data.filter(Boolean);
  else if(data.assets && Array.isArray(data.assets)) list = data.assets.filter(Boolean);
  else if(data.ok && (data.url || data.type || data.kind)){
    list = [{ id: data.id || null, url: data.url || "", kind: data.kind || data.type || "image", type: data.type || data.kind || "image", name: data.name || "" }];
  }
  return list.map(function(asset){ asset = asset || {}; asset.kind = asset.kind || asset.type || "image"; asset.type = asset.type || asset.kind || "image"; asset.url = asset.url || asset.src || ""; return asset; }).filter(Boolean);
}

async function refreshMedia(){
  try{
    var data = await api("/profiles/assets");
    mediaAssets = normalizeAssetList(data);
    updateQuotas((data && data.counts) || {});
    renderMediaLibrary();
    renderSelectedAudio();
  }catch(e){
    mediaSay((e && e.message) ? e.message : "Failed to load media assets.", true);
  }
}

var mediaFileInput = $("media-file");
if(mediaFileInput) mediaFileInput.addEventListener("change", async function(){
  var file = this.files && this.files[0]; if(!file) return;
  var btnText = "Uploading " + file.name + "…"; mediaSay(btnText);
  this.disabled = true;
  try{
    var fd = new FormData(); fd.append("file", file);
    var r = await fetch(API+"/profiles/assets/upload", { method: "POST", credentials: "include", body: fd, headers: { Accept: "application/json" } });
    var body = await r.json().catch(function(){return null});
    if(!r.ok) throw new Error((body && body.error) || (body && body.message) || ("http "+r.status));
    // Normalize and refresh listing so the UI shows the uploaded asset consistently
    await refreshMedia();
    mediaSay("Uploaded " + file.name);
  }catch(err){
    mediaSay((err && err.message) ? err.message : "Upload failed", true);
  }finally{
    this.disabled = false; this.value = "";
  }
});

var refreshMediaButton = $("refresh-media"); if(refreshMediaButton) refreshMediaButton.addEventListener("click", refreshMedia);

var categoryButtons = Array.from(document.querySelectorAll(".pe-category-btn"));
function showCategory(name){ categoryButtons.forEach(function(b){var active=b.dataset.category===name; b.classList.toggle("active", active);}); }

form.addEventListener("submit", async function(ev){ ev.preventDefault(); say(saveStatus,""); var button=$("save-profile"); button.disabled=true; button.textContent="Saving…"; try{ /* saving omitted for brevity */ }catch(e){ say(saveStatus, (e && e.message) ? e.message : "Save failed", true); } finally{ button.disabled=false; button.textContent="Save";} });

async function init(){ if(!API){ say(status, "Account API is not configured.", true); return } try{ var account = await api("/account/me"); if(!account.verified){ say(status, "Verify your email before publishing.", true); return } var profile = await api("/profiles/me"); loadIntoEditor(profile, account); await refreshMedia(); }catch(e){ say(status, (e && e.message) ? e.message : "Failed to load account/profile", true); }}

init();
})();
