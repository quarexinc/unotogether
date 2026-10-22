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

- Sayfalar: `/giris` (giriş ve kayıt), `/hesap` (ad, avatar, parola), `/indir` (uygulama indirme), `/admin` (yönetim paneli).
- **Oda kurmak ve odaya katılmak için hesap gerekir** (misafir yetkileri varsayılan olarak kapalıdır, Ayarlar sekmesinden değişir).
- Yönetici hesabı iki yolla oluşur:
  - Vercel'de `ADMIN_USERNAME` ve `ADMIN_PASSWORD` ortam değişkenlerini tanımla. Hesap ilk doğru girişte oluşur, bu ad kayıt için ayrılır ve parolayı panelden/Hesabım sayfasından değiştirince ortam değişkeni geçersiz olur. Bu durumda ilk kayıt yönetici olmaz.
  - Değişken tanımlı değilse **ilk kayıt olan hesap yönetici olur.**
- Parolalar scrypt ile özetlenir, oturum çerezi HttpOnly + SameSite=Lax'tır. 5 hatalı girişte hesap 5 dakika kilitlenir.
- Yetkiler: `create` (oda kur), `join` (odaya katıl), `chat` (sohbet), `start` (odayı başlat), `download` (uygulamayı indir).
  Misafirler (girişsiz) ve yeni üyeler için varsayılanlar **Ayarlar** sekmesinden, her kullanıcının yetkisi **Kullanıcılar** sekmesinden değişir.
- Kayıt modları: herkese açık, yönetici onaylı, kapalı.
- Yönetici paneli odaları listeler; odayı başlatabilir, yeniden açabilir, oyuncu atabilir, kapatabilir.
- Hesaplar `users/`, oturumlar `sessions/`, ayarlar `meta/settings.json` olarak aynı private Blob deposunda tutulur.
- İndirme bağlantısını **Ayarlar** sekmesine yaz. `config.js`'teki bağlantı herkese açık olduğundan indirme yetkisini denetleyemez.

### Yönlendirme kuralları

Yönetim paneli › Yönlendirmeler sekmesinden ziyaretçilere gösterilecek yönlendirmeler tanımlanır: "önce kayıt ol", "önce uygulamayı indirin", duyuru bandı, bakım penceresi vb. Bir kural; kime (misafir / uygulamayı indirmemiş üye / indirmiş üye), ne zaman (tıklayınca, sayfa açılınca, oda kur/katıl düğmesinde), ne yapacağı (yönlendir / pencere / bant) ve ne sıklıkla gösterileceğini belirler. Kurallar sırayla denenir, ilk uyan çalışır. Yöneticiler, `/giris` ve `/admin` kurallardan muaftır; bu yüzden siteden dışarıda kalma riski yoktur. Her kuralın gösterim, tıklama ve kapatma sayaçları tutulur.

Panelde ayrıca: kullanıcı arama/filtreleme, toplu işlemler, CSV dışa aktarma, kullanıcı notları, oda sohbetini görme, oda ve toplu duyuru, yavaş mod, yasaklı kelimeler, oda sınırı ve işlem günlüğü bulunur.

### Sesli ve görüntülü sohbet

Oda ekranındaki "Konuşmaya katıl" ile mikrofon ve kamera açılır. Ses ve görüntü tarayıcılar arasında doğrudan (WebRTC, mesh) akar, sunucudan geçmez; `/api/rtc` yalnızca bağlantı mesajlarını (SDP) taşır ve gelen kutuları `rtc/KOD/` altında özel Blob deposunda tutulur. Konuşma en fazla 8 kişiyle sınırlıdır (herkes herkese bağlandığı için). `media` yetkisi misafir için kapalı, yeni üye için açıktır; kullanıcı bazında Kullanıcılar sekmesinden kapatılabilir.

Yalnızca STUN kullanılır; bazı mobil ve kurumsal ağlarda doğrudan bağlantı kurulamaz. Bunun için **Ayarlar › TURN sunucusu** alanına bir TURN adresi (örn. `turn:sunucu.com:3478`), kullanıcı adı ve parola yazılabilir (Cloudflare Realtime, Metered veya kendi coturn'ün).

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

Üretimde veri (hesaplar, oturumlar, odalar, ayarlar) **Upstash Redis**'te tutulur. Vercel'de Marketplace'ten Upstash Redis'i projeye bağlayınca `KV_REST_API_URL` ve `KV_REST_API_TOKEN` otomatik eklenir (`UPSTASH_REDIS_REST_URL/TOKEN` de kabul edilir). Marketplace'teki standart "Redis" sağlayıcısı kullanılırsa `REDIS_URL` (TCP) okunur. Bu değişkenler yoksa yedek olarak `BLOB_READ_WRITE_TOKEN` ile private Vercel Blob kullanılır; Blob'un ücretsiz işlem kotası küçük olduğundan önerilmez. Odalar 12 saat, oturumlar 31 gün sonra kendiliğinden silinir.

## Vercel

Repoyu Vercel'e bağla, çıktı klasörü `public` (vercel.json içinde tanımlı). Marketplace'ten bir Upstash Redis oluşturup projeye bağla.
