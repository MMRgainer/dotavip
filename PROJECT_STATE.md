# DotaVIP — стан проєкту (handoff для нового чату)

> Прочитай цей файл повністю перед роботою. Він описує що зроблено, архітектуру,
> як запускати, і що ще в роботі. Код у `C:\Projects\DotaVIP`.
> **ПРАВИЛО:** після кожної правки/фічі ОНОВЛЮЙ цей файл — він має дозволяти
> почати новий чат з нуля без жодного контексту.

## Що це
Ігровий оверлей-помічник для **Dota 2** (аналог DotaCoach, але власний, на Electron).
Показує поверх гри: таймери байбеку/ультів ворогів, Рошан/Аегіс/Гліф, авто-зчитування
ворогів з таблиці рахунку. Мова інтерфейсу UA/RU/EN. Назва продукту — **DotaVIP**.

## Назва продукту (РОБОЧА): DotaVIP
Поки що **DotaVIP** — робоча назва, вживається СКРІЗЬ. Коли користувач дасть
офіційну назву — змінити в усіх цих місцях (чек-лист перейменування):
- Папка проєкту `C:\Projects\DotaVIP` (+ абсолютні шляхи в `scripts\*.bat`, `scripts\*.ps1`).
- `DotaVIP.exe` (стартер у корені; ім'я в `scripts\launcher.cs` + команда компіляції + повідомлення).
- `frontend/package.json`: `name`, `productName` (×2), `appId`, `artifactName`, `shortcutName`.
- `frontend/electron/main.cjs`: `app.setName`, tray tooltip, пункти меню трею.
- Заголовок settings-вікна (`title: 'DotaVIP'` у main.cjs), логотип у `SettingsApp.jsx`
  (`Dota<span>VIP</span>`), тексти в `i18n.js`.
- Ім'я backend exe: `dotavip-backend` (`backend/dotavip-backend.spec`, `main.cjs` startBackend,
  `launcher.cs` KillByName, `scripts\START.bat` taskkill).
- Цей файл (PROJECT_STATE.md).

## Структура папки (підтримуй чистою!)
```
C:\Projects\DotaVIP\
├── DotaVIP.exe          ← ЄДИНИЙ стартер у корені (іконка Рошана; без консолей)
├── PROJECT_STATE.md     ← цей файл
├── backend\             ← Python (FastAPI). debug\ — усі дебаг-дампи (PNG, last_gsi_payload.json)
├── frontend\            ← Electron + React (Vite)
├── scripts\             ← launcher.cs (код стартера), START.bat (запасний), build_installer.ps1, start-*.ps1
└── docs\                ← документація + dota2_gsi_config.cfg (референс-копія)
```
Нічого не класти в корінь, крім DotaVIP.exe і цього файлу. Дебаг-картинки/дампи
бекенду пишуться в `backend\debug\` (server.py пише туди last_gsi_payload.json).

## Архітектура (3 частини)
1. **Backend** — Python (FastAPI + uvicorn), `backend/`. Слухає Dota GSI на `http://127.0.0.1:8765`.
   - Приймає GSI (POST `/gsi`), віддає стан через WebSocket `/ws`.
   - OCR таблиці рахунку (Tesseract) для героїв+рівнів ворогів.
   - Слухач клавіші таблиці (lib `keyboard`) → захоплює екран поки клавіша тримається.
2. **Frontend/Overlay** — Electron + React (Vite), `frontend/`.
   - Прозоре вікно поверх гри (overlay) + головне вікно (налаштування/гайд) + значок у треї.
3. **Дані** — `backend/assets/hero_abilities.json` (кулдауни ультів з dotaconstants, **127 героїв**),
   `backend/assets/scoreboard_calibration.json` (координати таблиці на екран користувача).

## Як запускати (DEV)
Одним кліком: **`C:\Projects\DotaVIP\DotaVIP.exe`** — нативний winexe-лаунчер
(іконка Рошана, без жодних консолей). Що робить: вбиває старі процеси проєкту
(electron/python по шляху, dotavip-backend по імені), стартує бекенд і vite
приховано, чекає поки vite відповість на `localhost:5173` (до 40с; **vite на цій
машині біндиться тільки на IPv6 ::1** — тому перевірка саме `localhost`, не
127.0.0.1!), запускає electron і виходить. Діти живуть самостійно.
Перекомпіляція стартера (код: `scripts\launcher.cs`):
```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /out:DotaVIP.exe /win32icon:frontend\build\icon.ico /reference:System.Windows.Forms.dll scripts\launcher.cs
```
Запасний варіант: `scripts\START.bat`. Або вручну (3 процеси):
```
cd backend &&  .venv\Scripts\python.exe -m uvicorn api.server:app --host 127.0.0.1 --port 8765 --log-level warning
cd frontend && node_modules\.bin\vite.cmd --port 5173
cd frontend && set NODE_ENV=development && node_modules\electron\dist\electron.exe .
```
Dev electron вантажить `http://localhost:5173`. **Vite HMR вимкнено** (заважав FPS) — після змін
у JS треба перезапустити electron (vite віддає свіжий src при перезавантаженні).

