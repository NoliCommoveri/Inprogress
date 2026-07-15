// export.js — date-range .xlsx/.pdf export.
// (Backup/restore — exportBackup/importBackup/backupNudgeDue — live in
// data.js per the Stage 6 build doc, not here.)
import {
  getData, getOpponentById,
  getParentById, getSnackAssignmentsForEvent
} from './data.js';
import { centsToDollarsStr } from './util.js';

const centsToStr = c => `$${centsToDollarsStr(c)}`;

// inclusive range, sorted by date then start time
export function getEventsInRange(startDate, endDate) {
  const { events } = getData();
  return events
    .filter(e => e.date >= startDate && e.date <= endDate)
    .sort((a, b) =>
      a.date === b.date
        ? (a.startTime || '').localeCompare(b.startTime || '')
        : a.date.localeCompare(b.date));
}

// flatten one event into display-ready fields (all refs resolved + tolerant)
function resolveEvent(e) {
  const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
  const snacks = getSnackAssignmentsForEvent(e.id).map(sa => {
    const p = getParentById(sa.parentId);
    return {
      parent: p ? p.name : '(deleted parent)',
      phone: p ? p.phone : '',
      notes: sa.notes || ''
    };
  });
  const score = (e.type === 'game' && e.status === 'completed'
    && e.finalScoreUs != null && e.finalScoreOpponent != null)
    ? `${e.finalScoreUs}–${e.finalScoreOpponent}` : '';
  return {
    date: e.date,
    type: e.type,
    time: e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime,
    opponent: opp ? opp.name : (e.type === 'game' ? '(unknown)' : ''),
    location: e.location || (opp && opp.homeLocation) || '',
    status: e.status,
    score,
    snacks,
    notes: e.notes || ''
  };
}

function fileStamp(startDate, endDate) {
  return `${startDate}_to_${endDate}`;
}

// ---------- Excel — requires vendored SheetJS on window.XLSX ----------
export function exportRangeToXlsx(startDate, endDate) {
  const rows = getEventsInRange(startDate, endDate).map(e => {
    const r = resolveEvent(e);
    return {
      Date: r.date,
      Day: new Date(r.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' }),
      Type: r.type,
      Time: r.time,
      Opponent: r.opponent,
      Location: r.location,
      Status: r.status,
      Score: r.score,
      'Snack Parent': r.snacks.map(s => s.parent).join('; '),
      'Snack Phone': r.snacks.map(s => s.phone).filter(Boolean).join('; '),
      Notes: r.notes
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['Date','Day','Type','Time','Opponent','Location','Status','Score','Snack Parent','Snack Phone','Notes']
  });
  ws['!cols'] = [
    { wch: 11 }, { wch: 5 }, { wch: 9 }, { wch: 14 }, { wch: 20 },
    { wch: 24 }, { wch: 11 }, { wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 40 }
  ];

  // Optional 2nd sheet: fundraiser occurrences overlapping the range
  const { fundraiserOccurrences, fundraisers } = getData();
  const fRows = fundraiserOccurrences
    .filter(o => o.startDate <= endDate && o.endDate >= startDate)
    .map(o => {
      const f = fundraisers.find(x => x.id === o.fundraiserId);
      return {
        Fundraiser: f ? f.name : '(deleted)',
        Start: o.startDate, End: o.endDate,
        Location: o.location || '',
        Goal: f ? centsToStr(f.goalAmountCents) : '',
        Raised: f ? centsToStr(f.raisedAmountCents) : '',
        Notes: o.notes || ''
      };
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Events');
  if (fRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fRows), 'Fundraisers');
  }
  XLSX.writeFile(wb, `schedule_${fileStamp(startDate, endDate)}.xlsx`);
}

// ---------- PDF — requires vendored jsPDF on window.jspdf ----------
export function exportRangeToPdf(startDate, endDate, teamName = '') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const M = 48;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = M;

  const line = (text, { size = 10, bold = false, gap = 14, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    const wrapped = doc.splitTextToSize(text, W - M * 2 - indent);
    wrapped.forEach(t => {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(t, M + indent, y);
      y += gap;
    });
  };

  line(`${teamName ? teamName + ' — ' : ''}Schedule ${startDate} to ${endDate}`,
       { size: 15, bold: true, gap: 22 });

  const events = getEventsInRange(startDate, endDate);
  if (!events.length) { line('No events in this range.'); }

  events.forEach(e => {
    const r = resolveEvent(e);
    if (y > H - M - 60) { doc.addPage(); y = M; }

    const wd = new Date(r.date + 'T00:00')
      .toLocaleDateString(undefined, { weekday: 'long' });
    line(`${wd}, ${r.date}  ·  ${r.type.toUpperCase()}  ·  ${r.time}`,
         { size: 12, bold: true, gap: 16 });

    if (r.opponent) line(`Opponent: ${r.opponent}`, { indent: 12 });
    if (r.location) line(`Location: ${r.location}`, { indent: 12 });
    line(`Status: ${r.status}${r.score ? `  (Final ${r.score})` : ''}`, { indent: 12 });
    r.snacks.forEach(s =>
      line(`Snack: ${s.parent}${s.phone ? ` (${s.phone})` : ''}${s.notes ? ` — ${s.notes}` : ''}`,
           { indent: 12 }));
    if (r.notes) line(`Notes: ${r.notes}`, { indent: 12 });

    y += 8;                                    // gap between blocks
    doc.setDrawColor(220).line(M, y, W - M, y); // divider
    y += 14;
  });

  doc.save(`schedule_${fileStamp(startDate, endDate)}.pdf`);
}
