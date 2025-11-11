import { groupVersionsByResume, formatChangeValue, formatFieldName, formatDate } from './ResumeVersionControl';

describe('ResumeVersionControl helper functions', () => {
  test('groupVersionsByResume groups and sorts correctly', () => {
    const versions = [
      { id: 'a', source_job_id: 'job1', source_job_title: 'Title', source_job_company: 'C', created_at: '2025-01-01' },
      { id: 'b', source_job_id: 'job1', source_job_title: 'Title', source_job_company: 'C', created_at: '2025-02-01' },
      { id: 'c', source_job_id: null, source_job_title: null, created_at: '2025-03-01' }
    ];

    const groups = groupVersionsByResume(versions);
    // Expect two groups: job1 and generic
    expect(groups.length).toBe(2);
    const jobGroup = groups.find(g => g.id === 'job1');
    expect(jobGroup.versions[0].id).toBe('b'); // newest first
  });

  test('formatChangeValue handles null/undefined/boolean', () => {
    expect(formatChangeValue(null)).toBe('(empty)');
    expect(formatChangeValue(undefined)).toBe('(empty)');
    expect(formatChangeValue(true)).toBe('Yes');
    expect(formatChangeValue(false)).toBe('No');
  });

  test('formatChangeValue handles arrays and objects', () => {
    expect(formatChangeValue([])).toBe('(empty list)');
    expect(formatChangeValue(['a','b'])).toBe('a, b');
    expect(formatChangeValue([1, { x: 1 }])).toBe('2 items');

    expect(formatChangeValue({})).toBe('(empty)');
    expect(formatChangeValue({ a: 1 })).toMatch(/a: 1/);

    const many = { a:1,b:2,c:3,d:4 };
    expect(formatChangeValue(many)).toBe('4 fields');
  });

  test('formatChangeValue truncates long strings', () => {
    const long = 'x'.repeat(250);
    const out = formatChangeValue(long);
    expect(out.length).toBeLessThan(250);
    expect(out.endsWith('...')).toBeTruthy();
  });

  test('formatFieldName formats correctly', () => {
    expect(formatFieldName('camelCaseField')).toBe('Camel Case Field');
    expect(formatFieldName('snake_case_field')).toBe('Snake case field');
  });

  test('formatDate returns expected format', () => {
    const d = formatDate('2025-01-02T15:30:00Z');
    // e.g., "Jan 2, 2025, 03:30 PM" - just ensure it contains year and month
    expect(d).toMatch(/2025/);
    expect(d).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });
});
