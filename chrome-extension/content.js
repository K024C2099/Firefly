// Run once when content script loads
(async () => {
    const { enabled } = await chrome.storage.local.get("enabled");
    updateExtensionState(enabled);
})();
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "enabled" in changes) {
        const newState = changes.enabled.newValue;
        updateExtensionState(newState);
    }
});
function updateExtensionState(isOn) {
    if (isOn) {
    } else {
        clearContent();
    }
}

const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('template1.css');
document.head.appendChild(link);

fetch(chrome.runtime.getURL('template1.html'))
    .then(res => res.text()).then(html => {
        const temp = document.createElement('div');
        temp.innerHTML = html.trim();
        const template = temp.querySelector('template');
        const clone = template.content.cloneNode(true);
        const item = clone.firstElementChild;
        document.body.appendChild(item);
        window.hoverPopup = item;
    });

function clearContent() {
    window.hoverPopup.style.display = 'none';
}
function setContent(key, rect) {
    window.hoverPopup.style.display = 'flex';
    const text = db[key] ? `${key}: ${db[key].read} -> ${db[key].mean}` : "null";
    window.hoverPopup.querySelector('.word').textContent = key;
    window.hoverPopup.style.left = rect.x + 'px';
    window.hoverPopup.style.top = (rect.y - 70) + 'px';
}

const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

function getWordUnicode(text, offset) {
    if (!text || offset < 0 || offset >= text.length) return null;

    for (const segment of segmenter.segment(text)) {
        if ((offset - segment.index) >>> 0 < segment.segment.length) {/* offset in between */
            return (/\p{L}/u.test(segment.segment)) ?/* skip non letters */
                { word: segment.segment, start: segment.index, end: segment.index + segment.segment.length }
                : null;
        }
    }
    return null;
}
let currentWord = null;
document.addEventListener("mousemove", (e) => {
    let pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
        ?? (() => {
            const legacy = document.caretRangeFromPoint?.(e.clientX, e.clientY);
            return legacy ? { offsetNode: legacy.startContainer, offset: legacy.startOffset } : null;
        })();

    const result = getWordUnicode(pos?.offsetNode.textContent, pos?.offset);
    const { word, start, end } = result || {};

    if (pos?.offsetNode.nodeType !== Node.TEXT_NODE || !word) {
        clearContent();
        console.log('no word found');
        return;
    }
    if (currentWord === word) {
        console.log('word not changed');
        return;
    }

    const range = document.createRange();
    range.setStart(pos.offsetNode, start);
    range.setEnd(pos.offsetNode, end);
    const rect = range.getBoundingClientRect();
    function distanceToRect(rect, x, y) {
        const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
        const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const dist = distanceToRect(rect, e.clientX, e.clientY);
    if (dist > 10 /*max pixel distance*/) {
        clearContent();
        return;
    }
    currentWord = word;
    console.log('new word found!');

    const key = word.toLowerCase();

    requestAnimationFrame(() => { setContent(key, rect); })
});
