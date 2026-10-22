# Kartmasa

Arkadaşlarınla oda kur, davet kodunu paylaş, sohbet et ve masaüstü uygulamayla oyuna geç.
Oyun tarayıcıda oynanmaz. Site yalnızca oda ve lobi tarafını yürütür.

## Nasıl çalışır

- `public/` statik sitedir (HTML, CSS, JS). Derleme adımı yoktur.
- `api/rooms.js` tek bir sunucusuz fonksiyondur. Oda oluşturma, katılma, sohbet, başlatma ve listeleme burada.
- `lib/rooms.js` oda mantığıdır. `lib/store.js` odaları saklar.
- Her oda, **private Vercel Blob** içinde `rooms/KOD.json` olarak tutulur. Yazmalar `ifMatch` (etag) ile yapılır, çakışma olursa yeniden denenir.
- İstemci odayı yaklaşık 1,5 saniyede bir yoklar (polling). Oyuncular 15 saniyede bir "buradayım" sinyali gönderir. 2 dakikadır görünmeyen oyuncu odadan düşer, oda boşalınca silinir.

## Hesaplar, yetkiler ve yönetim paneli

- Sayfalar: `/giris` (giriş ve kayıt), `/indir` (uygulama indirme), `/admin` (yönetim paneli).
- **İlk kayıt olan hesap yönetici olur.** Siteyi yayınlar yayınlamaz önce sen kayıt ol.
- Parolalar scrypt ile özetlenir, oturum çerezi HttpOnly + SameSite=Lax'tır. 5 hatalı girişte hesap 5 dakika kilitlenir.
- Yetkiler: `create` (oda kur), `join` (odaya katıl), `chat` (sohbet), `start` (odayı başlat), `download` (uygulamayı indir).
  Misafirler (girişsiz) ve yeni üyeler için varsayılanlar **Ayarlar** sekmesinden, her kullanıcının yetkisi **Kullanıcılar** sekmesinden değişir.
- Kayıt modları: herkese açık, yönetici onaylı, kapalı.
- Yönetici paneli odaları listeler; odayı başlatabilir, yeniden açabilir, oyuncu atabilir, kapatabilir.
- Hesaplar `users/`, oturumlar `sessions/`, ayarlar `meta/settings.json` olarak aynı private Blob deposunda tutulur.
- İndirme bağlantısını **Ayarlar** sekmesine yaz. `config.js`'teki bağlantı herkese açık olduğundan indirme yetkisini denetleyemez.

## Uygulama bağlantısı (config.js, yedek)

`public/config.js` dosyasını doldur:

```js
window.KARTMASA = {
  appUrl: 'https://...',               // indirme sayfası
  appOpenUrl: 'kartmasa://oda/{code}', // uygulamayı doğrudan açan bağlantı (isteğe bağlı)
};
```

Boş bırakılırsa "Uygulamayı İndir" düğmeleri pasif görünür ve "Masa hazır" ekranında bağlantı eklenmediği yazar.

## Yerelde çalıştırma ve test

```bash
npm install
npm test            # oda mantığı testleri (bellek içi depo)
```

Üretimde fonksiyonun `BLOB_READ_WRITE_TOKEN` ortam değişkenine ihtiyacı vardır. Vercel'de bir Blob deposunu projeye bağlayınca bu değişken otomatik eklenir. Depo **private** olmalıdır.

## Vercel

Repoyu Vercel'e bağla, çıktı klasörü `public` (vercel.json içinde tanımlı). Bir Blob deposu oluşturup projeye bağla.
