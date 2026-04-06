/* ═══ Bunker OS — Markdown Renderer ═══ */

export function markdownToHtml(md) {
  // 1. Extract fenced code blocks before any other processing
  const codeBlocks = [];
  let s = md.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = code.trimEnd()
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cls = lang ? ` class="lang-${lang}"` : "";
    codeBlocks.push(
      `<pre class="md-pre"><code${cls}>${escaped}</code>` +
      `<button class="copy-code-btn" onclick="copyCode(this)" title="Copiar codigo">⎘</button></pre>`
    );
    return `\x00BLOCK${idx}\x00`;
  });

  // 2. Extract inline code
  const inlines = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlines.length;
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    inlines.push(`<code class="md-code">${escaped}</code>`);
    return `\x00INLINE${idx}\x00`;
  });

  // 3. Escape remaining HTML
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 4. Block-level elements (headers, hr, blockquotes)
  s = s.replace(/^#{6} (.+)$/gm, "<h6>$1</h6>");
  s = s.replace(/^#{5} (.+)$/gm, "<h5>$1</h5>");
  s = s.replace(/^#{4} (.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/^(?:---|\*\*\*|___)\s*$/gm, "<hr>");
  s = s.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // 5. Lists — line-by-line state machine
  const lines = s.split("\n");
  const out = [];
  const stack = [];
  for (const line of lines) {
    const ul = line.match(/^\s*[-*+] (.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      const content = ul ? ul[1] : ol[1];
      if (!stack.length || stack[stack.length - 1] !== type) {
        if (stack.length && stack[stack.length - 1] !== type) out.push(`</${stack.pop()}>`);
        out.push(`<${type}>`); stack.push(type);
      }
      out.push(`<li>${content}</li>`);
    } else {
      while (stack.length) out.push(`</${stack.pop()}>`);
      out.push(line);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  s = out.join("\n");

  // 6. Inline formatting
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^\s*](?:[^*\n]*[^\s*])?)\*/g, "<em>$1</em>");
  s = s.replace(/\*([^\s*])\*/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, rawUrl) => {
    // Decode HTML entities in URL (from step 3 escaping) then re-validate
    const url = rawUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Strip dangerous URL schemes (javascript:, data:, vbscript:, etc.)
    const safePrefixes = /^(https?:|mailto:|#|\/)/i;
    const safeUrl = safePrefixes.test(url.trim()) ? rawUrl : '#';
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  });

  // 7. Paragraphs — split on double newlines, wrap non-block content
  const BLOCK_RE = /^<(?:h[1-6]|ul|ol|pre|blockquote|hr|div)[^>]*>/;
  const paragraphs = s.split(/\n{2,}/);
  s = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    if (BLOCK_RE.test(p) || p.includes("\x00BLOCK")) return p;
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  }).filter(Boolean).join("");

  // 8. Restore placeholders
  s = s.replace(/\x00INLINE(\d+)\x00/g, (_, i) => inlines[+i]);
  s = s.replace(/\x00BLOCK(\d+)\x00/g, (_, i) => codeBlocks[+i]);
  return s;
}

export function copyCode(btn) {
  const code = btn.previousElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.textContent;
    btn.textContent = "\u2713 Copiado";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {});
}
