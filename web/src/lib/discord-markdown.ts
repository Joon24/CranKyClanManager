function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function discordMarkdownToHtml(text: string): string {
  if (!text) return '';

  const blocks: string[] = [];
  let working = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const idx = blocks.length;
    blocks.push(`<pre><code class="multiline">${escapeHtml(code.trim())}</code></pre>`);
    return `\x00BLOCK${idx}\x00`;
  });

  working = escapeHtml(working);
  working = working.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  working = working.replace(/\*(.+?)\*/g, '<em>$1</em>');
  working = working.replace(/_(.+?)_/g, '<em>$1</em>');
  working = working.replace(/`([^`]+)`/g, '<code>$1</code>');
  working = working.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  working = working.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );
  working = working.replace(/\n/g, '<br>');

  working = working.replace(/\x00BLOCK(\d+)\x00/g, (_, idx) => blocks[Number(idx)] ?? '');
  return working;
}
