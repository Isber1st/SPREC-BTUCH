import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const screenshotDir = path.join(__dirname, 'screenshots');

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 1000 },
];

const themes = ['light', 'dark'];

const cases = [
  { codigoCaso: '01250007', tColSangre: '12-04-26 08:55', tColOrina0: '', mes: 'Abril', nTubosEDTA: 1, nTubosSERUM: 0, nTubosURINE: 0, creado: '12-04-26 09:00' },
  { codigoCaso: '11250009', tColSangre: '11-04-26 16:42', tColOrina0: '', mes: 'Abril', nTubosEDTA: 1, nTubosSERUM: 0, nTubosURINE: 0, creado: '11-04-26 16:45' },
  { codigoCaso: '05250008', tColSangre: '02-10-25 08:35', tColOrina0: '02-10-25 08:35', mes: 'Octubre', nTubosEDTA: 2, nTubosSERUM: 2, nTubosURINE: 1, creado: '02-10-25 08:40' },
  { codigoCaso: '02250030', tColSangre: '03-10-25 14:54', tColOrina0: '', mes: 'Octubre', nTubosEDTA: 1, nTubosSERUM: 0, nTubosURINE: 0, creado: '03-10-25 15:00' },
  { codigoCaso: '13250261', tColSangre: '07-10-25 12:43', tColOrina0: '07-10-25 12:43', mes: 'Octubre', nTubosEDTA: 2, nTubosSERUM: 1, nTubosURINE: 1, creado: '07-10-25 12:50' },
  { codigoCaso: '04260002', tColSangre: '', tColOrina0: '10-04-26 18:35', mes: 'Abril', nTubosEDTA: 0, nTubosSERUM: 0, nTubosURINE: 1, creado: '10-04-26 18:40' },
];

const status = Object.fromEntries(cases.map((item) => [
  item.codigoCaso,
  {
    processed: { plasma: false, serum: false, urine: false },
    pendingBlood: item.nTubosEDTA > 0 || item.nTubosSERUM > 0,
    pendingUrine: item.nTubosURINE > 0,
    nEDTA: item.nTubosEDTA,
    nSER: item.nTubosSERUM,
    nURI: item.nTubosURINE,
  },
]));

const historyRows = [
  {
    fechaEnvio: '12/04/26 11:48',
    envioId: 'ENV-20260412-114800-abc',
    responsable: 'Usuario Validacion',
    email: 'validacion@example.com',
    casos: ['05250008', '13250261'],
    totalFilas: 12,
    plasmaTotal: 5,
    serumTotal: 3,
    urineTotal: 4,
    ubcTotal: 1,
    obs: '',
    kind: 'blood',
  },
  {
    fechaEnvio: '12/04/26 12:12',
    envioId: 'ENV-20260412-121200-def',
    responsable: 'Usuario Validacion',
    email: 'validacion@example.com',
    casos: ['04260002'],
    totalFilas: 2,
    plasmaTotal: 0,
    serumTotal: 0,
    urineTotal: 2,
    ubcTotal: 0,
    obs: '',
    kind: 'urine',
  },
];

function mockAppsScript(mockData) {
  const { cases, status, historyRows, theme = 'light' } = mockData;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const responseFor = (method, args) => {
    switch (method) {
      case 'uiMe':
        return { ok: true, data: { name: 'Usuario Validacion', email: 'validacion@example.com' } };
      case 'uiListCasesAndStatus':
        return { ok: true, data: { cases: clone(cases), status: clone(status) } };
      case 'uiCreateOrUpdateCase':
        return { ok: true, data: { caseCode: args[0]?.caseCode || '00000000', responsable: 'Usuario Validacion' } };
      case 'uiGenerateRows2':
        return { ok: true, data: { generated: 8, envioId: 'ENV-LOCAL-VISUAL', kind: args[0]?.kind || 'blood' } };
      case 'uiDiscardUrine':
      case 'uiDiscardBlood':
        return { ok: true, data: { caseCode: args[0]?.caseCode || '00000000' } };
      case 'uiListHistory':
        return { ok: true, data: clone(historyRows) };
      case 'uiCheckCaseExists':
        return { ok: true, data: { exists: false } };
      default:
        return { ok: false, error: `Mock sin handler para ${method}` };
    }
  };

  const makeRunner = (success = () => {}, failure = () => {}) => new Proxy({}, {
    get(_target, property) {
      if (property === 'withSuccessHandler') return (handler) => makeRunner(handler, failure);
      if (property === 'withFailureHandler') return (handler) => makeRunner(success, handler);
      return (...args) => {
        window.setTimeout(() => {
          try {
            success(responseFor(String(property), args));
          } catch (error) {
            failure(error);
          }
        }, 20);
      };
    },
  });

  window.google = { script: { run: makeRunner() } };
  window.Html5Qrcode = class {
    constructor() {}
    start() { return Promise.resolve(); }
    stop() { return Promise.resolve(); }
  };
  window.confirm = () => true;
  window.alert = (message) => console.warn(`alert: ${message}`);
  try {
    window.localStorage.setItem('theme', theme);
  } catch (_error) {
    // Local storage can be unavailable in some isolated browser contexts.
  }
}

