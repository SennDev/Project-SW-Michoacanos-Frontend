// Interacción mínima: resaltar comandos al hacer click para copiar
document.querySelectorAll<HTMLElement>('.code').forEach(block=>{
  block.style.position = 'relative';
  const btn = document.createElement('button');
  btn.textContent = 'Copiar comando';
  btn.style.cssText = 'position:absolute;right:10px;top:8px;background:#ffb86b;border:0;padding:6px 10px;border-radius:6px;cursor:pointer;color:#071026;font-weight:700';
  block.appendChild(btn);
  btn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    const text = block.textContent || '';
    try{
      await navigator.clipboard.writeText(text.trim());
      btn.textContent = 'Copiado ✓';
      setTimeout(()=> btn.textContent = 'Copiar comando', 1400);
    }catch{
      btn.textContent = 'Error';
      setTimeout(()=> btn.textContent = 'Copiar comando', 1400);
    }
  });
});
