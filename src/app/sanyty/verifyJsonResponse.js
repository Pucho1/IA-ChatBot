

/**
 * 
 * @param {*} content 
 * @returns 
 */
export function extractJSON(content) {
  if (!content) return null;

  // Quitar ```json fences si existen
  content = content.replace(/```json/g, "")
                   .replace(/```/g, "")
                   .trim();

  // Buscar primer { y último }
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    return null;
  }

  return content.slice(firstBrace, lastBrace + 1);
}