import { eventSource, event_types } from '../../../../script.js';

const LOG_PREFIX = '[NemoPresetExt-ZH]';
const EXTENSION_ROOT = new URL('.', import.meta.url);
const DICTIONARY_URL = new URL('i18n/zh-cn.json', EXTENSION_ROOT);

const TARGET_SELECTORS = [
    '#nemo-preset-ext-settings',
    '#nemoReasoningSection',
    '#nemoLorebookSection',
    '#nemo_lore_settings',
    '#nemo_rewrite_settings',
    '#nemo-world-info-redesign',
    '#WorldInfo',
    '#nemo-root',
    '.nemo-category-tray',
    '.nemo-lore-settings',
    '.nemo-rewrite-settings',
    '.nemo-rewrite-menu',
    '.nemo-prompt-navigator-content-wrapper',
    '.nemo-theme-change-notice',
    '.nemo-mobile-theme-banner',
    '.nemo-mobile-theme-blocked-notice',
    '.nemo-preset-enhancer-settings',
    '.nemo-world-info-container',
    '.nemo-settings-body',
    '.nemo-command-overlay',
    '.nemo-toolbar',
    '.popup',
    '.popup_outer',
    '.toast',
].join(',');

const SKIP_SELECTORS = [
    'script',
    'style',
    'textarea',
    'pre',
    'code',
    'kbd',
    '[data-nemo-zh-skip]',
    '.mes',
    '#chat',
    '#chat .mes_text',
    '.completion_prompt_manager_prompt_name',
    '.nemo-prompt-card-title',
    '.nemo-tray-title',
    '.nemo-tray-subsection-name',
    '.nemo-preset-name',
    '.nemo-preview-content',
    '.nemo-var-resolved',
    '.nemo-macro-unresolved',
].join(',');

const TRANSLATABLE_ATTRIBUTES = ['title', 'placeholder', 'aria-label'];
const observedRoots = new WeakMap();

let dictionary = {};
let started = false;
let bodyObserver = null;

function normalizeLocale(locale) {
    return String(locale || '').toLowerCase().replace('_', '-');
}

function isChineseLocale() {
    const contextLocale = (() => {
        try {
            const context = window.SillyTavern?.getContext?.() || window.getContext?.();
            return context?.power_user?.language || context?.power_user?.locale || '';
        } catch {
            return '';
        }
    })();

    const candidates = [
        document.documentElement?.lang,
        document.body?.dataset?.locale,
        document.body?.dataset?.language,
        contextLocale,
        navigator.language,
        ...(navigator.languages || []),
    ].map(normalizeLocale);

    return candidates.some(locale => locale === 'zh' || locale.startsWith('zh-'));
}

function getLookupKey(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatValue(value, replacements = []) {
    return value.replace(/\$\{(\d+)}/g, (_, index) => {
        const replacement = replacements[Number(index)];
        return replacement === undefined ? '' : String(replacement);
    });
}

function translatePattern(key) {
    const patterns = [
        [/^Invalid Regex part: (.+)$/u, 'Invalid Regex part: ${0}'],
        [/^Trimmed (\d+) messages, saved (\d+) chars$/u, 'Trimmed ${0} messages, saved ${1} chars'],
        [/^Error: (.+)$/u, 'Error: ${0}'],
        [/^Requires: (.+)$/u, 'Requires: ${0}'],
        [/^Mutually exclusive group: (.+)$/u, 'Mutually exclusive group: ${0}'],
        [/^Only one active in category: (.+)$/u, 'Only one active in category: ${0}'],
        [/^Exclusive with: (.+)$/u, 'Exclusive with: ${0}'],
        [/^Conflicts with: (.+)$/u, 'Conflicts with: ${0}'],
        [/^Preset "(.+)" updated\.$/u, 'Preset "${0}" updated.'],
        [/^Are you sure you want to delete the preset "(.+)"\?$/u, 'Are you sure you want to delete the preset "${0}"?'],
        [/^A preset named "(.+)" already exists\. Overwrite it\?$/u, 'A preset named "${0}" already exists. Overwrite it?'],
        [/^Are you sure you want to delete the folder "(.+)"\? Lorebooks inside will be moved to the unassigned area\.$/u, 'Are you sure you want to delete the folder "${0}"? Lorebooks inside will be moved to the unassigned area.'],
        [/^Settings for (.+)$/u, 'Settings for ${0}'],
        [/^Leave a note for (.+)$/u, 'Leave a note for ${0}'],
    ];

    for (const [regex, translationKey] of patterns) {
        const match = key.match(regex);
        if (!match) {
            continue;
        }

        const translated = dictionary[translationKey];
        if (translated) {
            return formatValue(translated, match.slice(1));
        }
    }

    return '';
}

function translate(value) {
    const key = getLookupKey(value);
    if (!key) {
        return '';
    }

    return dictionary[key] || translatePattern(key) || '';
}

function shouldSkipElement(element) {
    return !element || element.closest(SKIP_SELECTORS);
}

function isTargetElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    return Boolean(
        element.matches(TARGET_SELECTORS) ||
        element.closest(TARGET_SELECTORS) ||
        element.querySelector(TARGET_SELECTORS)
    );
}

