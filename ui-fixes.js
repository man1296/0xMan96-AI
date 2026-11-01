/* Mobile navigation controls. Agent layout is authored directly in index.html. */
(()=>{"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const sidebar=document.getElementById("sidebar"),menu=document.getElementById("mobileMenu");
 if(!sidebar||!menu)return;
 menu.setAttribute("aria-label","Open navigation menu");menu.setAttribute("aria-controls","sidebar");menu.setAttribute("aria-expanded","false");
 let close=document.getElementById("closeMobileMenu");
 if(!close){close=document.createElement("button");close.id="closeMobileMenu";close.type="button";close.className="sidebar-close";close.setAttribute("aria-label","Close navigation menu");close.textContent="×";sidebar.querySelector(".brand")?.append(close)}
 const hide=()=>{sidebar.classList.remove("open");menu.setAttribute("aria-expanded","false")};
 close.addEventListener("click",hide);
 menu.addEventListener("click",()=>{const open=sidebar.classList.toggle("open");menu.setAttribute("aria-expanded",String(open))});
 sidebar.querySelectorAll(".nav-item").forEach(item=>item.addEventListener("click",hide));
 document.addEventListener("click",e=>{if(window.innerWidth<=900&&sidebar.classList.contains("open")&&!sidebar.contains(e.target)&&!menu.contains(e.target))hide()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});
});
})();