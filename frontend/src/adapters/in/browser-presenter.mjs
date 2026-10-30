/** Adaptador de entrada: traduce decisiones de acceso a navegación y errores a DOM. */
export function browserPresenter(base) {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const login = denied => location.replace(new URL(`shared/login.html${denied ? '?access=denied' : ''}`, base));
  function fatal(error) {
    console.error('No se pudo iniciar el aplicativo:', error?.message);
    const box = document.createElement('main');
    box.style.cssText = 'padding:40px;max-width:650px;margin:auto;font-family:Arial';
    const title = document.createElement('h1'); title.textContent = 'No se pudo conectar';
    const message = document.createElement('p'); message.textContent = 'Revisa la conexión y la configuración de servicio remoto. No se han sustituido los datos por una simulación.';
    const retry = document.createElement('button'); retry.textContent = 'Reintentar'; retry.onclick = () => location.reload();
    const link = document.createElement('a'); link.href = new URL('shared/login.html',base); link.textContent = ' Volver al acceso';
    box.append(title,message,retry,link); document.body.replaceChildren(box);
  }
  return {escapeHTML, login, fatal, signedOut() { if (!location.pathname.endsWith('/login.html')) login(false); }};
}