## Як пакувати (PRODUCTION, один інсталятор)
```
# Тільки локальна збірка (без публікації на GitHub):
powershell -ExecutionPolicy Bypass -File C:\Projects\DotaVIP\scripts\build_installer.ps1

# Збірка + публікація на GitHub Releases (для авто-оновлення):
$env:GH_TOKEN = "ghp_..."   # Personal Access Token, scope: repo
powershell -ExecutionPolicy Bypass -File C:\Projects\DotaVIP\scripts\build_installer.ps1 -Publish
```
Робить: PyInstaller бекенд → `backend/dist_backend/dotavip-backend.exe`; копіює Tesseract (eng)
у `backend/tesseract_bundle`; vite build; electron-builder → `frontend/release/DotaVIP-Setup-X.Y.Z.exe`.
- Іконка додатку: `frontend/build/icon.ico` (з Roshan.png).
- **ВАЖЛИВО:** electron-builder падає на розпакуванні winCodeSign (Windows без Developer Mode не
  створює symlink). Build-скрипт це **обходить** (крок 3.5 — готує кеш вручну). Працює.
- У продакшені `electron/main.cjs` сам запускає `dotavip-backend.exe` з `resources/backend/`.
- Готова папка як у юзера: `frontend/release/win-unpacked/` (= вміст після встановлення).
- **Останній повний перепак: 2026-06-15** — `DotaVIP-Setup-1.0.0.exe` без авто-оновлення.
  **Треба перепакувати** після налаштування GitHub репозиторію (вписати owner/repo у package.json).

## Авто-оновлення (electron-updater + GitHub Releases)
- **Провайдер:** GitHub Releases. Конфіг у `frontend/package.json` → `build.publish`: `owner`, `repo`.
  **Перед першим релізом замінити `GITHUB_USERNAME` на реальний нік!**
- **Логіка** (у `frontend/electron/main.cjs`, функція `initAutoUpdater`):
  - Перевірка при старті (через 15с після запуску) + кожні 4 год.
  - Завантаження у фоні автоматично (`autoDownload: true`).
  - Після завантаження: якщо `dota2.exe` НЕ запущена — встановлює одразу; якщо запущена — чекає
    (перевіряє кожні 5 хв через `tasklist`) і встановлює після закриття Dota. Трей показує підказку.
  - Користувач може встановити вручну через кнопку «Встановити зараз» у ⚙-налаштуваннях.
- **Версіонування:** `frontend/package.json` → `version`. Підвищуй перед кожним релізом.
- **IPC:** `get-update-ready`, `install-update-now` (bridge у preload.cjs).
- **UI:** `AppSettings.jsx` — рядок «🆕 Оновлення готове» з'являється лише коли є готовий апдейт.
  Ключі i18n: `update_ready_label`, `update_ready_desc`, `update_install_btn`.

## Як викочувати нову версію (процедура релізу)
1. Підвищ `version` у `frontend/package.json` (напр. `"1.0.1"`).
2. Переконайся що `build.publish.owner` і `build.publish.repo` правильні.
3. `$env:GH_TOKEN = "ghp_..."` (токен з правами `repo`).
4. Запусти `build_installer.ps1 -Publish` — збере інсталятор і завантажить на GitHub Releases.
5. electron-builder автоматично створює `latest.yml` у релізі — клієнти знаходять апдейт по ньому.

## Ключові файли
- `frontend/electron/main.cjs` — Electron: overlay-вікно (прозоре, click-through, focusable:false,
  на весь монітор включно з таскбаром), settings-вікно (maximized), трей, запуск бекенду,
  слухач фокусу Dota (`focus_monitor.ps1` — ховає оверлей коли Dota не активна),
  **автозапуск Windows** (login item, IPC get/set-autostart, дефолт-ON на перший запуск,
  `--autostart` → тихий старт у трей), **single-instance lock**.
