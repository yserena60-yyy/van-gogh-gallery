import { ui, terms, titles, content } from './locale-zh.js?v=2026-10-06-visitor-guidance';

export const languageStorageKey = 'van-gogh-gallery.language.v1';
const dictionary = new Map([...Object.entries(terms), ...Object.entries(titles), ...Object.entries(ui)]);
const listeners = new Set();
let language = 'en';
try {
  if (globalThis.localStorage?.getItem(languageStorageKey) === 'zh') language = 'zh';
} catch {}

export function currentLanguage() {
  return language;
}

export function registerTranslations(source, translated) {
  if (typeof source === 'string' && typeof translated === 'string') {
    dictionary.set(source, translated);
  } else if (source && translated && typeof source === 'object' && typeof translated === 'object') {
    for (const [key, value] of Object.entries(translated)) {
      if (!(key in source)) throw new Error(`Unknown translation field: ${key}`);
      registerTranslations(source[key], value);
    }
  }
}

export function registerExhibitionTranslations(datasets) {
  for (const [name, source] of Object.entries(datasets)) {
    if (content[name]) registerTranslations(source, content[name]);
  }
  refreshLanguage();
}

function translateDate(text) {
  const approximateYear = text.match(/^(?:c\.|About|about)\s*(\d{4})$/u);
  if (approximateYear) return `约${approximateYear[1]}年`;
  const match = text.match(/^(.+?)\s+(\d{4})$/u);
  if (!match) return null;
  const approximate = /^(?:c\.|About|about)\s+/u.test(match[1]);
  const period = match[1].replace(/^(?:c\.|About|about)\s+/u, '');
  const year = `${approximate ? '约' : ''}${match[2]}年`;
  if (/^(?:early|Early|late)$/u.test(period)) return `${year}${period.toLowerCase() === 'late' ? '末' : '初'}`;
  const months = 'January|February|Februari|March|April|May|June|July|August|September|October|November|December';
  const dayRange = period.match(new RegExp(`^(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+(${months})$`, 'u'));
  if (dayRange) return `${year}${dictionary.get(dayRange[3]) ?? '2月'}${dayRange[1]}日至${dayRange[2]}日`;

  function endpoint(value) {
    const day = value.match(new RegExp(`^(\\d{1,2})\\s+(${months})$`, 'u'));
    if (day) return `${dictionary.get(day[2]) ?? '2月'}${day[1]}日`;
    const date = value.match(new RegExp(`^(?:(early|Early|late|mid-|beginning of)\\s*)?(${months}|Spring|Summer|Autumn|Winter|spring|summer|autumn|winter)$`, 'u'));
    if (!date) return null;
    const seasons = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
    const name = dictionary.get(date[2]) ?? seasons[date[2].toLowerCase()] ?? '2月';
    const position = { early: '初', late: '下旬', 'mid-': '中旬', 'beginning of': '初' }[date[1]?.toLowerCase()] ?? '';
    if (seasons[date[2].toLowerCase()] && position) return `${name.slice(0, -1)}${position === '下旬' ? '末' : position === '中旬' ? '中' : '初'}`;
    return name + position;
  }

  const direct = endpoint(period);
  if (direct) return year + direct;
  const endpoints = period.split(/(?<!mid)\s*[-–]\s*/u).filter(Boolean);
  if (endpoints.length === 2) {
    const translated = endpoints.map(endpoint);
    if (translated.every(Boolean)) return year + translated.join('至');
  }
  return null;
}

