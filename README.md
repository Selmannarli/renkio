# Renkio — güncel çalışma bilgileri

Canlı uygulama https://renkio.onrender.com/ adresindedir. Render servisi ücretli, sürekli açık 0.5 CPU / 512 MB plandadır. Kalıcı oyun ve sosyal kayıtlar Firebase Firestore üzerindedir. Yerel JSON dosyaları tek başına üretim yedeği değildir.

Node.js 20+ ile `npm ci`, `npm start`; testler `npm test`. Yerel geliştirmede üretim FIREBASE_ADMIN_JSON anahtarını kullanmayın. Bonuslu kurallar için RENKIO_EXPERIMENTAL=1 gerekir. Kaynak karakter değişikliklerinde `npm run build:table`, Auth bundle değişikliklerinde `npm run build:auth` çalıştırılır.

Maç aramada aynı süre seçimi eşleşir; bot beklemesi 10 saniyedir. Kısa aktif maçlar toplam 3, 12 saatlikler ayrı 5 ile sınırlıdır. Joker ve ipucu destekleri vardır. Güçlü ipucu bonus puanlı hamleleri Worker üzerinde arar. Lobi ile aktif maç birbirinden ayrıdır.

Google Play için ayrı release/play-1.14.0 dalı bulunur. Bu dalın native hesap protokolü ve arayüzü mevcut legacy OTA yerine doğrudan yayımlanmamalıdır. Android imzası korunmalıdır.

Aşağıdaki eski sürüm notları tarihsel kayıttır. Ücretsiz sunucu, üç dakika bekleme, ipucu yok ve yalnızca yerel kayıt gibi ifadeler güncel sistemi tarif etmez.

---
# Renkio 1.1.0

Maç bulma, beş sunucu botu, misafir/e-posta/Google hesabı ve bulutta saklanan takma adlar. Web ve Android aynı eşleştirme kuyruğunu kullanır. Bot için bekleme süresi 3 dakika; beş bot doluysa ilk uygun rakip beklenir.

- [Eşleştirme ve hesaplar](docs/MATCHMAKING.md)
- [Google Play yükleme](docs/PLAY-RELEASE.md)
- Geliştirme: `npm ci`, `npm start`; doğrulama: `npm test`.
- Auth SDK güncellemesinde: `npm run build:auth`. Paketlenmiş tarayıcı modülü Android’in çevrim dışı açılışını korur.
- Yayın derleme: `scripts/build-release.ps1`; özel imza klasörü depoya dahil edilmez.

# Renkio 1.0.0

Android V1: yayın imzalı AAB, paket içi çevrim dışı oyun dosyaları, API 36 hedefi, tarayıcıyla çapraz oyun, gizlilik erişimi, sohbet bildirimi ve oyuncu engelleme. İmzalama anahtarları kaynak deposunda tutulmaz. Yeniden üretim: `scripts/build-release.ps1`. Ayrıntılar: [Play yayın hazırlığı](docs/PLAY-RELEASE.md).

# Renkio

Renkleri ve şekilleri birleştiren 2–4 kişilik çevrim içi masa oyunu. Renkio, ürünün çalışma markasıdır. Bu depo ilk prototipten devralındığı için GitHub ve barındırma adresinde eski ad bulunabilir.

## Çalıştırma

Node.js 22+ ile `npm start`; ardından http://localhost:4173 adresini açın. Bağımlılık kurulumu gerekmez. `PORT` ile port, `RENKIO_DATA` ile kayıt dizini değiştirilebilir. Yeni uygulama Renkio adını kullanır; mevcut kayıtların uyumluluğu için ortam değişkeni korunmuştur.

## Oyun

Oyuncu adı yazın, arkadaşlarla modunda yeni masa kurun ve davet bağlantısını paylaşın. 2–4 kişi katılınca masa sahibi oyunu başlatır. Eller özeldir; sunucu yalnızca oyuncunun kendi taşlarını gönderir. Aynı cihazdaki farklı sekmeler, sekmeye özel oturum anahtarıyla ayrı oyuncuları korur.