async function createPage(browser, viewport, theme) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.name === 'mobile' ? 2 : 1,
    isMobile: viewport.name === 'mobile',
    hasTouch: viewport.name === 'mobile',
    colorScheme: theme,
  });
  await context.addInitScript(mockAppsScript, { cases, status, historyRows, theme });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const meBox = document.querySelector('#meBox');
    return meBox && meBox.textContent && !meBox.textContent.includes('Cargando');
  }, null, { timeout: 7000 });
  if (pageErrors.length) {
    throw new Error(`Errores de pagina en ${theme}/${viewport.name}:\n${pageErrors.join('\n')}`);
  }
  return { context, page };
}

async function ensureNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    viewport: document.documentElement.clientWidth,
    htmlWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  if (overflow.html > 2 || overflow.body > 2) {
    throw new Error(`${label}: overflow horizontal detectado ${JSON.stringify(overflow)}`);
  }
}

async function ensureMobileNowButtonsStacked(page, label) {
  const badControls = await page.evaluate(() => {
    return [...document.querySelectorAll('.panel.active .time-control')]
      .filter((control) => {
        const rect = control.getBoundingClientRect();
        const styles = window.getComputedStyle(control);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden' && styles.display !== 'none';
      })
      .map((control) => {
        const input = control.querySelector('input');
        const button = control.querySelector('.btn-now');
        if (!input || !button) return null;
        const inputRect = input.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const stacked = buttonRect.top >= inputRect.bottom + 4;
        return stacked ? null : {
          inputBottom: inputRect.bottom,
          buttonTop: buttonRect.top,
          text: control.textContent.trim().replace(/\s+/g, ' '),
        };
      })
      .filter(Boolean);
  });
  if (badControls.length) {
    throw new Error(`${label}: boton Ahora no esta bajo el input ${JSON.stringify(badControls)}`);
  }
}

async function ensureMobileRegistrationActionsAreInline(page, label) {
  const position = await page.evaluate(() => {
    const actions = document.querySelector('#t1 .right');
    return actions ? window.getComputedStyle(actions).position : null;
  });
  if (position !== 'static') {
    throw new Error(`${label}: acciones de registro mobile no estan en flujo normal (${position})`);
  }
}

async function ensureCheckboxesCompact(page, label) {
  const oversized = await page.evaluate(() => {
    return [...document.querySelectorAll('input[type="checkbox"]')]
      .filter((checkbox) => {
        const rect = checkbox.getBoundingClientRect();
        const styles = window.getComputedStyle(checkbox);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden' && styles.display !== 'none';
      })
      .map((checkbox) => {
        const rect = checkbox.getBoundingClientRect();
        return rect.width <= 28 && rect.height <= 28 ? null : {
          id: checkbox.id,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter(Boolean);
  });
  if (oversized.length) {
    throw new Error(`${label}: checkbox sobredimensionado ${JSON.stringify(oversized)}`);
  }
}

async function ensureTabsBelowHeader(page, label) {
  const metrics = await page.evaluate(() => {
    const header = document.querySelector('header');
    const tabs = document.querySelector('.tabs');
    if (!header || !tabs) return null;
    const headerRect = header.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    return {
      headerBottom: headerRect.bottom,
      tabsTop: tabsRect.top,
      scrollY: window.scrollY,
    };
  });
  if (!metrics) throw new Error(`${label}: no se pudieron medir header/tabs`);
  if (metrics.tabsTop < metrics.headerBottom - 2) {
    throw new Error(`${label}: tabs bajo header ${JSON.stringify(metrics)}`);
  }
}

async function ensureDarkModeReadableText(page, label) {
  const lowContrast = await page.evaluate(() => {
    if (!document.body.classList.contains('dark-mode')) return [];
    const selectors = [
      '.panel.active h2',
      '.panel.active h3',
      '.panel.active h4',
      '.panel.active label',
      '.panel.active .case-card-code',
      '.panel.active .case-card-meta',
      '.panel.active .sample-type-item',
      '.panel.active .history-table tbody td',
    ].join(',');

    const parseRgb = (value) => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? match.slice(1, 4).map(Number) : null;
    };

    return [...document.querySelectorAll(selectors)]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden' && styles.display !== 'none';
      })
      .map((element) => {
        const color = window.getComputedStyle(element).color;
        const rgb = parseRgb(color);
        if (!rgb) return null;
        const brightestChannel = Math.max(...rgb);
        return brightestChannel >= 110 ? null : {
          tag: element.tagName.toLowerCase(),
          selectorHint: element.className || element.id || element.textContent.trim().slice(0, 32),
          color,
          text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 48),
        };
      })
      .filter(Boolean);
  });

  if (lowContrast.length) {
    throw new Error(`${label}: texto oscuro en modo oscuro ${JSON.stringify(lowContrast)}`);
  }
}

