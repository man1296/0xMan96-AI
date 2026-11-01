/* 0xMan96 AI UI reliability and readable-output fixes. */
(()=> {
"use strict";
const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function safeHref(value){
  try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}
}
function inlineMarkdown(value){
  let s=escapeHTML(value);
  s=s.replace(/\x60([^\x60]+)\x60/g,(_,code)=>"<code>"+code+"</code>");
  s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>{
    const href=safeHref(url);return href?'<a href="'+escapeHTML(href)+'" target="_blank" rel="noopener noreferrer">'+label+"</a>":label;
  });
  s=s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/__(.+?)__/g,"<strong>$1</strong>");
  s=s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,"<em>$1</em>").replace(/_([^_\n]+)_/g,"<em>$1</em>");
  return s;
}
function renderMarkdown(source){
  const lines=String(source??"").replace(/\r\n?/g,"\n").split("\n");
  const out=[];let paragraph=[],listType=null,listItems=[],quote=[],code=[],inCode=false,codeLang="";
  const flushParagraph=()=>{if(paragraph.length){out.push("<p>"+paragraph.map(inlineMarkdown).join("<br>")+"</p>");paragraph=[]}};
  const flushList=()=>{if(listItems.length){out.push("<"+listType+">"+listItems.map(x=>"<li>"+inlineMarkdown(x)+"</li>").join("")+"</"+listType+">");listItems=[];listType=null}};
  const flushQuote=()=>{if(quote.length){out.push("<blockquote>"+quote.map(x=>"<p>"+inlineMarkdown(x)+"</p>").join("")+"</blockquote>");quote=[]}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const fence=line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if(fence){
      flushParagraph();flushList();flushQuote();
      if(!inCode){inCode=true;codeLang=fence[1];code=[]}
      else{out.push('<pre><code'+(codeLang?' class="language-'+escapeHTML(codeLang)+'"':"")+'>'+escapeHTML(code.join("\n"))+"</code></pre>");inCode=false;codeLang=""}
      continue;
    }
    if(inCode){code.push(line);continue}
    if(!line.trim()){flushParagraph();flushList();flushQuote();continue}
    const heading=line.match(/^(#{1,6})\s+(.+)$/);
    if(heading){flushParagraph();flushList();flushQuote();const n=heading[1].length;out.push("<h"+n+">"+inlineMarkdown(heading[2])+"</h"+n+">");continue}
    const bullet=line.match(/^\s*[-*+]\s+(.+)$/),ordered=line.match(/^\s*\d+[.)]\s+(.+)$/);
    if(bullet||ordered){flushParagraph();flushQuote();const type=bullet?"ul":"ol";if(listType&&listType!==type)flushList();listType=type;listItems.push((bullet||ordered)[1]);continue}
    if(/^\s*>/.test(line)){flushParagraph();flushList();quote.push(line.replace(/^\s*>\s?/,""));continue}
    flushList();flushQuote();paragraph.push(line);
  }
  if(inCode)out.push("<pre><code>"+escapeHTML(code.join("\n"))+"</code></pre>");
  flushParagraph();flushList();flushQuote();
  return out.join("");
}
window.fmt=renderMarkdown;
window.renderChat=function(){
  renderHistory();
  const c=current();
  $("welcome").classList.toggle("hidden",!!(c&&c.messages.length));
  $("messages").innerHTML=c?c.messages.map(m=>'<div class="message '+(m.role==="user"?"user":"assistant")+'"><div class="msg-avatar">'+(m.role==="user"?"Y":"✳")+'</div><div class="msg-body"><div class="msg-meta">'+(m.role==="user"?"YOU":"0xMan96 AI")+' · '+new Date(m.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+'</div><div class="msg-content">'+renderMarkdown(m.content)+'</div></div></div>').join(""):"";
  $("messages").scrollTop=$("messages").scrollHeight;
};
function showAgentPanel(panel){
  panel.classList.remove("hidden");
  panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}
window.renderAgents=function(){
  const grid=$("agentGrid");
  grid.innerHTML=state.agents.map(a=>'<article class="agent-card"><div class="agent-symbol">✳</div><h3>'+escapeHTML(a.name)+'</h3><p>'+escapeHTML((a.instructions||"").slice(0,150))+'…</p><div class="agent-card-actions"><button class="run" type="button" data-run="'+escapeHTML(a.id)+'">Run agent ↗</button><button type="button" data-edit="'+escapeHTML(a.id)+'">Edit</button><button type="button" data-delete="'+escapeHTML(a.id)+'" '+(a.role!=="custom"?"disabled title=\"Built-in agents are protected\"":"")+'>Delete</button></div></article>').join("");
  grid.querySelectorAll("[data-run]").forEach(b=>b.addEventListener("click",()=>window.openRun(b.dataset.run)));
  grid.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>window.openEditor(b.dataset.edit)));
  grid.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{
    const agent=state.agents.find(a=>a.id===b.dataset.delete);
    if(!agent||agent.role!=="custom"){toast("Built-in agents cannot be deleted.");return}
    if(!confirm('Delete the custom agent "'+agent.name+'"?'))return;
    state.agents=state.agents.filter(a=>a.id!==agent.id);save();window.renderAgents();renderAgentSelect();
  }));
  renderAgentSelect();
};
window.openEditor=function(id=null){
  editingAgent=id;
  const a=state.agents.find(x=>x.id===id);
  if(id&&!a){toast("Agent not found. Refresh the workspace to restore built-in agents.");return}
  $("editorTitle").textContent=a?"Edit agent":"Create an agent";
  $("agentName").value=a?.name||"";
  $("agentInstructions").value=a?.instructions||"";
  $("agentEditor").classList.remove("hidden");$("agentRun").classList.add("hidden");
  showAgentPanel($("agentEditor"));$("agentName").focus({preventScroll:true});
};
window.openRun=function(id){
  activeAgent=state.agents.find(a=>a.id===id);
  if(!activeAgent){toast("Agent not found. Refresh the workspace and try again.");return}
  $("runAgentName").textContent=activeAgent.name;
  $("agentTask").value="";$("agentOutput").innerHTML="";
  $("agentRun").classList.remove("hidden");$("agentEditor").classList.add("hidden");
  showAgentPanel($("agentRun"));$("agentTask").focus({preventScroll:true});
};
window.runAgent=async function(){
  const task=$("agentTask").value.trim();
  if(!activeAgent)return toast("Select an agent first.");
  if(!task)return toast("Describe the task first.");
  if(!window.puter?.ai?.chat)return toast("Puter AI is unavailable. Check the connection and sign-in status.");
  const button=$("runAgentBtn"),output=$("agentOutput");
  button.disabled=true;output.textContent="Agent is working…";
  try{
    const answer=await runWithTools([{role:"user",content:task}],activeAgent);
    output.innerHTML=renderMarkdown(answer||"The model returned an empty response.");
  }catch(e){output.textContent="Agent error: "+(e?.message||String(e))}
  finally{button.disabled=false}
};
function restoreBuiltins(){
  for(const base of DEFAULT_AGENTS){
    if(!state.agents.some(a=>a.role===base.role))state.agents.push({...base,id:"agent-"+base.role});
  }
  save();window.renderAgents();
}
document.addEventListener("DOMContentLoaded",()=>{
  restoreBuiltins();
  $("runAgentBtn").onclick=window.runAgent;
  const menu=$("mobileMenu"),sidebar=$("sidebar");
  if(menu&&sidebar){
    menu.setAttribute("aria-label","Open navigation menu");
    menu.addEventListener("click",()=>menu.setAttribute("aria-expanded",String(sidebar.classList.contains("open"))));
    document.addEventListener("click",e=>{
      if(window.innerWidth<=620&&sidebar.classList.contains("open")&&!sidebar.contains(e.target)&&!menu.contains(e.target))sidebar.classList.remove("open");
    });
  }
});
})();
