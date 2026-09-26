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

  const htmlBody = '<pre style="font-family:inherit;white-space:pre-wrap">' + escapeHtml(textBody) + '</pre>';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: 'פנייה חדשה לאירוע — DJ Overflow',
        text: textBody,
        html: htmlBody
      })
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
