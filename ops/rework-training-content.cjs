const { isDeepStrictEqual } = require("node:util");
function reworkContent(current, before, after) {
  const questions = current.questions.map((q) => {
    if (q.type) return q;
    const old = before.questions.find((v) => v.id === q.id);
    const replacement = after.questions.find((v) => v.id === q.id);
    return old && replacement && isDeepStrictEqual(q, old)
      ? structuredClone(replacement)
      : q;
  });
  const changed = questions.some((q, i) => q !== current.questions[i]);
  if (!changed) return current;
  const blocks = current.blocks.map((b) => {
    const old = before.blocks.find((v) => v.id === b.id);
    const replacement = after.blocks.find((v) => v.id === b.id);
    return old && replacement && isDeepStrictEqual(b, old)
      ? structuredClone(replacement)
      : b;
  });
  return {
    ...current,
    questions,
    blocks,
    ...(before.description !== undefined &&
    current.description === before.description
      ? { description: after.description }
      : {}),
  };
}
function reworkForMappings(content,mappings){const match=mappings.find(m=>content.questions.some(q=>m.before.questions.some(old=>old.id===q.id&&old.subject===q.subject)))||mappings.find(m=>m.before.title===content.title);return match?reworkContent(content,match.before,match.after):content;}
module.exports={reworkContent,reworkForMappings};
