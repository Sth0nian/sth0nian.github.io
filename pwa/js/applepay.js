// Apple Pay lab: availability checks and a payment request that stops at
// merchant validation, since the lab has no merchant ID or server.
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const MERCHANT_ID = 'merchant.io.github.sth0nian.lab';

  function render() {
    const rows = [];
    const hasSession = 'ApplePaySession' in window;
    rows.push(['Payment Request API', 'PaymentRequest' in window ? 'Yes' : 'No']);
    rows.push(['ApplePaySession', hasSession ? 'Yes' : 'No']);
    if (hasSession) {
      let version = 0;
      for (let v = 1; v <= 20; v++) {
        try {
          if (ApplePaySession.supportsVersion(v)) version = v;
        } catch (error) {
          break;
        }
      }
      rows.push(['Highest API version', String(version)]);
      try {
        rows.push(['Can make payments', ApplePaySession.canMakePayments() ? 'Yes' : 'No (no card set up?)']);
      } catch (error) {
        rows.push(['Can make payments', error.message]);
      }
    }
    $('support').innerHTML = rows
      .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
      .join('');
    $('pay').hidden = !hasSession;
  }

  async function tryPayment() {
    if (!('PaymentRequest' in window)) return log('Payment Request is not available', 'error');
    const methods = [{
      supportedMethods: 'https://apple.com/apple-pay',
      data: {
        version: 3,
        merchantIdentifier: MERCHANT_ID,
        merchantCapabilities: ['supports3DS'],
        supportedNetworks: ['visa', 'masterCard', 'maestro'],
        countryCode: 'NL'
      }
    }];
    const details = { total: { label: 'PWA Lab test', amount: { currency: 'EUR', value: '0.01' } } };

    let request;
    try {
      request = new PaymentRequest(methods, details);
    } catch (error) {
      return log('PaymentRequest rejected the Apple Pay method: ' + error.message, 'error');
    }

    request.onmerchantvalidation = event => {
      log('Merchant validation requested by ' + (event.validationURL || 'Apple Pay') + '. This needs a merchant server, so the lab stops here.', 'warn');
      request.abort().catch(() => {});
    };

    try {
      const can = await request.canMakePayment();
      log('canMakePayment(): ' + can, can ? 'ok' : 'warn');
      log('Opening the payment sheet…');
      const response = await request.show();
      // Not expected without merchant validation, but finish cleanly if it happens
      await response.complete('fail');
      log('The sheet returned a response unexpectedly; marked as failed', 'warn');
    } catch (error) {
      log('Payment ended: ' + error.name + ' ' + error.message, error.name === 'AbortError' ? 'info' : 'error');
    }
  }

  $('pay').addEventListener('click', tryPayment);
  $('payFallback').addEventListener('click', tryPayment);
  render();
})();
