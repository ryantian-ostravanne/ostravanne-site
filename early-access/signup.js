// The apply form. Step 1 asks for a work email (or "Continue with Google"); step 2, on the same panel,
// asks for name and company. It posts to the Google Apps Script in the form's action and shows the result
// in place. Without this script the form is a plain one that posts name, email and company, and the script
// answers with a thank-you page.
(function () {
  var form = document.getElementById('ea-form');
  if (!form || !window.fetch || !window.URLSearchParams || !window.FormData) return;

  var email = form.elements.email;
  var name = form.elements.name;
  var company = form.elements.company;
  var submit = form.querySelector('.ea-submit');
  var back = form.querySelector('.ap-back');
  var or = form.querySelector('.ap-or');
  var googleBox = form.querySelector('.ap-google');
  var status = document.getElementById('ea-status');
  var label = submit.textContent;
  var clientId = (form.getAttribute('data-google-client-id') || '').trim();
  var CONTACT = 'ryantian@ostravanne.com';
  var busy = false;
  var credential = ''; // the Google ID token, once someone continues with Google
  var typed = ''; // what was in the email field before Google filled it in

  form.noValidate = true; // each step checks its own fields
  form.setAttribute('data-step', '1');

  function fail() {
    busy = false;
    submit.disabled = false;
    submit.textContent = label;
    var link = document.createElement('a');
    link.href = 'mailto:' + CONTACT;
    link.textContent = CONTACT;
    status.textContent = '';
    status.append("That didn't go through. Try again, or email ", link, '.');
  }

  // Shows the browser's own message on the first field that isn't filled in right.
  function valid(fields) {
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) {
        fields[i].reportValidity();
        return false;
      }
    }
    return true;
  }

  function showStep(n) {
    form.setAttribute('data-step', String(n));
    email.readOnly = n === 2;
    back.hidden = n !== 2;
    status.textContent = '';
    if (n === 2) (name.value.trim() ? company : name).focus();
  }

  function continueWithEmail() {
    if (!valid([email])) return;
    credential = '';
    showStep(2);
  }

  form.querySelector('.ap-continue').addEventListener('click', continueWithEmail);

  back.addEventListener('click', function () {
    if (busy) return;
    if (credential) {
      credential = '';
      email.value = typed;
    }
    showStep(1);
    renderGoogle();
    email.focus();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;
    if (form.getAttribute('data-step') !== '2') {
      continueWithEmail(); // Enter in the email field
      return;
    }
    if (!valid([name, company])) return;
    var body;
    if (credential) {
      // The script takes the address from Google's token, so the typed one isn't sent.
      body = new URLSearchParams();
      body.set('google_credential', credential);
      body.set('name', name.value);
      body.set('company', company.value);
    } else {
      // URL-encoded: a plain cross-site POST that Google Apps Script reads as e.parameter.
      body = new URLSearchParams(new FormData(form));
    }
    body.set('js', '1');
    var address = email.value.trim();
    busy = true;
    status.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Sending…';
    fetch(form.action, { method: 'POST', body: body })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result || result.ok !== true) throw new Error('not saved');
        var done = document.createElement('p');
        done.className = 'ea-done';
        done.tabIndex = -1;
        done.textContent = "You're on the list. We'll email " + address + " when you're in.";
        form.replaceWith(done);
        done.focus();
      })
      .catch(fail);
  });

  // ---- Continue with Google (Google Identity Services), only when the page has a client ID

  // The ID token's claims. The page only reads them to fill in the form; the script checks the token with Google.
  function claims(token) {
    try {
      var part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      var raw = atob(part);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      return null;
    }
  }

  function signedIn(response) {
    if (busy) return;
    var who = claims(response && response.credential);
    if (!who || !who.email) {
      fail();
      return;
    }
    if (!credential) typed = email.value;
    credential = response.credential;
    email.value = who.email;
    if (!name.value.trim()) name.value = who.name || [who.given_name, who.family_name].filter(Boolean).join(' ');
    showStep(2);
  }

  var rendered = 0;
  // Google's button is drawn at a fixed width, so it's drawn to match the column, again if that changes.
  function renderGoogle() {
    if (googleBox.hidden || !googleBox.offsetWidth) return; // not loaded yet, or on step 2
    var width = Math.max(200, Math.min(400, Math.floor(googleBox.getBoundingClientRect().width)));
    if (width === rendered) return;
    rendered = width;
    googleBox.textContent = '';
    window.google.accounts.id.renderButton(googleBox, {
      type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular',
      logo_alignment: 'center', width: width,
    });
  }

  if (clientId) {
    var gsi = document.createElement('script');
    gsi.src = 'https://accounts.google.com/gsi/client';
    gsi.async = true;
    gsi.onload = function () {
      var id = window.google && window.google.accounts && window.google.accounts.id;
      if (!id) return;
      id.initialize({ client_id: clientId, callback: signedIn });
      or.hidden = false;
      googleBox.hidden = false;
      renderGoogle();
      var timer;
      window.addEventListener('resize', function () {
        clearTimeout(timer);
        timer = setTimeout(renderGoogle, 150);
      });
    };
    document.head.appendChild(gsi);
  }
})();
