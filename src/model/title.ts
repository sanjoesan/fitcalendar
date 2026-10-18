// A readable name from a file name, for rides whose file carries none.

/** "2026-06-10_19-48_Giro di Castellina II.fit" → "Giro di Castellina II"; "giro_giro-della-porta_20261004_194450.fit"
 *  → "Giro giro della porta". Null when nothing but dates and generic words remain. */
export function titleFromFileName(fileName: string): string | null {
  let name = fileName.replace(/\.fit$/i, "");
  name = name
    .replace(/\d{4}-\d{2}-\d{2}([_ T-]\d{2}[-:.]?\d{2}([-:.]?\d{2})?)?/g, " ")
    .replace(/\d{8}[_T-]?\d{4,6}/g, " ")
    .replace(/\b\d{8,}\b/g, " ");
  // Names without spaces use _ and - as word separators.
  name = /\s/.test(name.replace(/^[\s_-]+|[\s_-]+$/g, "")) ? name.replace(/_/g, " ") : name.replace(/[_-]+/g, " ");
  name = name.replace(/\s+/g, " ").replace(/^[\s_-]+|[\s_-]+$/g, "").trim();
  if (!name || /^(ride|activity|activite|aktivit[aä]t|track|workout)$/i.test(name) || /^\d+$/.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
