async function mapById(sb, table, ids, select = 'id,name') {
  const cleanIds = Array.from(new Set((ids || []).filter(Boolean).map(Number)));
  if (cleanIds.length === 0) return new Map();
  const { data } = await sb.list(table, { select, in: [['id', cleanIds]] });
  return new Map((data || []).map((row) => [Number(row.id), row]));
}

function pageOptions(page = 1, limit = 20) {
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  return {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum
  };
}

module.exports = { mapById, pageOptions };