Taşa ve vurgulanan hücreye dokunun veya masaüstünde taşı sürükleyip bırakın. Hazırlanan hamleyi geri alabilir, ipucu isteyebilir ya da turu taş değiştirmeye ayırabilirsiniz. Bir turdaki bütün taşlar tek kesintisiz satırda veya sütunda olmalıdır. Her çizgi aynı renkte farklı şekiller ya da aynı şekilde farklı renklerden oluşur. Altılı çizgi 6+6 bonusla 12 puan getirir. Açılışta en büyük eşleşen grup oynanır; eşitlik masa sırasıyla çözülür. Torba bittikten sonra elini bitiren +6 alır; herkesin hamlesi tükenirse de oyun kapanır. Yüksek puan kazanır.

Miko ile tek kişilik oyun tarayıcıda çalışır ve bu tarayıcıda kaydedilir. Devam eden oyunuma dön düğmesi, kayıtlı oturumu açar. Çevrim içi oturum varsa önce ona dönülür; bulunamazsa tek kişilik kayıt açılır.

## Görsel ve etkileşim sistemi

- Kendinden barındırılan Nunito değişken yazı tipi; Türkçe karakterler ve Latin Extended paketi.
- Özgün dört taşlı logo, özel üretilmiş 3D tanıtım görseli, tutarlı SVG ikonları.
- Düz, sabit ölçekli 2B tahta; kabartma veya perspektif yok. Seçilen taş için uygun konum veya otomatik hamle önerisi gösterilmez.
- Seçim ve yerleştirme geri bildirimi, puan kutlaması, Renkio altılısında konfeti.
- Web Audio ile sentezlenen taş ve başarı sesleri; ses kapatılabilir.
- Gündüz/gece atmosferi ve azaltılmış hareket tercihi. Sistem hareket tercihi başlangıçta dikkate alınır.
- Yakınlaştırma, kaydırma, iki parmak yakınlaştırma, tam ekran, açılır oyun akışı.
- Kontrollerin dokunma alanları ve küçük ekran düzeni için ek düzenlemeler. Tam WCAG uygunluğu sertifikası iddia edilmez.

Klavye: 1–6 taş seçer ve masaya odaklanır. Oklar konum seçer, boşluk taşı bırakır, Enter hamleyi oynar, Ctrl+Z geri alır, Escape hazırlanan hamleyi temizler.

## Sunucu ve kayıt

Sunucu bütün hamleleri ve puanları doğrular. SSE ile canlı durum gönderir; bağlantı kopunca tarayıcı otomatik yeniden bağlanır. Oyun kayıtları `data/rooms.json` dosyasına atomik yazılır. Başarılı yanıt verilmeden önce kayıt kuyruğu tamamlanır. SIGTERM/SIGINT sırasında kayıt kuyruğu boşaltılır. Bekleme odasında ayrılan oyuncu yerini boşaltır; masa sahibi ayrılırsa yetki sıradaki oyuncuya geçer. Devam eden maçta koltuk korunur. Odalar 7 gün sonra temizlenir.

Tek sunucu örneğiyle çalıştırın. JSON dizini kalıcı bir disk üzerindeyse yeniden başlatma sonrası oyunlar korunur. **Render ücretsiz planda dosya sistemi kalıcı değildir.** Yeniden dağıtım veya sunucu yeniden kurulumu çevrim içi oyunları sıfırlayabilir. Bu sürüm, kullanıcının tercihi doğrultusunda ücretsiz test planında yayımlanır. Ücretli plan veya disk satın alınmamıştır.

## Kontroller

`npm test` kural, puanlama, gizli el, host yetkisi, sıra, SSE, yeniden bağlantı, dört oyunculu tam maç, kayıtla yeniden başlatma ve düz konum eşlemesi, hamle ipucunun yokluğu ve çizimlerin bir ekran karesinde birleştirilmesi testlerini çalıştırır. Tam maç boyunca 108 taşın bütünlüğü kontrol edilir. Testlerin geçmesi, ticari yük testi veya bağımsız güvenlik denetimi yerine geçmez.

## Varlıklar ve araştırma

