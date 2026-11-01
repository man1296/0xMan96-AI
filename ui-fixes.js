/* Structural UI fixes: fixed mobile navigation and agent workspace layout. */
(()=>{"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const $=id=>document.getElementById(id);
 const sidebar=$("sidebar"),menu=$("mobileMenu");
 if(sidebar&&menu){
  menu.setAttribute("aria-label","Open navigation menu");
  let close=$("closeMobileMenu");
  if(!close){close=document.createElement("button");close.id="closeMobileMenu";close.type="button";close.className="sidebar-close";close.setAttribute("aria-label","Close navigation menu");close.textContent="×";sidebar.querySelector(".brand")?.append(close)}
  const hide=()=>{sidebar.classList.remove("open");menu.setAttribute("aria-expanded","false")};
  close.addEventListener("click",hide);
  menu.addEventListener("click",()=>{const open=sidebar.classList.toggle("open");menu.setAttribute("aria-expanded",String(open))});
  document.addEventListener("click",e=>{if(innerWidth<=900&&sidebar.classList.contains("open")&&!sidebar.contains(e.target)&&!menu.contains(e.target))hide()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});
 }
 const grid=$("agentGrid"),page=document.querySelector(".agents-page");
 if(grid&&page){const editor=$("agentEditor"),run=$("agentRun");if(editor)page.insertBefore(editor,grid);if(run)page.insertBefore(run,grid)}
});
})();