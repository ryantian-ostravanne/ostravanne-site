// Sends the early-access form to the Google script and shows the result in place.
// Without this script the form still posts normally and the script answers with a thank-you page.
(function () {
  var form = document.getElementById('ea-form');
  if (!form || !window.fetch || !window.URLSearchParams || !window.FormData) return;
  var button = form.querySelector('.ea-submit');
  var status = document.getElementById('ea-status');
  var label = button.textContent;
  var FAILED = "That didn't go through. Try again, or email ryantian@ostravanne.com.";
  var busy = false;

  function fail() {
    status.textContent = FAILED;
    button.disabled = false;
    button.textContent = label;
    busy = false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    status.textContent = '';
    button.disabled = true;
    button.textContent = 'Sending…';
    var email = form.elements.email.value.trim();
    // URL-encoded body: a plain cross-site POST that Google Apps Script reads as e.parameter.
    var body = new URLSearchParams(new FormData(form));
    body.set('js', '1');
    fetch(form.action, { method: 'POST', body: body })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result || result.ok !== true) throw new Error('not saved');
        var done = document.createElement('p');
        done.className = 'ea-done';
        done.setAttribute('role', 'status');
        done.textContent = "You're on the list. We'll email " + email + " when you're in.";
        form.replaceWith(done);
      })
      .catch(fail);
  });
})();
