import { escapeCsvCell, toCsv } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('-12.50', { allowFormulaChars: true })).toBe('-12.50');
  });

  it('builds a document with a header row and CRLF line endings', () => {
    const csv = toCsv(
      [
        { header: 'Title', value: (r: { t: string; a: string }) => r.t },
        { header: 'Amount', value: (r) => r.a, numeric: true },
      ],
      [
        { t: 'Coffee', a: '-3.50' },
        { t: 'Rent, October', a: '-1200.00' },
      ],
    );
    expect(csv).toBe('Title,Amount\r\nCoffee,-3.50\r\n"Rent, October",-1200.00\r\n');
  });
});