- `frontend/electron/preload.cjs` — bridge: setIgnoreMouse, getAutostart/setAutostart.
- `frontend/src/App.jsx` — overlay-режим (TopBarButtons + Roshan/Glyph draggable) vs браузер-режим.
- `frontend/src/SettingsApp.jsx` — головне вікно (чек-поінти зліва, налаштування таблиці + гайд
  по центру, справа зверху: ✎ Текст + ⚙ шестерня).
- `frontend/src/components/AppSettings.jsx` — модальне вікно налаштувань (⚙): тумблер автозапуску.
- `frontend/src/components/TopBarButtons.jsx` — кнопки Викуп/Ульт/БКБ під ворогами (таймер на
  місці кнопки). `HeroPicker` — сітка УСІХ 127 героїв з пошуком. `SlotOptions` — тумблери УЛЬТ/БКБ
  + ⇄ зміна героя у випадному меню. БКБ: кулдаун 95с (`BKB_DURATION`).
- `frontend/src/components/AppSettings.jsx` — ⚙-вікно: вибір мови (LangSwitcher) + тумблер автозапуску.
- `frontend/src/SettingsApp.jsx` — головне вікно. LangSwitcher з головної колонки прибрано (тепер у ⚙).
  Калібрування таблиці — ПОВНОЕКРАННЕ вікно `CalibrationModal` (кнопка «⚙ Налаштування таблиці»
  по центру зверху; ✓ якщо калібровано; підсвічується при наведенні на чек-поінт «Зчитування
  таблиці»). Вікно розділене на дві половини вертикальною лінією кольору акценту `#38bdf8`:
  ЗЛІВА «ГАЙД» (`guide_title`) — 4 пронумеровані кроки (`calib_g1..calib_g4`), кроки 1-3 мають
  круглу (i) `InfoImg` що при наведенні показує повноекранний скрін (`public/guide/guide_img1..3.png`);
  СПРАВА «НАЛАШТУВАННЯ» (`setup_title`) — сам процес калібрування (кнопка `calib_btn`/`recalibrate`
  з підтвердженням `recalibrate_confirm`, зворотний відлік, клік 5 точок на скріншоті, збереження).
  Скріншоти гайда лежать у `frontend/public/guide/` (оригінали — `C:\Projects\guide_img1..3.png`).
  Окремий `Guide` («Як користуватись») на головному екрані лишився: заголовки/описи зліва;
  рядки УЛЬТ/▾/БКБ окремі; останній рядок має `InfoDot` (`g_read_info`).
- `frontend/src/components/UltPopup.jsx` — popup рівня ульти + модифікатор Octarine (−25%).
  Рівні ховаються якщо КД ульти сталий. (⇄ зміна героя тепер у `SlotOptions`, не тут.)
- `frontend/src/components/TextEditor.jsx` — редактор усього тексту (кнопка «✎ Текст»).
- `frontend/src/i18n.js` — **УВЕСЬ текст інтерфейсу** (UA/RU/EN) в об'єкті `T`. Підтримує локальні
  правки (overrides у localStorage) + `exportMerged()` для експорту.
- `frontend/src/store/overlayStore.js` — zustand стан (вороги, таймери, ульт-рівні, модифікатори,
  `manualSlots` — ручні override-слоти, скидання стану на нову гру по `match_seq`).
- `frontend/src/overlay/measurements.js` — координати елементів під роздільність (пресети 1080/1440/4K).
- `frontend/src/index.css` — мінімальний reset; #root full-width (РАНІШЕ тут був шаблонний CSS
  з `#root{width:1126px; border-inline}` — ЧЕРЕЗ НЬОГО головне вікно було не по центру).
- `frontend/src/pub.js` — хелпер шляхів до /public (працює і в dev, і в запакованому через `base:'./'`).
- `backend/api/server.py` — усі ендпоінти, GSI парсинг, Tab-слухач, broadcast,
  **детект нової гри по matchid** (`_match_seq`), скидання OCR-кешу на нову гру/кінець гри.
- `backend/gsi/parser.py` — парсер GSI: game_time, **clock_time, match_id, paused, win_team,
  game_over** (POST_GAME).
- `backend/tracker/scoreboard.py` — OCR героїв (назви) + рівнів.
- `backend/tracker/calibration.py` — калібрування таблиці (5 кліків: рівень + по 2 імені на команду).
- `backend/setup_tools/gsi_installer.py` — авто-встановлення GSI конфігу в папку Dota.

