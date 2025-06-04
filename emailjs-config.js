// EmailJS Konfiguráció
// 1. Regisztrálj az EmailJS.com oldalon
// 2. Hozz létre egy Service-t (pl. Gmail, Outlook stb.)
// 3. Hozz létre egy Email Template-et
// 4. Másold be a megfelelő ID-kat alább

// EmailJS konfiguráció beállítva
const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_lfxu67d',     // Service ID
    TEMPLATE_ID: 'template_ho8n2ct',   // Template ID
    PUBLIC_KEY: 'Xnn-PDiIt7JqG_p73'   // Public Key
};

// Email sablon példa (ezt az EmailJS.com-on kell beállítani):
/*
Template változók:
- {{to_name}} - Ügyfél neve
- {{to_email}} - Ügyfél email címe
- {{license_key}} - Licensz kulcs
- {{expiry_date}} - Lejárati dátum
- {{company_name}} - Cég neve

Email sablon példa:

Tárgy: IrriPlanner Licensz Kulcs - {{to_name}}

Tisztelt {{to_name}}!

Köszönjük az IrriPlanner szoftver megvásárlását!

Az Ön licensz kulcsa:
{{license_key}}

Licensz részletek:
- Érvényesség: {{expiry_date}}-ig
- Felhasználónév: {{to_name}}
- Email: {{to_email}}

A licensz kulcs aktiválásához kérjük, indítsa el az IrriPlanner alkalmazást és adja meg a fenti kulcsot.

Amennyiben bármilyen kérdése van, kérjük vegye fel velünk a kapcsolatot.

Üdvözlettel,
Az IrriPlanner Csapat
*/ 