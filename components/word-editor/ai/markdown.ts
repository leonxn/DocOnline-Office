/**
 * Markdown → HTML para las respuestas de la IA (mostrar en el chat e insertar en el documento).
 * Primero se escapa TODO el HTML; después se aplican los patrones de Markdown. Así una
 * respuesta nunca puede inyectar etiquetas o scripts.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // Solo vínculos http(s)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloque de código
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // Títulos
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(4, h[1].length);
      out.push(`<h${level}>${inline(h[2].replace(/\s*#+\s*$/, ''))}</h${level}>`);
      i++;
      continue;
    }

    // Línea horizontal
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Tabla
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        '<table><tbody>' +
          `<tr>${head.map((c) => `<th><p>${inline(c)}</p></th>`).join('')}</tr>` +
          rows.map((r) => `<tr>${head.map((_, k) => `<td><p>${inline(r[k] ?? '')}</p></td>`).join('')}</tr>`).join('') +
          '</tbody></table>',
      );
      continue;
    }

    // Cita
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);
      continue;
    }

    // Listas (con un nivel de anidación por sangría)
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m || /\d/.test(m[2]) !== ordered) break;
        const nested = m[1].length >= 2;
        const task = m[3].match(/^\[( |x|X)\]\s+(.*)$/);
        const text = task ? `${task[1].trim() ? '☑' : '☐'} ${task[2]}` : m[3];
        items.push(nested ? `<ul><li><p>${inline(text)}</p></li></ul>` : `<li><p>${inline(text)}</p></li>`);
        i++;
      }
      // Las sublistas se pegan al ítem anterior
      const merged = items.reduce<string[]>((acc, it) => {
        if (it.startsWith('<ul>') && acc.length) acc[acc.length - 1] = acc[acc.length - 1].replace(/<\/li>$/, `${it}</li>`);
        else acc.push(it);
        return acc;
      }, []);
      out.push(ordered ? `<ol>${merged.join('')}</ol>` : `<ul>${merged.join('')}</ul>`);
      continue;
    }

    // Línea en blanco
    if (!line.trim()) {
      i++;
      continue;
    }

    // Párrafo (líneas seguidas)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\s*```|\s*>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) &&
      !(isTableRow(lines[i]) && isTableSep(lines[i + 1] ?? ''))
    ) {
      para.push(lines[i++]);
    }
    out.push(`<p>${para.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}