function translatePart(text) {
  if (dictionary.has(text)) return dictionary.get(text);
  const quotation = text.match(/^“(.+)”$/su);
  if (quotation) return `“${translatePart(quotation[1])}”`;
  const ending = text.match(/^(.+?)(\s*[+↗→↔])$/u);
  if (ending) return `${translatePart(ending[1])}${ending[2]}`;
  const date = translateDate(text);
  if (date) return date;
  const rules = [
    [/^Enter Hall (\d{2})$/u, (match, number) => `进入第${Number(number)}厅`],
    [/^Browse Hall (\d{2}): (.+)$/u, (match, number, title) => `浏览第${Number(number)}厅：${translatePart(title)}`],
    [/^Hall (\d{2})(.*)$/u, (match, number, rest) => `第${Number(number)}厅${translatePart(rest)}`],
    [/^HALL (\d{2})(.*)$/u, (match, number, rest) => `第${Number(number)}厅${translatePart(rest)}`],
    [/^CHAPTER (\d{2})\s*\/\s*INTRODUCTION$/u, (match, number) => `第${Number(number)}厅 / 序语`],
    [/^AFTERLIFE\s*\/\s*(\d+)$/u, (match, number) => `身后回响 / ${number}`],
    [/^(\d+)s per work$/u, (match, seconds) => `每幅停留${seconds}秒`],
    [/^← Back to (.+)$/u, (match, title) => `← 返回${translatePart(title)}`],
    [/^Explore (.+)$/u, (match, title) => `探索${translatePart(title)}`],
    [/^Compare with (.+)$/u, (match, title) => `与《${translatePart(title)}》比较`],
    [/^Stories in (.+)$/u, (match, title) => `${translatePart(title)}的故事`],
    [/^(.+) chapters$/u, (match, title) => `${translatePart(title)}的章节`],
    [/^Enlarge (.+) image$/u, (match, title) => `放大${translatePart(title)}的图片`],
    [/^Reduce (.+) image$/u, (match, title) => '还原《' + translatePart(title) + '》的图片大小'],
    [/^Enlarge (.+)$/u, (match, title) => `放大${translatePart(title)}`],
    [/^Letter (\d+)$/u, (match, number) => `第${number}封信`],
    [/^Section (\d+) \/ (\d+) · Story (\d+) \/ (\d+)$/u, (match, section, totalSections, story, totalStories) => `篇章 ${section}/${totalSections} · 故事 ${story}/${totalStories}`],
    [/^Made in (.+?)\. Medium: (.+?)\. This entry identifies the (.+?) work \((.+?)\)\. Same-title paintings, studies and later repetitions are catalogued separately\.$/u,
      (match, place, medium, institution, identifiers) => `创作于${translatePart(place)}。媒材：${translatePart(medium)}。本条目对应${translatePart(institution)}藏品（${identifiers}）。同名绘画、习作与后来的重复版本分别编目。`],
    [/^Medium: (.+)$/u, (match, medium) => `媒材：${translatePart(medium)}`],
    [/^On these walls (\d+)$/u, (match, page) => `当前墙组 ${page}`],
    [/^View wall set (\d+)$/u, (match, page) => `查看墙组 ${page}`],
    [/^Wall set (\d+) of (\d+)(.*)$/u, (match, page, total, rest) => `墙组 ${page}/${total}${translatePart(rest)}`],
    [/^(\d+) verified works$/u, (match, count) => `${count}件已核实作品`],
    [/^(\d+) highlight positions$/u, (match, count) => `${count}个精选展位`],
    [/^(\d+) installed works$/u, (match, count) => `${count}件已布展作品`],
    [/^(\d+) works$/u, (match, count) => `${count}件作品`],
    [/^(\d+) works on these walls$/u, (match, count) => `当前墙组展示${count}件作品`],
    [/^(\d+) research leads$/u, (match, count) => `${count}条研究线索`],
    [/^(\d+) sections$/u, (match, count) => `${count}个篇章`],
    [/^Full collection(?: tour)?(?: ·)? (\d+) works$/u, (match, count) => `完整收藏 · ${count}件作品`],
    [/^(.+?) \((\d+)\)$/u, (match, title, count) => `${translatePart(title)}（${count}）`],
    [/^(\d{4}); reworked in (.+)$/u, (match, year, revised) => `${year}年；${translatePart(revised)}重新修改`],
    [/^(\d{4})[–-]((?:early|late) \d{4})$/u, (match, year, end) => `${year}年至${translatePart(end)}`],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  if (text.includes(' and ')) {
    const parts = text.split(' and ').map(translateDate);
    if (parts.every(Boolean)) return parts.join('及');
  }
  for (const separator of [' · ', ' → ', ' / ', ' — ', ': ', ', ']) {
    if (text.includes(separator)) {
      const parts = text.split(separator);
      const localized = parts.map(translatePart);
      return parts.some((part, index) => localized[index] !== part) ? localized.join(separator === ', ' ? '，' : separator) : text;
    }
  }
  return text;
}

export function translate(text, locale = language) {
  if (locale !== 'zh' || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  return text.replace(trimmed, translatePart(trimmed));
}

export function wrapText(context, text, width) {
  const localized = translate(text);
  const tokens = localized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+|\s+/gu) ?? [];
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const candidate = line + token;
    if (line && context.measureText(candidate).width > width && !/^[，。！？；：、）】》]/u.test(token)) {
      lines.push(line.trim());
      line = token.trimStart();
    } else line = candidate;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let refreshDom = () => {};

function refreshLanguage() {
  refreshDom();
  for (const listener of listeners) listener(language);
}

export function setLanguage(next) {
  if (!['en', 'zh'].includes(next) || language === next) return;
  language = next;
  try { globalThis.localStorage?.setItem(languageStorageKey, language); } catch {}
  refreshLanguage();
}

export function mountLanguageSwitch(root = document.body) {
  const control = document.querySelector('#language-switch');
  const buttons = [...control.querySelectorAll('[data-language]')];
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const dialogSelector = 'dialog, [role="dialog"][aria-modal="true"]';
  const openDialogs = [...document.querySelectorAll(dialogSelector)].filter(isOpenDialog);
  const ignored = 'script, style, textarea, [translate="no"], #language-switch';
  const attributeNames = ['aria-label', 'title', 'placeholder', 'alt'];

  function isOpenDialog(dialog) {
    return dialog.tagName === 'DIALOG' ? dialog.open : !dialog.hidden && !dialog.inert && dialog.getAttribute('aria-hidden') !== 'true';
  }

  function localizeText(node) {
    if (!node.parentElement || node.parentElement.closest(ignored)) return;
    const previous = originals.get(node);
    const original = previous && node.data === previous.localized ? previous.original : node.data;
    const localized = translate(original);
    originals.set(node, { original, localized });
    if (node.data !== localized) node.data = localized;
  }

  function localizeAttribute(element, name) {
    if (!element.hasAttribute(name) || element.closest(ignored)) return;
    let records = attributes.get(element);
    if (!records) { records = new Map(); attributes.set(element, records); }
    const current = element.getAttribute(name);
    const previous = records.get(name);
    const original = previous && current === previous.localized ? previous.original : current;
    const localized = translate(original);
    records.set(name, { original, localized });
    if (current !== localized) element.setAttribute(name, localized);
  }

  function localizeTree(node) {
    if (node.nodeType === Node.TEXT_NODE) { localizeText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(ignored)) return;
    for (const name of attributeNames) localizeAttribute(node, name);
    for (const child of node.childNodes) localizeTree(child);
  }

  function placeControl() {
    const parent = openDialogs.filter(isOpenDialog).at(-1) ?? root;
    if (control.parentElement !== parent) parent.append(control);
    control.classList.toggle('language-switch-modal', parent !== root && parent.id !== 'gallery-entry');
  }

  refreshDom = () => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = translate('Vincent van Gogh · A Life Through Art');
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.language === language));
    control.setAttribute('aria-label', language === 'zh' ? '语言选择' : 'Choose language');
    localizeTree(root);
    placeControl();
  };
  control.addEventListener('click', (event) => {
    event.stopPropagation();
    const button = event.target.closest('[data-language]');
    if (button) setLanguage(button.dataset.language);
  });
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'keyup']) control.addEventListener(type, (event) => {
    if (event.key !== 'Tab') event.stopPropagation();
  });
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') localizeText(record.target);
      if (record.type === 'childList') for (const node of record.addedNodes) localizeTree(node);
      if (record.type === 'attributes') {
        if (['open', 'hidden', 'inert', 'aria-hidden'].includes(record.attributeName) && record.target.matches(dialogSelector)) {
          const index = openDialogs.indexOf(record.target);
          if (index !== -1) openDialogs.splice(index, 1);
          if (isOpenDialog(record.target)) openDialogs.push(record.target);
          placeControl();
        } else localizeAttribute(record.target, record.attributeName);
      }
    }
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: [...attributeNames, 'open', 'hidden', 'inert', 'aria-hidden'] });
  refreshLanguage();
  return () => { observer.disconnect(); refreshDom = () => {}; };
}
