import ExcelJS from 'exceljs';

export type ExportAnswer = {
  questionId: string;
  text: string;
  type: string;
  metric?: string | null;
  value: string;
  valueInt?: number | null;
  scaleMax?: number | null;
};

export type ExportResponse = {
  id: string;
  date: string;
  dept: string;
  engagement: number | null;
  loyalty: number | null;
  satisfaction: number | null;
  enps: number | null;
  anonymous: boolean;
  employee?: { fullName: string; email?: string | null } | null;
  answers: ExportAnswer[];
};

export type ExportPayload = {
  title: string;
  responses: ExportResponse[];
};

const TEAL = 'FF0F766E';
const TEAL_SOFT = 'FFCCFBF1';
const HEADER_FONT = 'FFFFFFFF';
const MUTED = 'FF64748B';

function respondentName(row: ExportResponse) {
  if (row.anonymous) return 'Анонимно';
  return row.employee?.fullName || '—';
}

function scoreFill(value: number | null | undefined, scaleMax = 5): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const normalized = scaleMax >= 10 ? (value / 10) * 5 : value;
  if (normalized >= 4.3) return 'FF059669';
  if (normalized >= 3.7) return 'FF16A34A';
  if (normalized >= 3) return 'FFD97706';
  if (normalized >= 2.3) return 'FFEA580C';
  return 'FFDC2626';
}

function paintScore(
  cell: ExcelJS.Cell,
  value: number | null | undefined,
  scaleMax = 5,
) {
  if (value == null) {
    cell.value = '—';
    cell.font = { color: { argb: MUTED } };
    return;
  }
  cell.value = value;
  cell.numFmt = scaleMax >= 10 ? '0' : '0.00';
  const fill = scoreFill(value, scaleMax);
  if (!fill) return;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF0F766E' } },
    };
  });
}

function fileName(title: string) {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'опрос';
  return `${safe}.xlsx`;
}

export async function downloadSurveyExcel(payload: ExportPayload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartJob';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Сводка', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  summary.columns = [
    { header: 'Дата', key: 'date', width: 14 },
    { header: 'Респондент', key: 'name', width: 32 },
    { header: 'Отдел', key: 'dept', width: 22 },
    { header: 'Вовлечённость', key: 'eng', width: 16 },
    { header: 'Лояльность', key: 'loy', width: 14 },
    { header: 'Удовлетворённость', key: 'sat', width: 20 },
    { header: 'eNPS', key: 'enps', width: 10 },
  ];
  summary.spliceRows(1, 0, [`Результаты: ${payload.title}`]);
  summary.mergeCells(1, 1, 1, 7);
  const titleCell = summary.getCell(1, 1);
  titleCell.font = { bold: true, size: 16, color: { argb: TEAL } };
  titleCell.alignment = { vertical: 'middle' };
  summary.getRow(1).height = 28;
  styleHeader(summary.getRow(2));
  summary.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 7 } };

  payload.responses.forEach((row) => {
    const excelRow = summary.addRow({
      date: new Date(row.date),
      name: respondentName(row),
      dept: row.dept || '—',
    });
    excelRow.getCell(1).numFmt = 'DD.MM.YYYY';
    excelRow.getCell(2).font = { bold: true };
    paintScore(excelRow.getCell(4), row.engagement, 5);
    paintScore(excelRow.getCell(5), row.loyalty, 5);
    paintScore(excelRow.getCell(6), row.satisfaction, 5);
    paintScore(excelRow.getCell(7), row.enps, 10);
    excelRow.alignment = { vertical: 'middle' };
    excelRow.height = 20;
  });

  const details = workbook.addWorksheet('Ответы', {
    views: [{ state: 'frozen', ySplit: 2 }],
    properties: {
      outlineProperties: { summaryBelow: false, summaryRight: false },
    },
  });
  details.columns = [
    { header: 'Респондент', key: 'name', width: 28 },
    { header: 'Дата', key: 'date', width: 14 },
    { header: '№', key: 'n', width: 6 },
    { header: 'Метрика', key: 'metric', width: 24 },
    { header: 'Вопрос', key: 'question', width: 54 },
    { header: 'Ответ', key: 'value', width: 36 },
    { header: 'Балл', key: 'score', width: 10 },
  ];
  details.spliceRows(1, 0, [`Ответы по вопросам: ${payload.title}`]);
  details.mergeCells(1, 1, 1, 7);
  const detailTitle = details.getCell(1, 1);
  detailTitle.font = { bold: true, size: 16, color: { argb: TEAL } };
  details.getRow(1).height = 28;
  styleHeader(details.getRow(2));

  payload.responses.forEach((row) => {
    const head = details.addRow({
      name: respondentName(row),
      date: new Date(row.date),
      n: '',
      metric: row.dept || '',
      question: `Ответов: ${(row.answers || []).length}`,
      value: '',
      score: row.enps ?? '',
    });
    head.getCell(2).numFmt = 'DD.MM.YYYY';
    head.font = { bold: true, color: { argb: 'FF115E59' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } };
    head.height = 22;
    head.outlineLevel = 0;
    if (row.enps != null) paintScore(head.getCell(7), row.enps, 10);

    (row.answers || []).forEach((answer, index) => {
      const scaleMax = answer.scaleMax ?? (answer.type === 'ENPS' ? 10 : 5);
      const detail = details.addRow({
        name: '',
        date: '',
        n: index + 1,
        metric: answer.metric || '',
        question: answer.text,
        value: answer.value || '—',
        score: answer.valueInt ?? '',
      });
      detail.outlineLevel = 1;
      detail.getCell(5).alignment = { wrapText: true, vertical: 'middle' };
      detail.getCell(6).alignment = { wrapText: true, vertical: 'middle' };
      detail.getCell(3).alignment = { horizontal: 'center' };
      if (
        answer.type !== 'TEXT' &&
        answer.type !== 'GRID' &&
        answer.type !== 'SINGLE' &&
        answer.valueInt != null
      ) {
        paintScore(detail.getCell(7), answer.valueInt, scaleMax);
      } else {
        detail.getCell(7).value = '—';
        detail.getCell(7).font = { color: { argb: MUTED } };
        detail.getCell(7).alignment = { horizontal: 'center' };
      }
      detail.height = 32;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(payload.title);
  link.click();
  URL.revokeObjectURL(url);
}
