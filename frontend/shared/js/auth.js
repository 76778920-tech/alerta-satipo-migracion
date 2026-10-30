const LoginModule = (() => {
  const B = window.SatipoBackend;
  const $ = selector => document.querySelector(selector);
  let recovery = false, busy = false;
  function message(text, error = false) {
    const output = $('#auth-status');
    output.textContent = text; output.hidden = !text; output.classList.toggle('error',error);
  }
  function setRecovery(value) {
    if (busy) return;
    recovery = value; message('');
    $('#password-field').hidden = value;
    $('#password').required = !value;
    $('#password').disabled = value;
    $('#password').type = 'password';
    $('#toggle-password').textContent = 'Mostrar';
    $('#toggle-password').setAttribute('aria-pressed','false');
    $('#toggle-password').setAttribute('aria-label','Mostrar contraseña');
    $('#recover-btn').hidden = value;
    $('#back-login').hidden = !value;
    $('#form-title').textContent = value ? 'Recupera tu acceso.' : 'Acceso administrativo.';
    $('#form-description').textContent = value ? 'Solicita un enlace para restablecer la contraseña de tu cuenta existente.' : 'Ingresa con las credenciales que te fueron asignadas.';
    $('#submit-label').textContent = value ? 'Enviar enlace de recuperación' : 'Ingresar al panel';
    document.title = `${value ? 'Recuperar acceso' : 'Acceso administrativo'} · Alerta Satipo`;
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const email = $('#email').value.trim().toLowerCase(), password = $('#password').value;
    busy = true; $('#submit-btn').disabled = true; $('#login-form').setAttribute('aria-busy','true');
    const label = $('#submit-label').textContent;
    $('#submit-label').textContent = 'Verificando…'; message('');
    try {
      if (!B.cloud) throw new Error('Este acceso requiere la conexión administrativa configurada.');
      if (recovery) {
        await B.recover(email);
        message('Si la cuenta existe, recibirás un enlace de recuperación. Esto no crea una cuenta ni concede permisos.');
        return;
      }
      await B.login({email,password});
      location.href = '../web/index.html';
    } catch(error) {
      const translations = {invalid_credentials:'Correo o contraseña incorrectos.',email_not_confirmed:'La cuenta debe estar confirmada para ingresar.',over_email_send_rate_limit:'Espera unos minutos antes de solicitar otro correo.',over_request_rate_limit:'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'};
      message(translations[error.code] || (error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message) || 'No se pudo conectar. Intenta otra vez.',true);
    } finally {
      busy = false; $('#submit-btn').disabled = false; $('#submit-label').textContent = label; $('#login-form').removeAttribute('aria-busy');
    }
  }
  async function init() {
    await B.ready;
    $('#login-form').addEventListener('submit',submit);
    $('#auth-mode').textContent = 'Solo personal autorizado';
    $('#recover-btn').onclick = () => {setRecovery(true);$('#email').focus();};
    $('#back-login').onclick = () => setRecovery(false);
    $('#toggle-password').onclick = () => {
      const visible = $('#password').type === 'password';
      $('#password').type = visible ? 'text' : 'password';
      $('#toggle-password').textContent = visible ? 'Ocultar' : 'Mostrar';
      $('#toggle-password').setAttribute('aria-pressed',String(visible));
      $('#toggle-password').setAttribute('aria-label',visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    };
    setRecovery(false);
    if (new URLSearchParams(location.search).get('access') === 'denied') message('Acceso denegado. Se requieren permisos de administrador.',true);
    $('#submit-btn').disabled = !B.cloud;
    if (!B.cloud) message('Configura servicio remoto para habilitar el acceso administrativo.',true);
  }
  return {init};
})();
LoginModule.init().catch(window.SatipoBackend.fatal);
