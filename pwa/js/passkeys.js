// Passkeys lab: client-only WebAuthn. Nothing verifies signatures, so this
// exercises the OS flows (Face ID, iCloud Keychain, autofill), not security.
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const STORE = 'lab-passkeys';
  let conditional = null;

  const random = n => crypto.getRandomValues(new Uint8Array(n));
  const toB64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = buffer => new TextDecoder().decode(buffer);

  function saved() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '[]');
    } catch (error) {
      return [];
    }
  }

  function renderCreds() {
    const creds = saved();
    $('creds').innerHTML = creds.length
      ? creds.map(c =>
        '<li><span class="feature-name">' + Lab.escape(c.name) +
        '<span class="feature-detail">' + Lab.escape(c.id.slice(0, 16)) + '… · ' +
        new Date(c.created).toLocaleString('en-GB') + '</span></span></li>'
      ).join('')
      : '<li class="muted small">None yet.</li>';
  }

  function signedIn(credential, how) {
    const id = credential.id;
    const known = saved().find(c => c.id === id);
    const handle = credential.response.userHandle ? decode(credential.response.userHandle) : null;
    const name = known ? known.name : handle ? handle.split(':')[0] : 'an unknown passkey';
    $('who').textContent = 'Hi, ' + name;
    log('Signed in as ' + name + ' via ' + how + (credential.authenticatorAttachment ? ' (' + credential.authenticatorAttachment + ' authenticator)' : ''), 'ok');
    const client = JSON.parse(decode(credential.response.clientDataJSON));
    log('clientData: type ' + client.type + ', origin ' + client.origin);
  }

  async function renderSupport() {
    const rows = [];
    const yes = v => v ? 'Yes' : 'No';
    const hasPkc = 'PublicKeyCredential' in window;
    rows.push(['WebAuthn', yes(hasPkc)]);
    if (hasPkc) {
      rows.push(['Face ID / Touch ID', yes(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())]);
      const cm = typeof PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
        await PublicKeyCredential.isConditionalMediationAvailable();
      rows.push(['Passkey autofill', yes(cm)]);
      if (typeof PublicKeyCredential.getClientCapabilities === 'function') {
        try {
          const caps = await PublicKeyCredential.getClientCapabilities();
          const on = Object.keys(caps).filter(k => caps[k]);
          rows.push(['Client capabilities', on.length + ' reported']);
          log('getClientCapabilities: ' + on.join(', '));
        } catch (error) {
          rows.push(['Client capabilities', 'Error']);
        }
      } else {
        rows.push(['Client capabilities', 'Not reported']);
      }
      rows.push(['Relying party', location.hostname]);
      if (cm) startConditional();
    }
    $('support').innerHTML = rows
      .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
      .join('');
    if (!hasPkc) ['register', 'signin'].forEach(id => { $(id).disabled = true; });
  }

  // Autofill: a pending request that resolves when a passkey is picked from the keyboard bar
  async function startConditional() {
    conditional = new AbortController();
    try {
      const credential = await navigator.credentials.get({
        mediation: 'conditional',
        publicKey: { challenge: random(32), userVerification: 'preferred' },
        signal: conditional.signal
      });
      if (credential) signedIn(credential, 'autofill');
    } catch (error) {
      if (error.name !== 'AbortError') log('Autofill request ended: ' + error.name + ' ' + error.message, 'warn');
    }
  }

  // Only one WebAuthn request can be pending, so cancel autofill before a modal one
  function stopConditional() {
    if (conditional) conditional.abort();
    conditional = null;
  }

  $('register').addEventListener('click', async () => {
    const name = $('username').value.trim() || 'lab-user';
    stopConditional();
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: random(32),
          rp: { name: 'PWA Lab' },
          user: {
            id: new TextEncoder().encode(name + ':' + toB64(random(8))),
            name,
            displayName: name + ' (PWA Lab)'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
          attestation: 'none',
          timeout: 60000
        }
      });
      const creds = saved();
      creds.push({ id: credential.id, name, created: Date.now() });
      localStorage.setItem(STORE, JSON.stringify(creds));
      const algorithm = credential.response.getPublicKeyAlgorithm ? credential.response.getPublicKeyAlgorithm() : '?';
      const transports = credential.response.getTransports ? credential.response.getTransports().join(', ') : '?';
      log('Passkey created for ' + name + ' (algorithm ' + algorithm + ', transports ' + transports + ')', 'ok');
      renderCreds();
    } catch (error) {
      log('Create failed: ' + error.name + ' ' + error.message, error.name === 'NotAllowedError' ? 'warn' : 'error');
    }
    startConditional();
  });

  $('signin').addEventListener('click', async () => {
    stopConditional();
    try {
      const credential = await navigator.credentials.get({
        publicKey: { challenge: random(32), userVerification: 'preferred', timeout: 60000 }
      });
      signedIn(credential, 'the passkey sheet');
    } catch (error) {
      log('Sign-in failed: ' + error.name + ' ' + error.message, error.name === 'NotAllowedError' ? 'warn' : 'error');
    }
    startConditional();
  });

  $('signout').addEventListener('click', () => {
    $('who').textContent = 'Signed out';
    log('Signed out');
  });

  $('forget').addEventListener('click', () => {
    localStorage.removeItem(STORE);
    renderCreds();
    log('Forgot the local list. The passkeys themselves stay in your keychain.', 'warn');
  });

  renderCreds();
  renderSupport();
})();
