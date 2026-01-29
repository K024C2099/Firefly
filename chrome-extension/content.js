let db = null
fetch(chrome.runtime.getURL("ejdict.json"))
    .then(res => res.json())
    .then(json => {
        db = Object.create(null);
        for (const [key, value] of Object.entries(json)) {
            db[key.toLocaleLowerCase()] = value;
        }
    });

let enabled = false;
let popupReady = false;
let popupShadow = null;
let isHoveringPopup = false;

(async () => {
    const data = await chrome.storage.local.get("enabled");
    enabled = Boolean(data.enabled);
    updateExtensionState(enabled);
})();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.enabled) {
        enabled = Boolean(changes.enabled.newValue);
        updateExtensionState(enabled);
    }
});

function updateExtensionState(isOn) {
    if (!isOn) {
        clearContent();
    }
}

fetch(chrome.runtime.getURL('template1.html'))
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('template');
        if (!template) return;

        const wrapper = document.createElement('div');
        const shadow = wrapper.attachShadow({ mode: 'open' });

        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = chrome.runtime.getURL('template1.css');

        shadow.appendChild(css);
        shadow.appendChild(template.content.cloneNode(true));

        document.body.appendChild(wrapper);
        window.hoverPopup = wrapper;
        popupShadow = shadow;
        popupReady = true;

        clearContent();

        wrapper.addEventListener("mouseenter", () => {
            isHoveringPopup = true;
        });
        wrapper.addEventListener("mouseleave", () => {
            isHoveringPopup = false;
            clearContent();
        });
    });

function clearContent() {
    if (!popupReady) return;
    if (isHoveringPopup) return;
    window.hoverPopup.style.display = 'none';
    currentWord = null;
}
function normalizeLookupKey(raw) {
    if (!raw) return "";

    let word = raw
        .toLowerCase()
        .replace(/^[^a-z]+|[^a-z]+$/g, "");

    if (!word) return "";

    if (word.endsWith("ies") && word.length > 4) {
        word =  word.slice(0, -3) + "y";
    }
    if (
        word.endsWith("es") &&
        word.length > 4 &&
        /(?:ches|shes|sses|xes|zes)$/.test(word)
    ) {
        word = word.slice(0, -2);
    }
    if (
        word.endsWith("s") &&
        word.length > 3 &&
        !word.endsWith("ss")
    ) {
        word =  word.slice(0, -1);
    }

    // verb forms
    if (word.endsWith("ing") && word.length > 5) {
        word = word.slice(0, -3);
    } else if (word.endsWith("ed") && word.length > 4) {
        word = word.slice(0, -2);
    }

    return word;
}
function setContent(key, rect) {
    if (!popupReady) return;
    if (!db) return;
    window.hoverPopup.style.display = 'inline-block';
    key = normalizeLookupKey(key);
    entry = db[key.toLocaleLowerCase()];
    if (!entry) {
        popupShadow.querySelector('.word').textContent = key;
        popupShadow.querySelector('.meaning').textContent = "?";
    } else {
        popupShadow.querySelector('.word').textContent = key;
        popupShadow.querySelector('.meaning').textContent = entry;
    }
    //const text = db[key] ? `${key}: ${db[key].read} -> ${db[key].mean}` : "null";
    window.hoverPopup.style.position = 'fixed';
    window.hoverPopup.style.left = `${rect.x}px`;
    window.hoverPopup.style.top = `${(rect.y - 80)}px`;
    //const size = popupShadow.querySelector('.word').getBoundingClientRect().width;
    //window.hoverPopup.style.width = `${size}`;
}

const segmenter = new Intl.Segmenter("en", { granularity: "word" });
const segCache = new WeakMap();

function getSegOnNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return [];
    if (!segCache.has(node)) {
        const segments = [...segmenter.segment(node.textContent)];
        segCache.set(node, segments);
    }
    return segCache.get(node);
}

function getWordUnicode(node, offset) {
    if (!node || offset < 0) return null;

    for (const segment of getSegOnNode(node)) {
        if ((offset - segment.index) >>> 0 < segment.segment.length) {/* offset in between */
            return (/\p{L}/u.test(segment.segment))
                ? { word: segment.segment, start: segment.index, end: segment.index + segment.segment.length }
                : null;
        }
    }
    return null;
}

let currentWord = null;

document.addEventListener("mousemove", (e) => {
    if (!enabled || !popupReady) return;

    let pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
        ?? (() => {
            const legacy = document.caretRangeFromPoint?.(e.clientX, e.clientY);
            return legacy ? { offsetNode: legacy.startContainer, offset: legacy.startOffset } : null;
        })();

    if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE) {
        clearContent();
        return;
    }

    const result = getWordUnicode(pos.offsetNode, pos.offset);
    if (!result) {
        clearContent();
        return;
    }

    const { word, start, end } = result;
    if (currentWord === word) {
        return;
    }
    currentWord = word;

    const range = document.createRange();
    range.setStart(pos.offsetNode, start);
    range.setEnd(pos.offsetNode, end);
    const rect = range.getBoundingClientRect();

    requestAnimationFrame(() => setContent(word.toLowerCase(), rect));
});