async function ensureModalVisible(page, label) {
  await page.waitForSelector('#modalBG', { state: 'visible', timeout: 5000 });
  const modal = await page.locator('.app-modal').first().boundingBox();
  if (!modal || modal.width < 160 || modal.height < 90) {
    throw new Error(`${label}: modal no visible o demasiado pequeno`);
  }
}

async function screenshot(page, themeName, viewportName, stateName) {
  const file = path.join(screenshotDir, `${themeName}-${viewportName}-${stateName}.png`);
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);
  await page.screenshot({ path: file, fullPage: true });
  await page.evaluate(({ x, y }) => window.scrollTo(x, y), scroll);
}

async function runScenario(browser, viewport, theme) {
  const labelPrefix = `${theme} ${viewport.name}`;
  const { context, page } = await createPage(browser, viewport, theme);
  try {
    await ensureNoHorizontalOverflow(page, `${labelPrefix} registro`);
    if (viewport.name === 'mobile') await ensureMobileRegistrationActionsAreInline(page, `${labelPrefix} registro`);
    if (theme === 'dark') await ensureDarkModeReadableText(page, `${labelPrefix} registro`);
    await screenshot(page, theme, viewport.name, 'registro');

    await page.fill('#c_case', '99250001');
    await page.click('#selector-edta');
    await page.fill('#c_coll_s', '2026-04-12T11:43');
    await page.fill('#c_edta', '1');
    if (viewport.name === 'mobile') await ensureMobileNowButtonsStacked(page, `${labelPrefix} registro`);
    await page.click('#btnSave');
    await ensureModalVisible(page, `${labelPrefix} guardar`);
    await screenshot(page, theme, viewport.name, 'modal-guardar');
    await page.click('#modalOK');

    await page.click('.tab[data-tab="t2a"]');
    await page.waitForSelector('#listA .case-card');
    if (viewport.name !== 'mobile') await ensureTabsBelowHeader(page, `${labelPrefix} tabs sangre`);
    await page.click('#listA .case-card:first-child [data-action="add"]');
    await page.fill('#p_d1', '2026-04-12T11:00');
    await page.fill('#p_e1', '2026-04-12T11:20');
    await page.fill('#p_g1s', '2026-04-12T11:45');
    if (viewport.name === 'mobile') await ensureMobileNowButtonsStacked(page, `${labelPrefix} sangre`);
    await ensureCheckboxesCompact(page, `${labelPrefix} sangre`);
    await ensureNoHorizontalOverflow(page, `${labelPrefix} sangre`);
    if (theme === 'dark') await ensureDarkModeReadableText(page, `${labelPrefix} sangre`);
    await screenshot(page, theme, viewport.name, 'sangre');
    await page.click('#btnGenA');
    await ensureModalVisible(page, `${labelPrefix} generar sangre`);
    await page.click('#modalOK');

    await page.click('.tab[data-tab="t2b"]');
    await page.waitForSelector('#listB .case-card');
    if (viewport.name !== 'mobile') await ensureTabsBelowHeader(page, `${labelPrefix} tabs orina`);
    await page.click('#listB .case-card:first-child [data-action="add"]');
    await page.fill('#p_g1u', '2026-04-12T12:05');
    if (viewport.name === 'mobile') await ensureMobileNowButtonsStacked(page, `${labelPrefix} orina`);
    await ensureNoHorizontalOverflow(page, `${labelPrefix} orina`);
    if (theme === 'dark') await ensureDarkModeReadableText(page, `${labelPrefix} orina`);
    await screenshot(page, theme, viewport.name, 'orina');
    await page.click('#btnGenB');
    await ensureModalVisible(page, `${labelPrefix} generar orina`);
    await page.click('#modalOK');

    await page.click('.tab[data-tab="t3"]');
    await page.waitForSelector('#histTbody tr');
    if (viewport.name !== 'mobile') await ensureTabsBelowHeader(page, `${labelPrefix} tabs historial`);
    await ensureNoHorizontalOverflow(page, `${labelPrefix} historial`);
    if (theme === 'dark') await ensureDarkModeReadableText(page, `${labelPrefix} historial`);
    await screenshot(page, theme, viewport.name, 'historial');
  } finally {
    await context.close();
  }
}

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const theme of themes) {
    for (const viewport of viewports) {
      console.log(`Validando ${theme}/${viewport.name} (${viewport.width}x${viewport.height})...`);
      await runScenario(browser, viewport, theme);
    }
  }
  console.log(`OK: capturas generadas en ${path.relative(projectRoot, screenshotDir)}`);
} finally {
  await browser.close();
}
