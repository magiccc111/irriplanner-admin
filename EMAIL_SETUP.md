# Email Küldés Beállítása - EmailJS

Ez az útmutató elmagyarázza, hogyan állíthatod be az email küldési funkciót a licensz kulcsok automatikus kiküldéséhez.

## 1. EmailJS Fiók Létrehozása

1. Látogass el az [EmailJS.com](https://www.emailjs.com/) oldalra
2. Regisztrálj egy ingyenes fiókot
3. Erősítsd meg az email címedet

## 2. Email Service Beállítása

1. A dashboard-on kattints az **"Add New Service"** gombra
2. Válaszd ki az email szolgáltatódat (Gmail, Outlook, Yahoo, stb.)
3. Kövesd az utasításokat a szolgáltató kapcsolásához
4. Jegyezd fel a **Service ID**-t (pl. `service_xxxxxxx`)

### Gmail beállítás:
- Engedélyezd a "Less secure app access"-t VAGY
- Használj App Password-öt (ajánlott)

## 3. Email Template Létrehozása

1. Kattints az **"Email Templates"** menüre
2. Válaszd a **"Create New Template"** opciót
3. Add meg a következő template-et:

### Template beállítások:
- **Template Name**: `license_notification`
- **Subject**: `IrriPlanner Licensz Kulcs - {{to_name}}`

### Email tartalom:
```html
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
```

4. Mentsd el a template-et és jegyezd fel a **Template ID**-t

## 4. Public Key Megszerzése

1. A dashboard-on kattints az **"Account"** menüre
2. Másold ki a **Public Key**-t (pl. `user_xxxxxxxxxx`)

## 5. Konfiguráció Beállítása

Nyisd meg az `emailjs-config.js` fájlt és cseréld ki a placeholder értékeket:

```javascript
const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_xxxxxxx',     // A Service ID
    TEMPLATE_ID: 'template_xxxxxxx',   // A Template ID
    PUBLIC_KEY: 'user_xxxxxxxxxx'     // A Public Key
};
```

## 6. Tesztelés

1. Indítsd el az alkalmazást
2. Jelentkezz be admin jogosultsággal
3. Generálj egy új licenszet
4. Ellenőrizd, hogy be van-e pipálva az "Email küldése" opció
5. Kattints a "Generate" gombra
6. Ellenőrizd az email címedet

## Hibaelhárítás

### "EmailJS konfiguráció hiányzik" hiba:
- Ellenőrizd, hogy az `emailjs-config.js` fájl be van-e töltve
- Győződj meg róla, hogy nem maradt `your_service_id` placeholder

### Email nem érkezik meg:
- Ellenőrizd a spam mappát
- Győződj meg róla, hogy a Service megfelelően van konfigurálva
- Teszteld az EmailJS dashboard-on keresztül

### "Failed to send email" hiba:
- Ellenőrizd az internetkapcsolatot
- Ellenőrizd a Service és Template ID-kat
- Győződj meg róla, hogy a Public Key helyes

## Havi Limit

Az ingyenes EmailJS fiók **200 email/hó** limitet biztosít. Ha többre van szükség, érdemes lehet fizetős csomagra váltani.

## Biztonság

⚠️ **Fontos**: Soha ne tedd közzé a privát kulcsaidat! Az EmailJS Public Key biztonságosan használható kliens oldalon. 