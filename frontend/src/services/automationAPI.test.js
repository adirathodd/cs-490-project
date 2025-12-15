import { automationAPI } from './automationAPI';
import { authorizedFetch } from './authToken';

jest.mock('./authToken', () => ({
  authorizedFetch: jest.fn((...args) => global.fetch(...args)),
}));

// Save original globals to restore after tests
const originalFetch = global.fetch;
const originalLocalStorage = global.localStorage;
const originalURL = global.URL;

describe('automationAPI service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    authorizedFetch.mockImplementation((...args) => global.fetch(...args));
    // Simple localStorage mock
    const store = {};
    global.localStorage = {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = value; },
      removeItem: (key) => { delete store[key]; },
    };

    // Default token
    global.localStorage.setItem('firebaseToken', 'test-token');

    // Mock URL.createObjectURL
    global.URL = {
      createObjectURL: jest.fn((blob) => `blob://fake/${blob.size || 0}`),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
    global.URL = originalURL;
    jest.clearAllMocks();
  });

  test('request returns parsed json on success', async () => {
    const payload = { ok: true };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const res = await automationAPI.request('/some-endpoint/');
    expect(res).toEqual(payload);
    expect(global.fetch).toHaveBeenCalled();
  });

  test('request throws detailed error from json body when not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Bad request' }),
    });

    await expect(automationAPI.request('/bad/')).rejects.toThrow('Bad request');
  });

  test('request handles non-json error body gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('invalid json'); },
    });

    await expect(automationAPI.request('/bad-json/')).rejects.toThrow('HTTP 500');
  });

  test('request returns null for 204 No Content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });

    const res = await automationAPI.request('/no-content/');
    expect(res).toBeNull();
  });

  test('downloadApplicationPackage returns blob url', async () => {
    const fakeBlob = new Blob(['hello'], { type: 'application/zip' });
    // ensure blob has size property for our URL.createObjectURL mock
    Object.defineProperty(fakeBlob, 'size', { value: 5 });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => fakeBlob,
    });

    const url = await automationAPI.downloadApplicationPackage(123);
    expect(url).toBe('blob://fake/5');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/automation/packages/123/download/'), expect.any(Object));
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
  });

  test('downloadApplicationPackage throws on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await expect(automationAPI.downloadApplicationPackage(1)).rejects.toThrow('Failed to download package');
  });

  test('getAutomationLogs builds query params correctly', async () => {
    const returned = { logs: [] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => returned,
    });

    const params = { rule_id: 5, level: 'error', start_date: '2020-01-01', end_date: '2020-01-02', limit: 10 };
    const res = await automationAPI.getAutomationLogs(params);
    expect(res).toEqual(returned);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('?'), expect.any(Object));
    // ensure rule_id is present in the URL
    expect(global.fetch.mock.calls[0][0]).toContain('rule_id=5');
    expect(global.fetch.mock.calls[0][0]).toContain('level=error');
  });

  test('generateApplicationPackage posts correct body', async () => {
    const resp = { id: 10 };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => resp });

    const res = await automationAPI.generateApplicationPackage(99, { opt: true });
    expect(res).toEqual(resp);
    const lastCall = global.fetch.mock.calls[0];
    expect(lastCall[1].method).toBe('POST');
    const body = JSON.parse(lastCall[1].body);
    expect(body.job_id).toBe(99);
    expect(body.parameters).toEqual({ opt: true });
  });

  test('bulkDeleteRules sends DELETE with body', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await automationAPI.bulkDeleteRules([1,2,3]);
    const lastCall = global.fetch.mock.calls[0];
    expect(lastCall[1].method).toBe('DELETE');
    expect(JSON.parse(lastCall[1].body)).toEqual({ rule_ids: [1,2,3] });
  });

  test('triggerRuleExecution sends context in body', async () => {
    const resp = { executed: true };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => resp });
    const res = await automationAPI.triggerRuleExecution(7, { foo: 'bar' });
    expect(res).toEqual(resp);
    const lastCall = global.fetch.mock.calls[0];
    expect(lastCall[0]).toContain('/automation/rules/7/execute/');
    expect(JSON.parse(lastCall[1].body)).toEqual({ context: { foo: 'bar' } });
  });

  test('many convenience methods call correct endpoints and methods', async () => {
    // generic mock response
    const mockResp = { ok: true };
    const cases = [
      { name: 'getAutomationRules', args: [], path: '/automation/rules/' },
      { name: 'getAutomationRule', args: [5], path: '/automation/rules/5/' },
      { name: 'createAutomationRule', args: [{ a: 1 }], path: '/automation/rules/', method: 'POST', body: { a:1 } },
      { name: 'updateAutomationRule', args: [2, { b: 2 }], path: '/automation/rules/2/', method: 'PUT', body: { b:2 } },
      { name: 'deleteAutomationRule', args: [3], path: '/automation/rules/3/', method: 'DELETE' },
      { name: 'getApplicationPackages', args: [], path: '/automation/packages/' },
      { name: 'getApplicationPackageDetails', args: [4], path: '/automation/packages/4/' },
      { name: 'regenerateApplicationPackage', args: [8], path: '/automation/packages/8/regenerate/', method: 'POST' },
      { name: 'getScheduledSubmissions', args: [], path: '/automation/scheduled-submissions/' },
      { name: 'createScheduledSubmission', args: [{ s: true }], path: '/automation/scheduled-submissions/', method: 'POST', body: { s: true } },
      { name: 'updateScheduledSubmission', args: [6, { u: 1 }], path: '/automation/scheduled-submissions/6/', method: 'PUT', body: { u:1 } },
      { name: 'cancelScheduledSubmission', args: [7], path: '/automation/scheduled-submissions/7/cancel/', method: 'POST' },
      { name: 'executeScheduledSubmission', args: [9], path: '/automation/scheduled-submissions/9/execute/', method: 'POST' },
      { name: 'getAutomationAnalytics', args: [], pathContains: '/automation/analytics/' },
      { name: 'getAutomationAnalytics', args: ['30days'], pathContains: 'time_range=30days' },
      { name: 'getRuleExecutionStats', args: [11], path: '/automation/rules/11/stats/' },
      { name: 'bulkCreateRules', args: [[{x:1}]], path: '/automation/bulk/rules/', method: 'POST', body: { rules: [{x:1}] } },
      { name: 'bulkUpdateRules', args: [[{id:1}]], path: '/automation/bulk/rules/update/', method: 'PUT', body: { updates: [{id:1}] } },
      { name: 'bulkGeneratePackages', args: [[1,2], { p: true }], path: '/automation/bulk/generate-packages/', method: 'POST', body: { job_ids: [1,2], parameters: { p: true } } },
      { name: 'getFollowUpReminders', args: [], path: '/automation/follow-ups/' },
      { name: 'createFollowUpReminder', args: [{ r: 1 }], path: '/automation/follow-ups/', method: 'POST', body: { r:1 } },
      { name: 'updateFollowUpReminder', args: [3, { r: 2 }], path: '/automation/follow-ups/3/', method: 'PUT', body: { r:2 } },
      { name: 'deleteFollowUpReminder', args: [4], path: '/automation/follow-ups/4/', method: 'DELETE' },
      { name: 'getApplicationChecklists', args: [], path: '/automation/checklists/' },
      { name: 'createApplicationChecklist', args: [{ c: true }], path: '/automation/checklists/', method: 'POST', body: { c: true } },
      { name: 'updateApplicationChecklist', args: [5, { d: 3 }], path: '/automation/checklists/5/', method: 'PUT', body: { d:3 } },
      { name: 'deleteApplicationChecklist', args: [6], path: '/automation/checklists/6/', method: 'DELETE' },
      { name: 'updateChecklistTask', args: [7, 8, { t: 'done' }], path: '/automation/checklists/7/tasks/8/', method: 'PUT', body: { t: 'done' } },
      { name: 'triggerAutomation', args: [{ trig: true }], path: '/automation/trigger/', method: 'POST', body: { trig: true } },
      { name: 'getAutomationStatus', args: [], path: '/automation/status/' },
      { name: 'getSystemHealth', args: [], path: '/automation/health/' },
      { name: 'getActionTemplates', args: ['email'], path: '/automation/templates/email/' },
      { name: 'createActionTemplate', args: ['email', { template: 1 }], path: '/automation/templates/email/', method: 'POST', body: { template: 1 } },
      { name: 'testIntegration', args: ['slack', { token: 'x' }], path: '/automation/integrations/test/', method: 'POST', body: { type: 'slack', credentials: { token: 'x' } } },
      { name: 'getIntegrationStatus', args: [], path: '/automation/integrations/status/' },
    ];

    for (const c of cases) {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockResp });
      // Call method dynamically
      // eslint-disable-next-line jest/valid-title
      // @ts-ignore
      const result = await automationAPI[c.name](...c.args);
      expect(global.fetch).toHaveBeenCalled();
      const lastCall = global.fetch.mock.calls[0];
      const url = lastCall[0];
      if (c.path) {
        expect(url).toContain(c.path);
      }
      if (c.pathContains) {
        expect(url).toContain(c.pathContains);
      }
      if (c.method) {
        expect(lastCall[1].method).toBe(c.method);
      }
      if (c.body) {
        expect(JSON.parse(lastCall[1].body)).toEqual(c.body);
      }
    }
  });
});
