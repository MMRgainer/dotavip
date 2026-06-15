import { useSyncExternalStore } from 'react';

// ── language state (shared across windows via localStorage) ──────────────────
let lang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ua';
const listeners = new Set();

export function getLang() { return lang; }
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('lang', l); localStorage.setItem('lang_chosen', '1'); } catch {}
  listeners.forEach(fn => fn());
}

// First-run language gate: true once the user has explicitly picked a language.
export function isLangChosen() {
  try { return localStorage.getItem('lang_chosen') === '1'; } catch { return true; }
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === 'lang' && e.newValue) { lang = e.newValue; listeners.forEach(fn => fn()); }
  });
}
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function notify() { listeners.forEach(fn => fn()); }

// ── editable overrides (saved locally; t() prefers them over T) ──────────────
let overrides = {};
try { overrides = JSON.parse(localStorage.getItem('i18n_overrides') || '{}'); } catch {}

export function getOverride(lang, key) { return overrides?.[lang]?.[key]; }
export function setOverride(lang, key, val) {
  overrides[lang] = overrides[lang] || {};
  if (val === '' || val == null) delete overrides[lang][key];
  else overrides[lang][key] = val;
  try { localStorage.setItem('i18n_overrides', JSON.stringify(overrides)); } catch {}
  notify();
}
export function clearOverrides() { overrides = {}; try { localStorage.removeItem('i18n_overrides'); } catch {} notify(); }

/** Merged translations (T + overrides) — for exporting into i18n.js. */
export function exportMerged() {
  const out = {};
  for (const key in T) {
    out[key] = { ...T[key] };
    for (const l of LANGS) {
      const ov = overrides?.[l]?.[key];
      if (ov != null) out[key][l] = ov;
    }
  }
  return out;
}

function resolve(key, l) {
  const ov = overrides?.[l]?.[key];
  if (ov != null) return ov;
  return (T[key] && (T[key][l] ?? T[key].en)) ?? key;
}

export function useLang() { return useSyncExternalStore(subscribe, getLang, getLang); }

export function useT() {
  const l = useLang();
  return (key, vars) => {
    let s = resolve(key, l);
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
    return s;
  };
}

export const LANGS = ['ua', 'ru', 'en'];
export const LANG_LABEL = { ua: 'UA', ru: 'RU', en: 'EN' };

