import { describe, expect, it } from 'vitest';
import { terbilang } from './terbilang';

describe('terbilang', () => {
  it('reads round hundreds and thousands', () => {
    expect(terbilang(100)).toBe('Seratus rupiah');
    expect(terbilang(1000)).toBe('Seribu rupiah');
  });

  it('reads the receipt amount', () => {
    expect(terbilang(862000)).toBe('Delapan ratus enam puluh dua ribu rupiah');
    expect(terbilang(882000)).toBe('Delapan ratus delapan puluh dua ribu rupiah');
  });

  it('handles zero, negatives and garbage', () => {
    expect(terbilang(0)).toBe('Nol rupiah');
    expect(terbilang('')).toBe('Nol rupiah');
    expect(terbilang(-500)).toBe('Minus Lima ratus rupiah');
    expect(terbilang('862.000')).toBe('Nol rupiah'); // format ribuan bukan angka valid
  });

  it('truncates decimals', () => {
    expect(terbilang(862000.7)).toBe('Delapan ratus enam puluh dua ribu rupiah');
  });
});
