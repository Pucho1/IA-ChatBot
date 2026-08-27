

/**
 * Extrae el primer objeto JSON contenido en una respuesta textual.
 *
 * Elimina las marcas de bloque Markdown, busca las llaves exteriores y
 * devuelve el fragmento que puede analizarse posteriormente con `JSON.parse`.
 * Si el contenido no es texto o no contiene un objeto delimitado por llaves,
 * devuelve `null`.
 *
 * @param {string} content Respuesta que puede contener JSON y texto adicional.
 * @returns {string|null} Texto del objeto JSON o `null` si no se encuentra.
 */
export function extractJSON(content) {

  if (!content || typeof content !== "string") {
    return null;
  }

  content = content
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    return null;
  }

  return content.slice(firstBrace, lastBrace + 1);
};
