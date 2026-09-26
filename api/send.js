module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const TO_EMAIL = process.env.TO_EMAIL || 'moshik@msbitsoftware.com';
  const FROM_EMAIL = process.env.FROM_EMAIL || 'DJ Overflow <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { name, phone, date, occasion, duration, city, genres, notes } = body;

  if (!name || !phone) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const formatDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—');
  };

  const textBody = [
    'שם: ' + name,
    'טלפון: ' + phone,
    'תאריך: ' + (date || ''),
    'סיבת האירוע: ' + (occasion || ''),
    'משך: ' + (duration || ''),
    'יישוב: ' + (city || ''),
    'זִאנרים: ' + (genres || ''),
    '',
    (notes || '')
  ].join('\n');

  const fieldRow = (label, value) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #292b31;font-size:12px;color:#9397ab;width:120px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:11px 0 11px 16px;border-bottom:1px solid #292b31;font-size:14px;color:#e9e9ed;vertical-align:top;">${escapeHtml(value) || '—'}</td>
        </tr>`;

  const rows = [
    fieldRow('שם מלא', name),
    fieldRow('טלפון', phone),
    fieldRow('תאריך האירוע', formatDate(date)),
    fieldRow('סיבת האירוע', occasion),
    fieldRow('משך האירוע', duration),
    fieldRow('יישוב', city),
    genres ? fieldRow('זִאנרים', genres) : ''
  ].join('');

  const notesSection = notes ? `
          <tr>
            <td style="padding:22px 32px 28px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#9184d9;">תיאור נוסף</p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#e9e9ed;white-space:pre-wrap;">${escapeHtml(notes)}</p>
            </td>
          </tr>` : '';

  const htmlBody = `<!doctype html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0e18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0e18;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#1b1d2b;border:1px solid #3f424d;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="padding:26px 32px 20px;border-bottom:1px solid #3f424d;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9184d9;">DJ Overflow</p>
              <h1 style="margin:0;font-size:20px;line-height:1.3;color:#e9e9ed;font-weight:600;">פנייה חדשה לאירוע</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
              </table>
            </td>
          </tr>${notesSection}
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #3f424d;">
              <p style="margin:0;font-size:12px;color:#75798c;">נשלח אוטומטית מטופס "תיאום אירוע" באתר DJ Overflow</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Raw email headers are 7-bit ASCII only (RFC 5322); a non-ASCII Subject must be
  // MIME encoded-word wrapped (RFC 2047) or relays/clients replace it with '?'.
  const encodeSubject = (s) => '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: Buffer.from(JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: encodeSubject('פנייה חדשה לאירוע — DJ Overflow'),
        text: textBody,
        html: htmlBody
      }), 'utf8')
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', resendRes.status, errText);
      res.status(502).json({ error: 'Failed to send email' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
};
