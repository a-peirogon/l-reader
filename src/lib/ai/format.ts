/**
 * Lightweight markdown → HTML for chat bubbles.
 * Handles: headings, bold, italic, code, lists, paragraphs.
 */
export function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h4 style="font-size:12px;color:#ccc;margin:6px 0 2px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:13px;color:#ddd;margin:8px 0 3px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:14px;color:#eee;margin:8px 0 3px;">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul style="padding-left:14px;margin:4px 0;">$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[h|u|l])/, '<p>')
    .replace(/$(?!<\/)/, '</p>')
}

export function escapeHtml(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