- Nunito: SIL Open Font License; lisans metni `public/assets/Nunito-OFL.txt` içindedir.
- Tanıtım görseli: bu proje için yapay zekâyla üretildi; `public/assets/renkio-hero.webp`.
- Logo, SVG ikonları ve oyun taşı çizimleri: bu proje için yazıldı.
- İncelenen dijital oyun örnekleri: [Marmalade Ticket to Ride](https://www.marmaladegamestudio.com/games/ticket-to-ride), [Dire Wolf Sagrada](https://www.direwolfdigital.com/sagrada/). Tasarım/varlıkları kopyalanmadı.
- Dokunma hedefleri: [W3C hedef boyutu rehberi](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).

## Ticari çıkış durumu

Bu sürüm kapsamlı bir görsel ve etkileşim yenilemesidir; ticari çıkış onayı değildir. Marka adı için tescil ve kullanım uygunluğu doğrulanmadı. Para alınacak dağıtım öncesinde kalıcı üretim kayıtları/yedekleme, eşzamanlı kullanıcı yük ölçümü, bağımsız güvenlik kontrolü ve ticari dağıtım koşulları tamamlanmalıdır. Kaynak depo şu anda herkese açıktır; ticari dağıtımda kaynak erişim politikası ayrıca seçilmelidir. Ödeme, hesap ve abonelik satışı bu sürümde yoktur.

## 0.4.0: kullanım ve Android

Tahta ekranı tek görünüm içinde tutulur; dikey ve yatay telefon düzeni, dört oyunculu kompakt skorlar, düz taşlar ve büyük hamle kontrolleri vardır. İpucu düğmesi ve uygun hücre vurguları kaldırılmıştır. Hatalı yerleştirme denemeleri kural mesajı verir. Miko hamle aramasını bir modül Worker içinde yapar; arama ekranın ana iş parçacığını durdurmaz. Boş imleç hareketleri tahtayı yeniden çizmez; seçili taş veya kaydırma çizimleri ekran karesine birleştirilir.

Android kaynakları android/ altındadır. Java 17+, Android SDK 36 ve SDK Build Tools gerekir. android/local.properties içine sdk.dir ekleyip android/ içinden gradlew.bat assembleDebug çalıştırın. Üretilen test APK'sı app/build/outputs/apk/debug/app-debug.apk dosyasıdır. APK test anahtarıyla imzalanır; mağaza dağıtım sürümü değildir. Minimum Android 8.0. APK aynı HTTPS sunucusunu Android WebView ile açar; ayrı bir oyun motoru veya sunucu kullanmaz. APK ve masaüstü/telefon tarayıcıları aynı masa koduyla 2–4 kişilik oyuna katılır. İnternet ve güncel Android System WebView gerekir. Sunucu uykusu ücretsiz test planına bağlıdır. Çevrim dışı açılışta tekrar deneme ekranı vardır; kaydedilen oturum aynı kurulumda korunur.

Android emülatörü üzerinde canlı WebView açılışı, ipuçlarının yokluğu, masaüstüyle aynı odaya katılma, gizli el ve Android hamlesinin masaüstüne ulaşması test edildi. Testi tekrarlamak için ana APK ve test APK'sını emülatöre kurup ADB ortam değişkenini adb yoluna ayarlayın ve node scripts/android-crossplay.mjs çalıştırın. Bu komut canlı test sunucusunda yeni bir oda açar. Fiziksel Android cihazında performans ölçümü yapılmadı.


## 0.4.1: tam tahta, kompakt el, solo tüyo

Tahta her hamle, önizleme ve ekran boyutu değişiminde bütün taşlar ile bir hücre kenar payını sığdırır. 25 piksel alt ölçek sınırı kaldırıldı; 108 taşlık tek sıra ve uç koordinatlar telefon/masaüstü ölçülerinde test edilir. Kaydırma görünümü kırpmaz; yakınlaştırma bütün taşları sığdırma sınırını aşmaz. Çok uzun dizilimlerde taşların küçülmesi ekranın fiziksel sınırından kaynaklanır. El paneli daraltıldı. Sarı ve turuncu belirgin tonlara ayrıldı. SVG el ve Canvas tahta artık aynı SHAPE_PATHS kaynağını kullanır; yoncanın yerleştirilince şekil değiştirmesi düzeltildi.

Tüyo yalnızca bilgisayara karşı, oyuncunun isteğiyle açılır. Önerilen taşları ve puanı açıklar; Hamleyi dene düğmesi öneriyi onaylanmamış hamleye dönüştürür. Oyuncu Hamleyi oyna demeden işlenmez. Çevrim içi oyunda tüyo veya uygun hücre vurgusu yoktur. Mevcut Android APK aynı canlı web arayüzünü açtığı için uygulama yeniden açılınca bu düzeltmeleri de alır; yeni APK kurulumu gerekmez.

## 0.5.0: ortak masa özellikleri

- Altı renk: kırmızı, siyah, sarı, yeşil, mavi, mor. Eski renklerin taş indeksleri korunur; kural ve kayıtlar değişmez.
- Her oyuncunun son yerleştirdiği taşlar lastMoves içinde tutulur. Taşlarda koyu çerçeve ve oyuncu kartıyla eşleşen 1–4 işareti vardır; taş değiştirme, mesaj veya zaman aşımı bunları silmez.
- Sıra beklerken taş seçme ve yerleştirme özel denemedir. Sunucuya gönderilmez, rakip göremez. Yeni hamleyle hâlâ uyumluysa korunur; çakışıyorsa temizlenir. Hamleyi onaylamak yalnızca oyuncunun kendi sırasında mümkündür.
- Hızlı mesajlar ve 160 karakterlik serbest metin SSE üzerinden aynı odadaki oyunculara iletilir. Son 40 mesaj tutulur; mesaj başına en az 1,2 saniye vardır. Mesajlar DOM içine metin olarak yazılır. Mesaj göndermek oyun revizyonunu artırmaz. Masaüstünde sohbet yana, dikey telefonda tahtanın altına açılır; tahta yeniden sığdırılır.
- Tur süresi: sınırsız, 30, 60 veya 120 saniye. Masa kurulurken veya başlatılmadan önce masa sahibi seçer; solo oyun da desteklenir. Çevrim içi sayaç sunucunun son zamanını esas alır; sunucu 500 ms aralıkla ve istek sırasında süreyi uygular. Süresi biten tur puan/taş değiştirmeden geçer. Açılış kaçırılırsa sıradaki oyuncunun açılış grubu kullanılır. Herkes iki tur art arda süreyi kaçırırsa maç sonlanır.
- Oyuncunun sırasında hafif parlama; azaltılmış hareket seçeneğinde sabit çerçeve. Yazı tekrarları yerine etiketli ve açıklama balonlu ikon düğmeleri.

Doğrulama: 28 otomatik test; tarayıcıda iki oyuncuyla özel deneme, sıraya geçince korunma, hamle onayı, hızlı mesaj ve gerçek sayaç bitişi. 320×760 telefonda sohbet, tahta ve el paneli birlikte sayfaya sığar. Android aynı canlı arayüzü kullandığı için mevcut APK yeniden açıldığında güncellemeyi alır.

Son hamle gösterimi güncellemesi: Oyuncu numaraları ve oyuncu başına geçmiş hamle çerçeveleri kaldırıldı. Yalnızca ortak game.last listesindeki en son yerleştirilen taşlar koyu çerçeve ve hafif lavanta zeminiyle işaretlenir. Bu işaret iki istemcide aynıdır; yeni yerleştirme geldiğinde önceki hamleden kalkar.

## 0.5.1: gece teması ve tek süre seçimi

Gece görünümü nötr lacivert yüzeyler ve okunaklı metin/ikon kontrastıyla yenilendi. Elde ve tahtada aynı açık taş yüzeyi kullanılır; siyah sembolü örten koyu iç katman ve tahtadaki gündüz radyal parlaması kaldırıldı.

Çevrim içi oyunda süre yalnızca host tarafından bekleme odasındaki tek seçim alanında belirlenir. Konuk seçilen süreyi salt okunur görür. Ana sayfadaki süre alanı yalnızca solo modda görünür. Seçim olayı değerini ekran yeniden çizilmeden önce yakalar; bekleyen değer korunur ve hata halinde sunucu değeri geri gelir. Böylece önceki değerin yanlışlıkla kaydedilmesi giderildi. Tarayıcıda 60 ve 120 saniye seçimleri, konuğa yansıma, yeniden bağlanma ve seçilen süreyle maç başlatma kontrol edildi.
