function toCSV(rows) {
  if (!rows.length) return "basename,sha1,path,action,reason\n";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",") + "\n";
  const lines = rows
    .map(r =>
      keys
        .map(k => {
          const val = String(r[k] ?? "");
          // ダブルクォート/カンマ/改行を含む場合はCSVエスケープ
          return /[,"\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
        })
        .join(",")
    )
    .join("\n");
  return header + lines + "\n";
}
