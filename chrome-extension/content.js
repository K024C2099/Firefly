const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
document.body.appendChild(svg);
svg.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999;`;
function setSVG(text, rect) {
    svg.innerHTML = `
<rect fill="black" rx="5" ry="5" x="${rect.x}" y="${rect.y - 24}" width="${text.length * 16 * 0.7}px" height="${24}px"></rect>
<text fill="white" font-family="monospace" x="${rect.x + 8}" y="${rect.y - 8}" font-size="${16}px">${text}</text>
<rect fill="transparent" stroke="black" stroke-width="2px" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"></rect>
`;
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

document.addEventListener("mousemove", (e) => {
    let pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
        ?? (() => {
            const legacy = document.caretRangeFromPoint?.(e.clientX, e.clientY);
            return legacy ? { offsetNode: legacy.startContainer, offset: legacy.startOffset } : null;
        })();

    const { word, start, end } = getWordUnicode(pos?.offsetNode.textContent, pos.offset) || {};

    if (pos?.offsetNode.nodeType !== Node.TEXT_NODE || !word) {
        svg.innerHTML = '';
        return;
    }

    const range = document.createRange();
    range.setStart(pos.offsetNode, start);
    range.setEnd(pos.offsetNode, end);
    const rect = range.getBoundingClientRect();

    const key = word.toLowerCase();
    const text = db[key] ? `${key}: ${db[key].read} -> ${db[key].mean}` : "null";

    requestAnimationFrame(() => { setSVG(text, rect); })
});