// ── translations ─────────────────────────────────────────────────────────────
export const T = {
  tagline: {"ua":"Помічник для Dota 2","ru":"Помощник для Dota 2","en":"Dota 2 Helper"},
  connected: {"ua":"Підключено до гри","ru":"Подключено к игре","en":"Connected to game"},
  waiting_game: {"ua":"Очікування гри","ru":"Ожидание игры","en":"Waiting for a game"},
  checks_title: {"ua":"СТАН","ru":"СОСТОЯНИЕ","en":"STATUS"},
  chk_link: {"ua":"Звʼязок з Dota налаштовано","ru":"Связь с Dota настроена","en":"Dota connection is set up"},
  chk_reading: {"ua":"Зчитування таблиці готове","ru":"Чтение таблицы готово","en":"Scoreboard reading is ready"},
  chk_waiting: {"ua":"Очікування гри","ru":"Ожидание игры","en":"Waiting for a game"},
  chk_ingame: {"ua":"Гра активна","ru":"Игра активна","en":"In a game"},
  settings_title: {"ua":"Налаштування","ru":"Настройки","en":"Settings"},
  autostart_label: {"ua":"Автозапуск при включенні ПК","ru":"Автозапуск при включении ПК","en":"Start with Windows"},
  autostart_desc: {"ua":"DotaVIP запускатиметься автоматично при вході в Windows і працюватиме у треї.","ru":"DotaVIP будет запускаться автоматически при входе в Windows и работать в трее.","en":"DotaVIP will start automatically when you sign in to Windows and run in the tray."},
  update_ready_label: {"ua":"🆕 Оновлення готове","ru":"🆕 Обновление готово","en":"🆕 Update ready"},
  update_ready_desc: {"ua":"Буде встановлено автоматично після закриття Dota 2. Або встановіть зараз.","ru":"Будет установлено автоматически после закрытия Dota 2. Или установите сейчас.","en":"Will install automatically after Dota 2 closes. Or install now."},
  update_install_btn: {"ua":"Встановити зараз","ru":"Установить сейчас","en":"Install now"},
  change_hero: {"ua":"Змінити героя","ru":"Сменить героя","en":"Change hero"},
  close: {"ua":"Закрити","ru":"Закрыть","en":"Close"},
  language_label: {"ua":"Мова інтерфейсу","ru":"Язык интерфейса","en":"Interface language"},
  language_desc: {"ua":"Мова всіх написів у додатку.","ru":"Язык всех надписей в приложении.","en":"Language of all app text."},
  choose_language: {"ua":"Оберіть мову","ru":"Выберите язык","en":"Choose language"},
  continue_btn: {"ua":"Продовжити","ru":"Продолжить","en":"Continue"},
  bkb: {"ua":"БКБ","ru":"БКБ","en":"BKB"},
  opt_buttons: {"ua":"Кнопки","ru":"Кнопки","en":"Buttons"},
  tip_buyback: {"ua":"Викуп ворога (8 хв). Клік — старт/відміна","ru":"Выкуп врага (8 мин). Клик — старт/отмена","en":"Enemy buyback (8 min). Click to start/cancel"},
  tip_ult: {"ua":"Таймер ульти. Клік — старт/відміна","ru":"Таймер ульты. Клик — старт/отмена","en":"Ultimate timer. Click to start/cancel"},
  tip_bkb_btn: {"ua":"Таймер БКБ (95с). Клік — старт/відміна","ru":"Таймер БКБ (95с). Клик — старт/отмена","en":"BKB timer (95s). Click to start/cancel"},
  tip_menu: {"ua":"Налаштування кнопок","ru":"Настройки кнопок","en":"Button settings"},
  tip_opt_ult: {"ua":"Показувати кнопку ульти","ru":"Показывать кнопку ульты","en":"Show the ultimate button"},
  tip_opt_bkb: {"ua":"Показувати кнопку БКБ","ru":"Показывать кнопку БКБ","en":"Show the BKB button"},
  tip_level: {"ua":"Рівень ульти ворога","ru":"Уровень ульты врага","en":"Enemy ultimate level"},
  tip_octarine: {"ua":"Octarine Core: −25% до перезарядки","ru":"Octarine Core: −25% к перезарядке","en":"Octarine Core: −25% cooldown"},
  tip_start: {"ua":"Запустити таймер ульти","ru":"Запустить таймер ульты","en":"Start the ultimate timer"},
  step2: {"ua":"НАЛАШТУВАННЯ ТАБЛИЦІ","ru":"НАСТРОЙКА ТАБЛИЦЫ","en":"SCOREBOARD SETUP"},
  done: {"ua":"готово","ru":"готово","en":"done"},
  calib_intro: {"ua":"Зайдіть у гру з ботами (5 на 5). Натисніть кнопку нижче — поверніться в гру та відкрийте таблицю рахунку і тримайте її відкритою до 5 секунд. Далі поверніться в це меню, на зробленому знімку з екрану по інструкції вкажіть 5 точок.","ru":"Зайдите в игру с ботами (5 на 5). Нажмите кнопку ниже, вернитесь в игру и откройте таблицу счёта. Далее вернитесь в это меню и на сделанном снимке укажите 5 точек согласно инструкции.","en":"Start a bot match (5v5). Press the button below, then go back to the game and open the scoreboard. After that return to this menu and mark 5 spots on the screenshot according to instructions."},
  start_btn: {"ua":"Почати","ru":"Начать","en":"Start"},
  recalibrate: {"ua":"Зробити заново","ru":"Сделать заново","en":"Redo setup"},
  countdown: {"ua":"Відкрийте таблицю в грі! Знімок за {n}…","ru":"Откройте таблицу в игре! Снимок через {n}…","en":"Open the scoreboard in game! Snapshot in {n}…"},
  step_of: {"ua":"Крок {i} з 5: натисніть на {what}","ru":"Шаг {i} из 5: нажмите на {what}","en":"Step {i} of 5: click {what}"},
  c_level1: {"ua":"ЦИФРУ рівня 1-го гравця ВЕРХНЬОЇ команди","ru":"цифру уровня 1-го игрока ВЕРХНЕЙ команды","en":"the level number of the 1st player of the TOP team"},
  c_rad_first: {"ua":"НАЗВУ героя 1-го гравця ВЕРХНЬОЇ команди (нижній рядок, не нікнейм!)","ru":"НАЗВАНИЕ героя 1-го игрока ВЕРХНЕЙ команды (нижняя строка, не ник!)","en":"the hero name of the 1st player of the TOP team (lower line, not the nickname!)"},
  c_rad_last: {"ua":"НАЗВУ героя 5-го (останнього) гравця ВЕРХНЬОЇ команди","ru":"НАЗВАНИЕ героя 5-го (последнего) игрока ВЕРХНЕЙ команды","en":"the hero name of the 5th (last) player of the TOP team"},
  c_dire_first: {"ua":"НАЗВУ героя 1-го гравця НИЖНЬОЇ команди","ru":"НАЗВАНИЕ героя 1-го игрока НИЖНЕЙ команды","en":"the hero name of the 1st player of the BOTTOM team"},
  c_dire_last: {"ua":"НАЗВУ героя 5-го (останнього) гравця НИЖНЬОЇ команди","ru":"НАЗВАНИЕ героя 5-го (последнего) игрока НИЖНЕЙ команды","en":"the hero name of the 5th (last) player of the BOTTOM team"},
  saving: {"ua":"Зберігаю…","ru":"Сохраняю…","en":"Saving…"},
  calib_saved: {"ua":"Готово! Таблицю налаштовано.","ru":"Готово! Таблица настроена.","en":"Done! Scoreboard is set up."},
  capture_fail: {"ua":"Не вдалося зробити знімок екрана.","ru":"Не удалось сделать снимок экрана.","en":"Could not take a screen snapshot."},
  save_fail: {"ua":"Не вдалося зберегти.","ru":"Не удалось сохранить.","en":"Could not save."},
  try_again: {"ua":"Ще раз","ru":"Ещё раз","en":"Try again"},
  step3: {"ua":"ЯК КОРИСТУВАТИСЬ","ru":"КАК ПОЛЬЗОВАТЬСЯ","en":"HOW TO USE"},
  g_bb_h: {"ua":"Кнопка «Викуп» під ворогом","ru":"Кнопка «Выкуп» под врагом","en":"“Buyback” button under an enemy"},
  g_bb_b: {"ua":"Натисніть, щоб розпочати відлік 8 хвилин. Натисніть ще раз, щоб скинути.","ru":"Нажмите, чтобы запустить отсчёт 8 минут. Нажмите ещё раз, чтобы сбросить.","en":"Click to start an 8-minute countdown. Click again to reset."},
  g_ult_h: {"ua":"Кнопка «Ульт» під ворогом","ru":"Кнопка «Ульт» под врагом","en":"“Ult” button under an enemy"},
  g_ult_b: {"ua":"Натисніть, щоб розпочати відлік перезарядки ульти. Натисніть ще раз, щоб скинути.","ru":"Нажмите, чтобы запустить отсчёт перезарядки ульты. Нажмите ещё раз, чтобы сбросить.","en":"Click to start the ultimate cooldown countdown. Click again to reset."},
  g_menu_h: {"ua":"Випадаюче меню (стрілка ▾)","ru":"Выпадающее меню (стрелка ▾)","en":"Dropdown menu (▾ arrow)"},
  g_menu_b: {"ua":"Відкриває додаткове меню, в якому можна: змінити персонажа суперника (якщо певного героя зчитано неправильно), вручну вибрати рівень ульти (оновлюється автоматично з кожним відкриттям таблиці), додати підсилення (Octarine −25%) та обрати, які кнопки показувати (Ульт/БКБ).","ru":"Открывает дополнительное меню, в котором можно: сменить персонажа врага (если герой выбран неправильно), выбрать уровень ульты вручную (обновляется автоматически с каждым открытием таблицы результатов), добавить усиление (Octarine −25%) и выбрать, какие кнопки показывать (Ульт/БКБ).","en":"Opens an extra menu: change the enemy hero (if the scoreboard was read wrong), pick the ult level, add a bonus (Octarine −25%) and choose which buttons to show (Ult / BKB)."},
  g_bkb_h: {"ua":"Кнопка «БКБ» під ворогом","ru":"Кнопка «БКБ» под врагом","en":"“BKB” button under an enemy"},
  g_bkb_b: {"ua":"Опціональна. Натисніть, щоб розпочати відлік перезарядки БКБ. Вмикається у випадаючому меню (▾).","ru":"Опциональная. Нажмите, чтобы запустить отсчёт перезарядки БКБ (95 с). Включается в выпадающем меню (▾).","en":"Optional. Click to start the BKB cooldown countdown (95s). Enable it in the dropdown menu (▾)."},
  g_rosh_h: {"ua":"Таймер Рошана","ru":"Таймер Рошана","en":"Roshan timer"},
  g_rosh_b: {"ua":"Запускається сам, при вбивстві Рошана. Показує час до наступної появи та таймер закінчення Аегісу.","ru":"Запускается сам, когда убили Рошана. Показывает время до следующего появления и таймер окончания Аегиса.","en":"Starts on its own when Roshan dies. Shows time until respawn. Aegis is tracked too."},
  g_glyph_h: {"ua":"Гліф ворога","ru":"Глиф врага","en":"Enemy glyph"},
  g_glyph_b: {"ua":"Натисніть, щоб розпочати відлік 5 хвилин.","ru":"Нажмите, чтобы запустить отсчёт 5 минут.","en":"Click to start a 5-minute countdown. Click the timer to reset."},
  g_move_h: {"ua":"Переміщення кнопок","ru":"Перемещение кнопок","en":"Moving the buttons"},
  g_move_b: {"ua":"Затисніть Ctrl і тягніть будь-яку кнопку мишкою — вона лишиться там, де поставите.","ru":"Зажмите Ctrl и тяните любую кнопку мышкой — она останется там, где поставите.","en":"Hold Ctrl and drag any button with the mouse — it stays where you put it."},
  g_read_h: {"ua":"Автоматичне розпізнавання ворогів","ru":"Автоматическое распознавание врагов","en":"Automatic enemy detection"},
  g_read_b: {"ua":"Просто відкрийте таблицю рахунку в грі і потримайте 1–2 секунди — вороги та їхні рівні підставляться самі.","ru":"Просто откройте таблицу счёта в игре и подержите 1–2 секунды — враги и их уровни подставятся сами.","en":"Just open the scoreboard in game and hold it for 1–2 seconds — enemies and their levels fill in automatically."},
  g_read_info: {"ua":"Додаток DotaVIP зчитує ваш бінд кнопки таблиці результатів і реагує при натисканні цієї кнопки.","ru":"Приложение DotaVIP считывает ваш бинд кнопки таблицы результатов и реагирует при нажатии этой кнопки.","en":"DotaVIP reads your scoreboard key bind and reacts when you press that key."},
  recalibrate_confirm: {"ua":"Ви впевнені, що хочете пройти калібрування заново? Це зіб'є попереднє налаштування таблиці.","ru":"Вы уверены, что хотите пройти калибровку заново? Это сбросит предыдущую настройку таблицы.","en":"Are you sure you want to recalibrate? This will reset the previous scoreboard setup."},
  guide_title: {"ua":"ГАЙД","ru":"ГАЙД","en":"GUIDE"},
  setup_title: {"ua":"НАЛАШТУВАННЯ","ru":"НАСТРОЙКА","en":"SETUP"},
  calib_btn: {"ua":"Налаштувати таблицю","ru":"Настроить таблицу","en":"Calibrate scoreboard"},
  calib_g1: {"ua":"Зайдіть в Dota 2 та запустіть гру з ботами (5 на 5, самітний режим).","ru":"Зайдите в Dota 2 и запустите игру с ботами (5 на 5, одиночный режим).","en":"Open Dota 2 and start a bot match (5v5, solo mode)."},
  calib_g2: {"ua":"У вас має бути налаштована кнопка «Таблиці результатів».","ru":"У вас должна быть назначена кнопка «Таблицы результатов».","en":"You must have a key bound to open the “Scoreboard”."},
  calib_g3: {"ua":"Натисніть кнопку «Налаштувати таблицю» справа в цьому меню, поверніться в гру та тримайте таблицю результатів відкритою 5 секунд.","ru":"Нажмите кнопку «Настроить таблицу» справа в этом меню, вернитесь в игру и держите таблицу результатов открытой 5 секунд.","en":"Click “Calibrate scoreboard”, return to the game and keep the scoreboard open for 5 seconds."},
  calib_g4: {"ua":"Після цього поверніться в це меню та відмітьте на скріншоті відповідні 5 точок згідно інструкції.","ru":"После этого вернитесь в это меню и отметьте на скриншоте соответствующие 5 точек согласно инструкции.","en":"Then return to this menu and mark the 5 corresponding points on the screenshot per the instructions."},
  footer: {"ua":"Закрите вікно не вимикає програму — вона працює у значку внизу справа (біля годинника). Щоб вийти — правою кнопкою по значку → «Вийти».","ru":"Закрытое окно не выключает программу — она работает в значке внизу справа (возле часов). Чтобы выйти — правой кнопкой по значку → «Выйти».","en":"Closing this window does not stop the app — it keeps running in the tray icon (bottom-right, near the clock). To quit: right-click the icon → “Quit”."},
  bb: {"ua":"Викуп","ru":"Выкуп","en":"Buyback"},
  ult: {"ua":"Ульт","ru":"Ульт","en":"Ult"},
  who_is: {"ua":"Хто це?","ru":"Кто это?","en":"Who is this?"},
  search_hero: {"ua":"Пошук героя…","ru":"Поиск героя…","en":"Search hero…"},
  loading: {"ua":"Завантаження…","ru":"Загрузка…","en":"Loading…"},
  ult_level: {"ua":"РІВЕНЬ УЛЬТИ","ru":"УРОВЕНЬ УЛЬТЫ","en":"ULT LEVEL"},
  bonuses: {"ua":"ПІДСИЛЕННЯ","ru":"УСИЛЕНИЯ","en":"BONUSES"},
  start_timer: {"ua":"Запустити","ru":"Запустить","en":"Start"},
  turbo_hint: {"ua":"Подвійний клік — Турбо/Звичайний","ru":"Двойной клик — Турбо/Обычный","en":"Double-click — Turbo/Normal"},
};