## Життєвий цикл гри (GSI)
- `map.game_time` — ігровий час (іде під час паузи); `map.clock_time` — екранний годинник (застигає на паузі).
- `map.matchid` — унікальний ID матчу. Бекенд тримає `_match_seq` (+1 коли matchid змінився =
  **нова карта**) і шле його у стейті. Фронт (`applyState`) при рості `match_seq` скидає:
  enemyHeroes, ультрівні, моди, таймери, Рошан/Аегіс/Гліф, **manualSlots**.
- `game_over` (= POST_GAME) + `win_team` — кінець гри. На POST_GAME фронт знімає ручні
  блокування слотів (наступна гра знову автозаповнюється парсером/OCR).
- `paused` (з `map.paused`) → **заморозка всіх таймерів на паузі гри**. Хук
  `frontend/src/hooks/usePauseFreeze.js` (змонтований у App.jsx): поки `paused`, кожні 200мс
  зсуває ВСІ якорі таймерів уперед на реально проведений час через `shiftAnchors(deltaMs)` у
  store. Залишок «застигає»; на знятті паузи зсув припиняється і відлік триває з того ж місця.
  Покриває ульт/викуп/БКБ (`startedAt`) і Рошан/Аегіс/Гліф (`roshanAt`/`aegisAt`/`glyphAt`).
  Точність на межах паузи ~±0.4с (лаг GSI ~100мс + тик 200мс) — прийнятно.

## Ручний вибір героя (кнопка УЛЬТ)
- У popup УЛЬТ кнопка **⇄** → сітка всіх героїв → вибір записує героя в слот і ставить
  `manualSlots[slot]=true`.
- Ручний слот **не перезаписується** автопарсером (ні GSI draft, ні OCR) до кінця гри.
- **Рівні** з OCR підставляються завжди, навіть у ручні слоти.
- Скидання блокувань: кінець гри (POST_GAME) або нова карта (match_seq).

## Автозапуск Windows
- Джерело істини — `userData\settings.json` (`{"autostart": true|false}`, шлях
  `%APPDATA%\DotaVIP\settings.json`); пишеться/читається у main.cjs (readSettings/writeSettings).
  Тому тумблер запам'ятовується і в dev, і в production.
- Перший запуск (нема збереженого значення) → автозапуск ON за замовчуванням; при кожному
  старті значення повторно застосовується до Windows login item (re-assert).
- **Що реєструється в реєстрі** (`HKCU\...\CurrentVersion\Run`): у **dev** реєструється шлях до
  **лаунчера** `C:\Projects\DotaVIP\DotaVIP.exe` (через `setLoginItemSettings({path})`), бо саме він
  піднімає бекенд+vite+electron. У dev запис має ім'я `electron.app.Electron` (косметика, працює).
  У **production** реєструється `process.execPath` (встановлений exe) з арг `--autostart`.
  РАНІШЕ в dev нічого не реєструвалось → не стартувало на завантаженні ПК (виправлено).
- Запуск від Windows-логіна (`--autostart`, тільки prod) → головне вікно НЕ відкривається,
  тільки трей+оверлей.
- Тумблер у ⚙-вікні (IPC `get-autostart`/`set-autostart`).
- Login items у Windows завжди per-user; «для всіх юзерів» досягається тим, що кожен юзер
  при першому запуску отримує автозапуск автоматично.

## Вибір мови
- Перемикач мови (UA/RU/EN) тепер у ⚙-вікні налаштувань (`AppSettings.jsx`), а НЕ в головній
  колонці (звідти прибрано).
- **Вибір мови при першому ВСТАНОВЛЕННІ** — поки НЕ зроблено (TODO, разом з інсталятором).
  Раніше була повноекранна модалка `FirstRunLanguage` на перший запуск додатку — ПРИБРАНА
  (зʼявлялась щоразу, бо в dev localStorage не зберігається стабільно; і логічно це має бути
  крок інсталятора, а не запуску). Інфраструктура частково лишилась: `i18n.js` має
  `isLangChosen()` + `setLang` пише `localStorage.lang_chosen`; i18n-ключі `choose_language`,
  `continue_btn` присутні. Доробити під час роботи над інсталятором.

