// ============================================
// HTML šablona nabídky (odesílá se mailem)
// ============================================

import type { Quote } from '@/lib/actions/sales'

const fmt = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n)

export function quoteTotals(quote: Pick<Quote, 'items' | 'vat_rate'>) {
  const subtotal = (quote.items || []).reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.unit_price || 0), 0)
  const vatRate = Number(quote.vat_rate || 0)
  const vat = subtotal * (vatRate / 100)
  const total = subtotal + vat
  return { subtotal, vat, total, vatRate }
}

export function quoteToHtml(input: { quote: Quote; companyName: string }): string {
  const { quote, companyName } = input
  const { subtotal, vat, total, vatRate } = quoteTotals(quote)

  const rows = (quote.items || [])
    .map(
      (it, i) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eef2f7;color:#334155;font-size:14px">${i + 1}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(it.name)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eef2f7;color:#334155;font-size:14px;text-align:right">${it.qty}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eef2f7;color:#334155;font-size:14px;text-align:right">${fmt(Number(it.unit_price))}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;font-weight:700;text-align:right">${fmt(Number(it.qty) * Number(it.unit_price))}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="cs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#0d1525,#0f2440);padding:36px 40px;">
      <div style="font-size:12px;color:#67e8f9;text-transform:uppercase;letter-spacing:.15em;font-weight:700;">${escapeHtml(companyName)}</div>
      <div style="font-size:26px;color:#fff;font-weight:800;margin-top:6px;">${escapeHtml(quote.title)}</div>
      ${quote.number ? `<div style="font-size:13px;color:#94a3b8;margin-top:4px;">${escapeHtml(quote.number)}</div>` : ''}
    </div>
    <div style="padding:32px 40px;">
      ${quote.client_name ? `<p style="margin:0 0 4px;font-size:15px;color:#0f172a;font-weight:600;">Pro: ${escapeHtml(quote.client_name)}</p>` : ''}
      ${quote.client_email ? `<p style="margin:0 0 4px;font-size:14px;color:#64748b;">${escapeHtml(quote.client_email)}</p>` : ''}
      ${quote.valid_until ? `<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Platnost do: ${escapeHtml(quote.valid_until)}</p>` : '<p style="margin:0 0 20px;"></p>'}

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px 16px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;">#</th>
            <th style="text-align:left;padding:10px 16px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;">Položka</th>
            <th style="text-align:right;padding:10px 16px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;">Množství</th>
            <th style="text-align:right;padding:10px 16px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;">Cena/ks</th>
            <th style="text-align:right;padding:10px 16px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;">Celkem</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:20px;padding:20px;background:#f8fafc;border-radius:12px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#334155;margin-bottom:8px;">
          <span>Mezisoučet</span><span>${fmt(subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#334155;margin-bottom:8px;">
          <span>DPH ${vatRate} %</span><span>${fmt(vat)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:#0f172a;padding-top:12px;border-top:2px solid #e2e8f0;">
          <span>Celkem k úhradě</span><span style="color:#0891b2;">${fmt(total)}</span>
        </div>
      </div>

      ${quote.note ? `<p style="margin-top:20px;font-size:13px;color:#64748b;line-height:1.6;">${escapeHtml(quote.note).replace(/\n/g, '<br>')}</p>` : ''}
    </div>
    <div style="padding:20px 40px;border-top:1px solid #eef2f7;font-size:12px;color:#94a3b8;">
      Vygenerováno v systému ${escapeHtml(companyName)} · WebDo24
    </div>
  </div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
