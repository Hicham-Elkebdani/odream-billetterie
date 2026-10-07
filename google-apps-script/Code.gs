/**
 * Odream: passerelle de billets PDF vers l'adresse Gmail qui déploie le script.
 * Déployer "Exécuter en tant que : moi" et "Accès : tout le monde".
 * Dans Paramètres du projet > Propriétés du script, créer ODREAM_SHARED_SECRET.
 * Ne jamais copier le secret dans ce fichier ni dans le code React.
 */
function doPost(e) {
  var input;
  try { input = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (_) { return answer_({ok: false, error: 'Requête JSON invalide.'}); }

  var properties = PropertiesService.getScriptProperties();
  var expected = properties.getProperty('ODREAM_SHARED_SECRET');
  if (!expected || expected.length < 32 || !sameSecret_(String(input.secret || ''), expected)) {
    return answer_({ok: false, error: 'Autorisation refusée.'});
  }
  if (!/^ticket-[0-9a-f-]{36}-[0-9a-f-]{36}$/i.test(String(input.idempotencyKey || '')) ||
      !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(String(input.to || '')) ||
      typeof input.subject !== 'string' || input.subject.length > 200 ||
      typeof input.text !== 'string' || input.text.length > 5000 ||
      !/^Billet-OD-[A-Z0-9]{10}\.pdf$/.test(String(input.filename || '')) ||
      typeof input.pdfBase64 !== 'string' || input.pdfBase64.length > 8 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.pdfBase64)) {
    return answer_({ok: false, error: 'Paramètres du billet invalides.'});
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (_) { return answer_({ok: false, error: 'Service occupé, réessayez.'}); }
  try {
    var key = 'ODR_' + input.idempotencyKey;
    var state = properties.getProperty(key);
    if (state === 'sent') return answer_({ok: true, id: input.idempotencyKey});
    if (state === 'started') return answer_({ok: false, error: 'Envoi incertain : vérifiez les messages envoyés avant une nouvelle tentative.'});
    if (MailApp.getRemainingDailyQuota() < 1) return answer_({ok: false, error: 'Quota quotidien Google atteint.'});

    var bytes;
    try { bytes = Utilities.base64Decode(input.pdfBase64); }
    catch (_) { return answer_({ok: false, error: 'PDF invalide.'}); }
    if (bytes.length > 6 * 1024 * 1024 || bytes.length < 100 ||
        bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70) {
      return answer_({ok: false, error: 'Le PDF est invalide ou trop volumineux.'});
    }

    // Marquer avant l'appel : un échec réseau ambigu ne provoque pas un doublon automatique.
    properties.setProperty(key, 'started');
    try {
      MailApp.sendEmail({
        to: input.to,
        subject: input.subject,
        body: input.text,
        name: 'Organisation Odream',
        attachments: [Utilities.newBlob(bytes, 'application/pdf', input.filename)]
      });
    } catch (_) {
      return answer_({ok: false, error: 'Envoi incertain : vérifiez les messages envoyés et le journal Apps Script.'});
    }
    properties.setProperty(key, 'sent');
    return answer_({ok: true, id: input.idempotencyKey});
  } finally { lock.releaseLock(); }
}

// À exécuter UNE fois dans l'éditeur Google pour autoriser l'envoi sans envoyer d'email.
function verifierAutorisation() {
  Logger.log('Destinataires restants aujourd’hui : ' + MailApp.getRemainingDailyQuota());
}

function answer_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function sameSecret_(a, b) {
  var mismatch = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}