## Кнопки під ворогом: ВИКУП / УЛЬТ / БКБ (per-slot опції)
- Під портретом ворога — **ВИКУП** (завжди, 8 хв) + до 2 опціональних рядків (УЛЬТ, БКБ).
- Розкладка ДИНАМІЧНА (`rows` у TopBarButtons): опціональні рядки заповнюють місця під ВИКУПом
  по порядку УЛЬТ→БКБ. **Якщо УЛЬТ вимкнено — БКБ піднімається на місце УЛЬТ.** Обидві ON —
  порядок ВИКУП/УЛЬТ/БКБ. **Перший** опціональний рядок завжди несе стрілку ▾ (меню); якщо
  жодного — стрілка лишається окремо на місці УЛЬТ.
- У випадному меню (▾) зверху — блок `SlotOptions`: тумблери **УЛЬТ**/**БКБ**
  (`enemyOpts[slot]`, зберігаються по слоту) + кнопка ⇄ зміни героя.
- БКБ: тип таймера `bkb`, кулдаун **95с**; **Октарін (−25%) також скорочує БКБ** → 71с
  (обробник handleBKB множить на 0.75 якщо `enemyMods[slot].octarine`).
- Обидві опції OFF → лишається тільки ВИКУП + стрілка ▾ «на своєму місці».
- `enemyOpts` скидаються на нову гру (ult:true, bkb:false) разом з рештою пер-ігрового стану.
- Стрілка ▾ ЛИШЕ відкриває/закриває меню; відміна таймера — кліком по самій кнопці-таймері.
- **Закриття меню:** (1) червоний хрестик ✕ у правому верхньому кутку меню; (2) клік деінде по
  оверлею; (3) **клік гравця будь-де в самій грі** — через глобальний хук миші в бекенді.
- Стан відкритого меню винесено в store (`openMenuSlot`, дії `openMenu/closeMenu/toggleMenu`) —
  одне меню за раз, і його може закрити глобальний обробник.

## Click-to-close (клік у грі закриває меню)
- Оверлей click-through, тому клік у грі він сам не бачить. Тому в бекенді — **глобальний хук
  миші** (`mouse` lib, `mouse.on_button(types=('down',))`, НЕ блокує клік для Доти),
  `_start_mouse_listener` у server.py.
- Щоб не було зайвого трафіку: фронт шле WS `{"type":"menu_state","open":bool}` коли меню
  відкривається/закривається (useWebSocket effect на `openMenuSlot`); бекенд форвардить кліки
  (`{"type":"click"}`) ТІЛЬКИ поки `_menu_open`.
- Фронт на `click` закриває меню, АЛЕ лише якщо курсор НЕ над нашим UI — інакше це клік по
  самому меню. «Над UI» відстежує `hooks/overlayInteractive.js` (лічильник, оновлюється в
  `useMouseThrough` enter/leave).
- Залежність: `backend/requirements.txt` + spec hiddenimports мають `mouse==0.7.1`.

## Модифікатори перезарядки (UltPopup)
- **Аркана ПОВНІСТЮ ПРИБРАНА** (і з оверлею, і з браузер-дашборду EnemyPanel, і з тексту гайда).
- Лишився тільки **Octarine Core −25%** (`enemyMods[slot].octarine`) — діє на УЛЬТ і БКБ.
- **Рівні ульти:** селектор рівнів у UltPopup показується ЛИШЕ якщо КД ульти змінюється з рівнем
  (`new Set(cooldowns).size > 1`). Для героїв зі сталим КД (напр. Dragon Knight — однакові 100с
  на всіх рівнях) блок рівнів ховається.

## Підказки (tooltips)
- На всіх кнопках оверлея і випадного меню — нативні `title` (компактний текст при наведенні).
- i18n-ключі: `tip_buyback`, `tip_ult`, `tip_bkb_btn`, `tip_menu`, `tip_opt_ult`, `tip_opt_bkb`,
  `tip_level`, `tip_octarine`, `tip_start` (+ `change_hero` як title кнопки ⇄).

## Що працює
- Оверлей поверх гри, прозорий, не краде фокус, ховається коли Dota не активна.
- FPS не страждає (GPU-композитинг увімкнено; раніше лагало через disableHardwareAcceleration).
- Кнопки Викуп (8 хв) / Ульт під ворогами; таймер показується на місці кнопки; Ctrl+drag переміщення (зберігається).
- Ульт: клік по центру = старт таймера; стрілка ▾ = popup (рівень + Октарін −25%,
  зберігаються) + зміна героя (⇄). БКБ — опціональна кнопка (95с, Октарін теж діє).
- Roshan/Aegis авто-старт з GSI подій (`events` блок); прив'язано до **ігрового часу** (точно, без дрейфу).
  Після завершення іконки повертаються у стартовий стан; Aegis блимає останні 5с і зникає.
- Авто-зчитування ворогів: тримаєш клавішу таблиці → OCR героїв+рівнів → автозаповнення слотів + ульт-рівнів (6/12/18→1/2/3).
- Клавіша таблиці визначається авто (`backend/tracker/dota_keys.py`, поле ScoreboardToggle; аліаси для розкладок).
- GSI авто-встановлюється; майстер (чек-поінти, калібрування, гайд); 3 мови; редактор тексту; масштабування вікна.
- Детект нової гри / кінця гри / паузи (див. «Життєвий цикл гри»).
- Інсталятор збирається і протестований (запакований додаток сам стартує бекенд).

## Відоме / в роботі (TODO)
1. **OCR імен героїв нестабільне** коли гравець на стороні Dire (ворог = Radiant/верх): рівні читаються,
   а імена іноді ні. Координати імен — у `calibration.json` (radiant/dire name_ys, name_left/right).
   Підхід: кілька бінаризацій + зіставлення з назвами (scoreboard.py `_ocr_hero`). Треба ще тюнити
   або просити користувача перекалібрувати на потрібній стороні. Є ручний фолбек (⇄ зміна героя).
2. ✅ **Авто-оновлення** — зроблено (electron-updater + GitHub Releases). Деталі в розділі вище.
   **ЗАЛИШИЛОСЬ:** замінити `GITHUB_USERNAME` у `package.json`, створити репо, перепакувати.
3. **Вибір мови при першому ВСТАНОВЛЕННІ** — інфраструктура є (`isLangChosen`, `lang_chosen`,
   ключі `choose_language`/`continue_btn`), але крок інсталятора ще не зроблено.
4. Можливі покращення онбордингу: відео калібрування, більше скрінів.
5. `win_team` приходить у стейт, але UI ніяк не показує переможця (можна додати банер кінця гри).

## Зроблено (раніше було в TODO)
- ✅ Центрування головного вікна (причина — шаблонний CSS у index.css; виправлено).
- ✅ Бейк тексту в `i18n.js` (об'єкт `T`, **81 ключ**). Процедура повторного бейку: користувач
  редагує через «✎ Текст» → «Експорт» (JSON у буфер) → присилає → регенеруємо блок `T`
  (формат `key: {"ua":...,"ru":...,"en":...}`). NB: правки також у localStorage overrides
  (пріоритет над дефолтом) — після бейку збігаються з дефолтом.
- ✅ Заморозка таймерів на паузі (`usePauseFreeze`, поле `paused`).
- ✅ Фінальний перепак інсталятора з усіма фічами (текст, БКБ, click-to-close, гайд-вікно тощо).
- ✅ Авто-оновлення (electron-updater, GitHub Releases, defer install until Dota closed, UI у ⚙).

## Важливі нюанси / уроки
- Користувач: грає 2560×1440, **Borderless**, монітор 1 (primary), команда буває і Radiant, і Dire.
- Hero key Zeus = `zuus` (внутрішнє ім'я Dota) — це норма, не баг.
- GSI для активного гравця НЕ дає даних ворогів (allplayers порожній, draft порожній) — тому й OCR з екрану.
- GSI ДАЄ: map.matchid, clock_time, paused, win_team, game_state — все парситься (gsi/parser.py).
- Tesseract шлях: `scoreboard.py _find_tesseract()` шукає вбудований біля exe, потім системний.
- Не клади не-ASCII (тире, кирилицю) в `.ps1` без потреби — PowerShell 5.1 ламає парсинг.
- Vite `base: './'` обов'язковий, інакше у запакованому додатку біле вікно (абсолютні шляхи /assets не працюють з file://).
- `index.css` — НЕ повертати шаблонні стилі Vite (#root width/border) — ламає центрування.
- Уникати дорогого: довгі чати + скріншоти = багато токенів. Для дрібних правок — менша модель.

## Команди-діагностика
- Стан: `GET http://127.0.0.1:8765/setup/status` (Dota знайдено, калібровано, tesseract, in_game).
- Що читає OCR: `GET http://127.0.0.1:8765/scoreboard/read?delay=6` (тримай таблицю; повертає raw_name, level).
- Поточний стан гри: `GET http://127.0.0.1:8765/state` (тепер містить match_id, match_seq, paused,
  clock_time, game_over, win_team).
