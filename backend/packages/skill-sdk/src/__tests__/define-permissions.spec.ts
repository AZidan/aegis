import { definePermissions } from '../helpers/define-permissions';

describe('definePermissions', () => {
  it('should build an empty manifest by default', () => {
    const manifest = definePermissions().build();
    expect(manifest.network.allowedDomains).toEqual([]);
    expect(manifest.files.readPaths).toEqual([]);
    expect(manifest.files.writePaths).toEqual([]);
    expect(manifest.env.required).toEqual([]);
    expect(manifest.env.optional).toEqual([]);
  });

  it('should add allowed domains', () => {
    const manifest = definePermissions()
      .allowDomains('api.example.com', '*.openai.com')
      .build();
    expect(manifest.network.allowedDomains).toEqual(['api.example.com', '*.openai.com']);
  });

  it('should add file paths', () => {
    const manifest = definePermissions()
      .readPaths('/data/input')
      .writePaths('/data/output')
      .build();
    expect(manifest.files.readPaths).toEqual(['/data/input']);
    expect(manifest.files.writePaths).toEqual(['/data/output']);
  });

  it('should add env vars', () => {
    const manifest = definePermissions()
      .requireEnv('API_KEY')
      .optionalEnv('DEBUG')
      .build();
    expect(manifest.env.required).toEqual(['API_KEY']);
    expect(manifest.env.optional).toEqual(['DEBUG']);
  });

  it('should support chaining all methods', () => {
    const manifest = definePermissions()
      .allowDomains('api.example.com')
      .readPaths('/data')
      .writePaths('/tmp')
      .requireEnv('KEY')
      .optionalEnv('VERBOSE')
      .build();

    expect(manifest.network.allowedDomains).toHaveLength(1);
    expect(manifest.files.readPaths).toHaveLength(1);
    expect(manifest.files.writePaths).toHaveLength(1);
    expect(manifest.env.required).toHaveLength(1);
    expect(manifest.env.optional).toHaveLength(1);
  });

  it('should return a deep clone (immutable)', () => {
    const builder = definePermissions().allowDomains('a.com');
    const m1 = builder.build();
    const m2 = builder.allowDomains('b.com').build();
    expect(m1.network.allowedDomains).toEqual(['a.com']);
    expect(m2.network.allowedDomains).toEqual(['a.com', 'b.com']);
  });
});
