# Kartmasa

Arkadaşlarınla oda kur, davet kodunu paylaş, sohbet et ve masaüstü uygulamayla oyuna geç.
Oyun tarayıcıda oynanmaz. Site yalnızca oda ve lobi tarafını yürütür.

## Nasıl çalışır

- `public/` statik sitedir (HTML, CSS, JS). Derleme adımı yoktur.
- `api/rooms.js` tek bir sunucusuz fonksiyondur. Oda oluşturma, katılma, sohbet, başlatma ve listeleme burada.
- `lib/rooms.js` oda mantığıdır. `lib/store.js` odaları saklar.
- Her oda, **private Vercel Blob** içinde `rooms/KOD.json` olarak tutulur. Yazmalar `ifMatch` (etag) ile yapılır, çakışma olursa yeniden denenir.
- İstemci odayı yaklaşık 1,5 saniyede bir yoklar (polling). Oyuncular 15 saniyede bir "buradayım" sinyali gönderir. 2 dakikadır görünmeyen oyuncu odadan düşer, oda boşalınca silinir.

## Uygulama bağlantısı

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