function translateTextNode(node) {
    const original = node.nodeValue;
    const translated = translate(original);
    if (!translated) {
        return;
    }

    const leading = original.match(/^\s*/u)?.[0] || '';
    const trailing = original.match(/\s*$/u)?.[0] || '';
    node.nodeValue = `${leading}${translated}${trailing}`;
}

function translateAttributes(element) {
    if (shouldSkipElement(element)) {
        return;
    }

    for (const attr of TRANSLATABLE_ATTRIBUTES) {
        if (!element.hasAttribute(attr)) {
            continue;
        }

        const translated = translate(element.getAttribute(attr));
        if (translated) {
            element.setAttribute(attr, translated);
        }
    }

    const inputType = element.getAttribute('type');
    const canTranslateValue = element.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(inputType);
    if (canTranslateValue) {
        const translated = translate(element.value);
        if (translated) {
            element.value = translated;
        }
    }
}

function applyTranslations(root) {
    if (!root || !Object.keys(dictionary).length) {
        return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
        if (!shouldSkipElement(root.parentElement)) {
            translateTextNode(root);
        }
        return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        return;
    }

    if (!isTargetElement(root) && root !== document.body) {
        return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
        translateAttributes(root);
    }

    const elements = root.querySelectorAll?.('*') || [];
    elements.forEach(translateAttributes);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return shouldSkipElement(node.parentElement)
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT;
        },
    });

    const nodes = [];
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }
    nodes.forEach(translateTextNode);
}

function observeRoot(root) {
    if (!root || observedRoots.has(root)) {
        return;
    }

    applyTranslations(root);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                applyTranslations(mutation.target);
                continue;
            }

            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    applyTranslations(node);
                } else if (node.nodeType === Node.ELEMENT_NODE && isTargetElement(node)) {
                    applyTranslations(node);
                    discoverRoots(node);
                }
            });
        }
    });

    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });

    observedRoots.set(root, observer);
}

function discoverRoots(scope = document) {
    scope.querySelectorAll?.(TARGET_SELECTORS).forEach(observeRoot);
}

function observeBody() {
    if (bodyObserver || !document.body) {
        return;
    }

    bodyObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }

                if (isTargetElement(node)) {
                    applyTranslations(node);
                    discoverRoots(node);
                }
            });
        }
    });

    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

async function loadDictionary() {
    const response = await fetch(DICTIONARY_URL, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load zh-cn dictionary: HTTP ${response.status}`);
    }

    dictionary = await response.json();

    try {
        const context = window.SillyTavern?.getContext?.() || window.getContext?.();
        context?.addLocaleData?.('zh-cn', dictionary);
    } catch (error) {
        console.debug(`${LOG_PREFIX} addLocaleData skipped`, error);
    }
}

async function start() {
    if (started) {
        return;
    }
    started = true;

    if (!isChineseLocale() && window.NEMO_PRESET_EXT_ZH_FORCE !== true) {
        console.info(`${LOG_PREFIX} Current UI locale is not Chinese; set window.NEMO_PRESET_EXT_ZH_FORCE = true to force patching.`);
        return;
    }

    try {
        await loadDictionary();
        observeBody();
        discoverRoots();

        let scans = 0;
        const scanTimer = setInterval(() => {
            discoverRoots();
            scans += 1;
            if (scans >= 20) {
                clearInterval(scanTimer);
            }
        }, 1000);

        window.NemoPresetExtZH = {
            applyTranslations,
            translate,
            discoverRoots,
        };

        console.info(`${LOG_PREFIX} Loaded ${Object.keys(dictionary).length} translations`);
    } catch (error) {
        console.error(`${LOG_PREFIX} Failed to start`, error);
    }
}

if (event_types?.APP_READY) {
    eventSource?.on?.(event_types.APP_READY, start);
}
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    queueMicrotask(start);
}
