// communications.js — weekly digest broadcast + per-parent quick contact.
import { getParents, subscribe } from '../data.js';
import { buildWeeklyUpdateText, getAllParentEmails, mailtoLink, smsLink, copyToClipboard } from '../messaging.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Communications</h2>
    <section class="weekly-update">
      <h3>Weekly Update</h3>
      <pre id="weekly-update-preview"></pre>
      <a id="email-all-btn" class="btn-link"></a>
      <button type="button" id="copy-update-btn">Copy Message</button>
      <span id="copy-feedback"></span>
    </section>
    <section class="contacts-section">
      <h3>Parent Contacts</h3>
      <div class="table-scroll">
        <table class="contacts-table">
          <thead><tr><th>Name</th><th></th><th></th></tr></thead>
          <tbody id="contacts-body"></tbody>
        </table>
      </div>
    </section>
  `;

  const preview = container.querySelector('#weekly-update-preview');
  const emailAllBtn = container.querySelector('#email-all-btn');
  const copyBtn = container.querySelector('#copy-update-btn');
  const feedback = container.querySelector('#copy-feedback');
  const contactsBody = container.querySelector('#contacts-body');

  function renderWeeklyUpdate() {
    const text = buildWeeklyUpdateText();
    preview.textContent = text;              // textContent — no escaping needed, no injection risk

    const emails = getAllParentEmails();
    emailAllBtn.href = mailtoLink(emails, 'Weekly Practice & Snack Schedule', text);
    emailAllBtn.classList.toggle('disabled', emails.length === 0);
    emailAllBtn.textContent = emails.length
      ? `Email All Parents (${emails.length})`
      : 'Email All Parents (no parent emails on file)';
  }

  function renderContacts() {
    const parents = getParents();
    const text = buildWeeklyUpdateText();
    contactsBody.innerHTML = parents.map(p => `
      <tr>
        <td><div class="name-display">${escapeHtml(p.name)}</div></td>
        <td>${p.email ? `<a href="${escapeHtml(mailtoLink(p.email, 'Weekly Practice & Snack Schedule', text))}">Email</a>` : '—'}</td>
        <td>${p.phone ? `<a href="${escapeHtml(smsLink(p.phone, text))}">Text</a>` : '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="3">No parents yet.</td></tr>';
  }

  function render() {
    renderWeeklyUpdate();
    renderContacts();
  }

  copyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(buildWeeklyUpdateText());
    feedback.textContent = ok ? 'Copied!' : 'Copy failed — select the text above and copy manually.';
    setTimeout(() => { feedback.textContent = ''; }, 3000);
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
