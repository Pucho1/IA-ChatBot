

/**
 * 
 * @param {*} content 
 * @returns 
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
