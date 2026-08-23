/**
 * Unit tests for utils/imageUpload.ts.
 *
 * Runs in the jsdom environment (see pragma below) because the module uses
 * browser APIs (File, FileReader, Image, URL.createObjectURL).
 *
 * FileReader/Image are stubbed so dimension validation is deterministic:
 * jsdom cannot decode real images, so the stubs drive onload/onerror.
 */
// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  validateImageFile,
  validateImageDimensions,
  generateImagePreview,
  revokeImagePreview,
  formatFileSize,
  getFileExtension,
} from '../utils/imageUpload';

function pngFile(size = 1024, type = 'image/png', name = 'photo.png'): File {
  return new File([new Uint8Array(size)], name, { type });
}

let fakeDims = { width: 100, height: 100 };
let failImageLoad = false;

class FakeFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(_file: File): void {
    this.onload?.({ target: { result: 'data:image/png;base64,iVBORw0KGgo=' } });
  }
}

class FakeImage {
  width = fakeDims.width;
  height = fakeDims.height;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    if (failImageLoad) {
      this.onerror?.();
    } else {
      this.onload?.();
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  fakeDims = { width: 100, height: 100 };
  failImageLoad = false;
});

describe('validateImageFile', () => {
  it('accepts a valid file', () => {
    expect(validateImageFile(pngFile())).toBeNull();
  });

  it('rejects an unsupported type', () => {
    const file = pngFile(1024, 'text/plain');
    expect(validateImageFile(file)?.code).toBe('invalid-type');
  });

  it('rejects an oversized file', () => {
    const file = pngFile(6 * 1024 * 1024); // 6MB > 5MB default
    expect(validateImageFile(file)?.code).toBe('invalid-size');
  });

  it('honors custom limits', () => {
    const file = pngFile(2 * 1024);
    expect(validateImageFile(file, { allowedTypes: ['image/jpeg'] })?.code).toBe(
      'invalid-type'
    );
    expect(
      validateImageFile(file, { maxFileSize: 1024 })?.code
    ).toBe('invalid-size');
  });
});

describe('validateImageDimensions', () => {
  it('resolves null when dimensions are within bounds', async () => {
    vi.stubGlobal('FileReader', FakeFileReader);
    vi.stubGlobal('Image', FakeImage);
    fakeDims = { width: 2000, height: 2000 };

    await expect(validateImageDimensions(pngFile())).resolves.toBeNull();
  });

  it('flags dimensions over the maximum', async () => {
    vi.stubGlobal('FileReader', FakeFileReader);
    vi.stubGlobal('Image', FakeImage);
    fakeDims = { width: 5000, height: 100 };

    const result = await validateImageDimensions(pngFile());
    expect(result?.code).toBe('invalid-dimensions');
    expect(result?.message).toMatch(/4000x4000/);
  });

  it('does not fail when the image cannot be decoded', async () => {
    vi.stubGlobal('FileReader', FakeFileReader);
    vi.stubGlobal('Image', FakeImage);
    failImageLoad = true;

    await expect(validateImageDimensions(pngFile())).resolves.toBeNull();
  });
});

describe('generateImagePreview / revokeImagePreview', () => {
  it('creates and revokes an object URL', () => {
    const url = generateImagePreview(pngFile());
    expect(url).toMatch(/^blob:/);
    expect(() => revokeImagePreview(url)).not.toThrow();
  });
});

describe('formatFileSize', () => {
  it('formats byte sizes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2 GB');
  });
});

describe('getFileExtension', () => {
  it('extracts the extension', () => {
    expect(getFileExtension('photo.png')).toBe('png');
    expect(getFileExtension('a.b.jpeg')).toBe('jpeg');
  });

  it('returns an empty string without an extension', () => {
    expect(getFileExtension('noextension')).toBe('');
    expect(getFileExtension('')).toBe('');
  });
});
