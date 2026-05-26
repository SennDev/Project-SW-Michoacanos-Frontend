// Pequeña interacción: copiar snippet al portapapeles
const codeBlocks = Array.from(document.querySelectorAll<HTMLPreElement>('.code'));
codeBlocks.forEach(block=>{
  const btn = document.createElement('button');
  btn.textContent = 'Copiar';
  btn.style.cssText = 'float:right;margin-top:-28px;background:#0ea5e9;color:white;border:0;padding:6px 10px;border-radius:6px;cursor:pointer';
  block.parentElement!.insertBefore(btn, block);
  btn.addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(block.textContent || '');
      btn.textContent = 'Copiado ✓';
      setTimeout(()=> btn.textContent = 'Copiar', 1600);
    }catch{
      btn.textContent = 'Error';
      setTimeout(()=> btn.textContent = 'Copiar', 1600);
    }
  });
});
