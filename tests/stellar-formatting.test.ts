/**
 * Unit tests for lib/stellar/formatting.ts (Stellar amount/asset formatting).
 */
import { describe, it, expect } from 'vitest';
import { Asset } from '@stellar/stellar-sdk';

import {
  STELLAR_DECIMALS,
  STELLAR_PRECISION,
  toStroops,
  fromStroops,
  formatAmount,
  formatCurrency,
  formatAsset,
  getBaseFee,
  formatFee,
  truncateAddress,
  parseAssetString,
} from '../lib/stellar/formatting';

const VALID_ISSUER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('toStroops', () => {
  it('converts a human-readable amount to stroops', () => {
    expect(toStroops('100.50')).toBe('1005000000');
    expect(toStroops(1)).toBe(String(STELLAR_PRECISION));
    expect(toStroops('0')).toBe('0');
  });

  it('throws on negative or non-numeric amounts', () => {
    expect(() => toStroops(-1)).toThrow(/non-negative/);
    expect(() => toStroops('abc')).toThrow(/non-negative/);
  });
});

describe('fromStroops', () => {
  it('converts stroops back to a human-readable amount', () => {
    expect(fromStroops('1005000000')).toBe('100.5');
    expect(fromStroops(0)).toBe('0');
    expect(fromStroops(STELLAR_PRECISION)).toBe('1');
  });

  it('round-trips through toStroops', () => {
    expect(fromStroops(toStroops('42.1234567'))).toBe('42.1234567');
  });

  it('throws on negative or non-numeric stroops', () => {
    expect(() => fromStroops(-5)).toThrow(/non-negative/);
    expect(() => fromStroops('nope')).toThrow(/non-negative/);
  });
});

describe('formatAmount', () => {
  it('formats with thousand separators', () => {
    expect(formatAmount(1234.5)).toBe('1,234.5');
    expect(formatAmount(0)).toBe('0');
  });

  it('respects the decimals option', () => {
    expect(formatAmount(1.23456789, 2)).toBe('1.23');
    expect(formatAmount(1.23456789, STELLAR_DECIMALS)).toBe('1.2345679');
  });

  it('throws on non-numeric amounts', () => {
    expect(() => formatAmount('xyz')).toThrow(/Invalid amount/);
  });
});

describe('formatCurrency', () => {
  it('appends the currency code', () => {
    expect(formatCurrency(100.5)).toBe('100.5 XLM');
    expect(formatCurrency(100.5, 'USD', 2)).toBe('100.5 USD');
  });
});

describe('formatAsset', () => {
  it('passes through plain asset code strings', () => {
    expect(formatAsset('XLM')).toBe('XLM');
  });

  it('formats the native asset as XLM', () => {
    expect(formatAsset(Asset.native())).toBe('XLM');
  });

  it('formats issued assets as CODE:ISSUER', () => {
    const asset = new Asset('USDC', VALID_ISSUER);
    expect(formatAsset(asset)).toBe(`USDC:${VALID_ISSUER}`);
  });
});

describe('getBaseFee', () => {
  it('returns the SDK base fee', () => {
    expect(getBaseFee()).toBe('100');
  });
});

describe('formatFee', () => {
  it('formats stroops as an XLM amount', () => {
    expect(formatFee('100')).toBe('0.00001 XLM');
  });
});

describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    const address = `G${'A'.repeat(54)}`;
    expect(truncateAddress(address)).toBe(`GAAA...${'A'.repeat(4)}`);
  });

  it('returns short addresses unchanged', () => {
    expect(truncateAddress('GABC')).toBe('GABC');
  });

  it('honors custom start/end lengths', () => {
    const address = `G${'A'.repeat(54)}`;
    expect(truncateAddress(address, 2, 3)).toBe(`GA...${'A'.repeat(3)}`);
  });
});

describe('parseAssetString', () => {
  it('parses native XLM', () => {
    expect(parseAssetString('XLM')).toEqual({ code: 'XLM', issuer: null });
    expect(parseAssetString('native')).toEqual({ code: 'XLM', issuer: null });
  });

  it('parses CODE:ISSUER', () => {
    expect(parseAssetString(`USDC:${VALID_ISSUER}`)).toEqual({
      code: 'USDC',
      issuer: VALID_ISSUER,
    });
  });

  it('throws on malformed asset strings', () => {
    expect(() => parseAssetString('USDC')).toThrow(/Invalid asset string/);
    expect(() => parseAssetString('A:B:C')).toThrow(/Invalid asset string/);
  });
});
