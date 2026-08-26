import type { EmailTemplate, EmailTemplateKey } from './types'

const baseUrl = process.env.APP_PUBLIC_URL || 'https://web.webdo24.cz'
const appUrl = process.env.APP_URL || 'https://login.webdo24.cz'

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #0F172A; padding: 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 32px; color: #334155; font-size: 16px; line-height: 1.6; }
    .content p { margin: 0 0 16px; }
    .btn { display: inline-block; margin: 16px 0; padding: 14px 24px; background: #0F172A; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; }
    .box { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .footer { padding: 24px 32px; text-align: center; font-size: 13px; color: #94a3b8; }
    .footer a { color: #64748b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>WEBDO24</h1></div>
    <div class="content">${body}</div>
    <div class="footer">
      Tento email jste obdrželi, protože máte aktivní službu WEBDO24.<br>
      <a href="${appUrl}/nastaveni">Nastavení oznámení</a> · <a href="${baseUrl}">Váš web</a>
    </div>
  </div>
</body>
</html>`
}

function stripHtml(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const templates: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    key: 'welcome',
    subject: 'Vítejte ve WEBDO24',
    html: (d) => layout('Vítejte ve WEBDO24', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>vítejte ve WEBDO24. Vaše přihlašovací údaje máte v pořádku a můžete se kdykoliv přihlásit do svého backendu.</p>
      <a href="${appUrl}/dashboard" class="btn">Přejít do backendu</a>
      <p>Pokud budete potřebovat cokoliv upravit na webu, napište nám to přes sekci <strong>Požadavky</strong>.</p>
    `),
    text: (d) => stripHtml(templates.welcome.html(d)),
  },

  change_request_received: {
    key: 'change_request_received',
    subject: 'Obdrželi jsme váš požadavek na úpravu webu',
    html: (d) => layout('Požadavek přijat', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>právě jsme obdrželi váš požadavek na úpravu webu:</p>
      <div class="box">${d.rawInput}</div>
      <p>Naše AI ho nyní analyzuje a připraví návrh změn. Jakmile bude návrh hotový, dáme vědět e-mailem a v backendu ho uvidíte ke schválení.</p>
      <a href="${appUrl}/pozadavky/${d.changeRequestId}" class="btn">Sledovat stav</a>
    `),
    text: (d) => stripHtml(templates.change_request_received.html(d)),
  },

  change_request_preview_ready: {
    key: 'change_request_preview_ready',
    subject: 'Návrh úprav webu je připraven ke schválení',
    html: (d) => layout('Návrh připraven', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>váš požadavek <strong>"${d.rawInput}"</strong> je připravený ke schválení.</p>
      <p>Podívejte se na náhled v backendu. Pokud se vám změny líbí, klikněte na <strong>Schválit a publikovat</strong>.</p>
      <a href="${appUrl}/pozadavky/${d.changeRequestId}" class="btn">Zobrazit náhled</a>
    `),
    text: (d) => stripHtml(templates.change_request_preview_ready.html(d)),
  },

  change_published: {
    key: 'change_published',
    subject: 'Změny na webu byly publikovány',
    html: (d) => layout('Změny publikovány', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>váš požadavek <strong>"${d.rawInput}"</strong> byl schválen a změny jsou nyní živě na vašem webu.</p>
      <a href="${d.websiteUrl || baseUrl}" class="btn">Zobrazit web</a>
    `),
    text: (d) => stripHtml(templates.change_published.html(d)),
  },

  change_rejected: {
    key: 'change_rejected',
    subject: 'Požadavek na úpravu webu byl zrušen',
    html: (d) => layout('Požadavek zrušen', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>požadavek <strong>"${d.rawInput}"</strong> byl zrušen. ${d.reason ? `Důvod: ${d.reason}` : ''}</p>
      <p>Pokud chcete úpravu znovu navrhnout, napište nám to v backendu.</p>
      <a href="${appUrl}/pozadavky" class="btn">Nový požadavek</a>
    `),
    text: (d) => stripHtml(templates.change_rejected.html(d)),
  },

  payment_success: {
    key: 'payment_success',
    subject: 'Platba proběhla úspěšně',
    html: (d) => layout('Platba úspěšná', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>potvrzujeme úspěšnou platbu za službu <strong>${d.productName || 'WEBDO24'}</strong>.</p>
      <div class="box">
        Částka: <strong>${d.amount} ${d.currency}</strong><br>
        Datum: ${new Date().toLocaleDateString('cs-CZ')}
      </div>
      <p>Děkujeme za důvěru.</p>
      <a href="${appUrl}/nastaveni" class="btn">Spravovat služby</a>
    `),
    text: (d) => stripHtml(templates.payment_success.html(d)),
  },

  payment_failed: {
    key: 'payment_failed',
    subject: 'Platbu se nepodařilo zpracovat',
    html: (d) => layout('Platba selhala', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>platbu za <strong>${d.productName || 'službu WEBDO24'}</strong> se nepodařilo zpracovat.</p>
      <p>Můžete to zkusit znovu v backendu. Případně nás kontaktujte, rádi pomůžeme.</p>
      <a href="${appUrl}/nastaveni" class="btn">Zkusit znovu</a>
    `),
    text: (d) => stripHtml(templates.payment_failed.html(d)),
  },

  new_lead: {
    key: 'new_lead',
    subject: 'Máte novou poptávku',
    html: (d) => layout('Nová poptávka', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>právě vám přišla nová poptávka z webu:</p>
      <div class="box">
        <strong>${d.leadName}</strong><br>
        ${d.leadEmail ? `Email: ${d.leadEmail}<br>` : ''}
        ${d.leadPhone ? `Telefon: ${d.leadPhone}<br>` : ''}
        <p style="margin:12px 0 0">${d.leadMessage}</p>
      </div>
      <a href="${appUrl}/zpravy/${d.leadId}" class="btn">Odpovědět</a>
    `),
    text: (d) => stripHtml(templates.new_lead.html(d)),
  },

  lead_reply: {
    key: 'lead_reply',
    subject: 'Děkujeme za vaši poptávku',
    html: (d) => layout('Děkujeme za vaši poptávku', `
      <p>Dobrý den${d.leadName ? `, <strong>${d.leadName}</strong>` : ''},</p>
      <p>děkujeme za vaši poptávku z webu ${d.companyName || ''}.</p>
      <div class="box">
        ${String(d.reply || '').split('\n').map((line) => `<p style="margin:0 0 8px">${line}</p>`).join('')}
      </div>
      <p>Budeme se vám ozývat s konkrétní nabídkou co nejdříve.</p>
    `),
    text: (d) => stripHtml(templates.lead_reply.html(d)),
  },

  invoice_created: {
    key: 'invoice_created',
    subject: 'Byla vytvořena nová faktura',
    html: (d) => layout('Nová faktura', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>byla vytvořena nová faktura za <strong>${d.amount} ${d.currency}</strong>.</p>
      <p>Prosíme o její úhradu do data splatnosti.</p>
      <a href="${appUrl}/nastaveni" class="btn">Zaplatit fakturu</a>
    `),
    text: (d) => stripHtml(templates.invoice_created.html(d)),
  },

  invoice_paid: {
    key: 'invoice_paid',
    subject: 'Faktura byla uhrazena',
    html: (d) => layout('Faktura uhrazena', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>potvrzujeme přijetí platby za fakturu <strong>${d.amount} ${d.currency}</strong>.</p>
      <p>Děkujeme.</p>
    `),
    text: (d) => stripHtml(templates.invoice_paid.html(d)),
  },

  hosting_expiring_soon: {
    key: 'hosting_expiring_soon',
    subject: 'Hosting vašeho webu brzy vyprší',
    html: (d) => layout('Hosting brzy vyprší', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>dovolujeme si připomenout, že <strong>hosting vašeho webu vyprší za ${d.daysLeft || '30'} dní</strong> — ${d.expiryDate || 'brzy'}.</p>
      <div class="box">
        <strong>Roční hosting WEBDO24 — 2 490 Kč/rok</strong><br>
        ✓ Garance dostupnosti 99.9 %<br>
        ✓ SSL certifikát zdarma<br>
        ✓ Denní zálohy<br>
        ✓ Technická podpora
      </div>
      <p>Pro zachování vašeho webu online si prosím obnovte hosting včas.</p>
      <a href="${appUrl}/fakturace" class="btn">Obnovit hosting</a>
      <p style="margin-top:16px;font-size:14px;color:#94a3b8">
        Jako bonus můžete přidat <strong>Maintenance balíček za 4 900 Kč/rok</strong> — průběžné úpravy textů, aktualizace a technická podpora.
      </p>
    `),
    text: (d) => stripHtml(templates.hosting_expiring_soon.html(d)),
  },

  hosting_expired: {
    key: 'hosting_expired',
    subject: '⚠️ Hosting vašeho webu vypršel',
    html: (d) => layout('Hosting vypršel', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p><strong>Hosting vašeho webu právě vypršel</strong> (${d.expiryDate || 'dnes'}).</p>
      <p>Váš web je stále online, ale doporučujeme hosting obnovit co nejdříve, aby nedošlo k přerušení služby.</p>
      <div class="box">
        <strong>Roční hosting WEBDO24 — 2 490 Kč/rok</strong>
      </div>
      <a href="${appUrl}/fakturace" class="btn">Obnovit hosting</a>
      <p style="margin-top:16px;font-size:14px;color:#94a3b8">
        Potřebujete poradit? Napište nám na <a href="mailto:info@webdo24.cz">info@webdo24.cz</a>.
      </p>
    `),
    text: (d) => stripHtml(templates.hosting_expired.html(d)),
  },

  hosting_renewed: {
    key: 'hosting_renewed',
    subject: 'Hosting byl úspěšně obnoven',
    html: (d) => layout('Hosting obnoven', `
      <p>Ahoj ${d.customerName || 'uživateli'},</p>
      <p>děkujeme! <strong>Váš hosting byl úspěšně obnoven</strong> na další rok.</p>
      <div class="box">
        Služba: <strong>${d.productName || 'Hosting WEBDO24'}</strong><br>
        Částka: <strong>${d.amount || '2 490'} ${d.currency || 'CZK'}</strong><br>
        Platnost do: ${d.nextExpiry || 'za 365 dní'}
      </div>
      <p>Váš web běží bez přerušení. V případě jakýchkoliv dotazů jsme tu pro vás.</p>
      <a href="${appUrl}/dashboard" class="btn">Přejít do dashboardu</a>
    `),
    text: (d) => stripHtml(templates.hosting_renewed.html(d)),
  },
}

export function getTemplate(key: EmailTemplateKey): EmailTemplate {
  const template = templates[key]
  if (!template) throw new Error(`Unknown email template: ${key}`)
  return template
}
