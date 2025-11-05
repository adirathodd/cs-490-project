/**
 * @fileoverview Unit tests for the API service wrapper.
 * These tests focus on interceptor behaviour and key auth helpers.
 */
jest.unmock('./api');

jest.mock('axios', () => {
  // Keep latest instance in factory scope to avoid cross-module confusion
  let latestInstance;

  const createMockInstance = () => {
    const instance = {
      interceptors: {
        request: {
          use: jest.fn((fulfilled, rejected) => {
            instance._reqFulfilled = fulfilled;
            instance._reqRejected = rejected;
            return { fulfilled, rejected };
          }),
        },
        response: {
          use: jest.fn((fulfilled, rejected) => {
            instance._resFulfilled = fulfilled;
            instance._resRejected = rejected;
            return { fulfilled, rejected };
          }),
        },
      },
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    return instance;
  };

  const create = jest.fn(() => {
    const instance = createMockInstance();
    latestInstance = instance;
    // maintain legacy accessor
    create.latestInstance = instance;
    try { global.__LATEST_AXIOS_INSTANCE__ = instance; } catch (e) {}
    return instance;
  });

  const getLatest = () => latestInstance || create.latestInstance || global.__LATEST_AXIOS_INSTANCE__;

  const defaultExport = {
    create,
    __getLatestInstance: getLatest,
  };

  return {
    __esModule: true,
    default: defaultExport,
    create,
    __getLatestInstance: getLatest,
  };
});

describe('api service', () => {
  let apiModule;
  let authAPI;
  let profileAPI;
  let skillsAPI;
  let educationAPI;
  let certificationsAPI;
  let projectsAPI;
  let defaultExport;
  let mockAxios;

  const loadModule = () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      apiModule = require('./api');
      authAPI = apiModule.authAPI;
      profileAPI = apiModule.profileAPI;
      skillsAPI = apiModule.skillsAPI;
      educationAPI = apiModule.educationAPI;
      certificationsAPI = apiModule.certificationsAPI;
      projectsAPI = apiModule.projectsAPI;
      defaultExport = apiModule.default;
    });
    const axios = require('axios'); // eslint-disable-line global-require
    const fromModule = axios && (axios.__getLatestInstance || axios.default?.__getLatestInstance);
    mockAxios = (fromModule && fromModule()) || global.__LATEST_AXIOS_INSTANCE__;
  };

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    if (typeof Blob === 'undefined') {
      // minimal Blob polyfill for tests that only need an object instance
      // eslint-disable-next-line no-global-assign
      global.Blob = class { constructor(parts){ this.parts = parts; } };
    }
    loadModule();
  });

  test('request interceptor attaches bearer token when present', async () => {
    expect(typeof mockAxios._reqFulfilled).toBe('function');
    const config = { headers: {} };
    localStorage.setItem('firebaseToken', 'abc123');

    const updated = await mockAxios._reqFulfilled({ ...config });

    expect(updated.headers.Authorization).toBe('Bearer abc123');
  });

  test('request interceptor leaves headers untouched when token missing', async () => {
    const config = { headers: {} };

    const updated = await mockAxios._reqFulfilled({ ...config });

    expect(updated.headers.Authorization).toBeUndefined();
  });

  test('request interceptor rejection passes through error', async () => {
    const err = new Error('boom');
    await expect(mockAxios._reqRejected(err)).rejects.toBe(err);
  });

  test('response interceptor retries a transient GET once', async () => {
    jest.useFakeTimers();
    mockAxios.request.mockResolvedValue('retry-result');
    const config = { method: 'get' };
    const error = {
      config,
      response: { status: 502 },
    };

    const retryPromise = mockAxios._resRejected(error);

    // Allow the internal timeout to run without waiting 500ms in real time
    await Promise.resolve();
    jest.advanceTimersByTime(500);
    const result = await retryPromise;

    expect(mockAxios.request).toHaveBeenCalledTimes(1);
    const retryConfig = mockAxios.request.mock.calls[0][0];
    expect(retryConfig.__retryCount).toBe(1);
    expect(result).toBe('retry-result');
    jest.useRealTimers();
  });

  test('response interceptor retries transient GET and rejects if retry fails', async () => {
    jest.useFakeTimers();
    mockAxios.request.mockRejectedValueOnce(new Error('still down'));
    const config = { method: 'get' };
    const error = { config, response: { status: 503 } };

    const retryPromise = mockAxios._resRejected(error);
    await Promise.resolve();
    jest.advanceTimersByTime(500);
    // Since we invoke the interceptor function directly, the retry rejection won't be
    // re-intercepted and normalized here; expect the raw error from the retry.
    await expect(retryPromise).rejects.toThrow('still down');
    jest.useRealTimers();
  });

  test('response interceptor normalizes non-transient errors', async () => {
    const rejection = mockAxios._resRejected({
      config: { method: 'post' },
      response: { data: { error: { code: 'bad', message: 'nope' } } },
    });

    await expect(rejection).rejects.toEqual({ error: { code: 'bad', message: 'nope' } });
  });

  test('response interceptor fulfilled returns response unchanged', async () => {
    const resp = { data: 123 };
    expect(mockAxios._resFulfilled(resp)).toBe(resp);
  });

  test('response interceptor handles network error (no response) with network_error code', async () => {
    // Set __retryCount to skip the internal retry path and surface normalization
    const rejection = mockAxios._resRejected({ config: { method: 'get', __retryCount: 1 } });
    await expect(rejection).rejects.toEqual({ error: { code: 'network_error', message: 'Network error. Please try again.' } });
  });

  test('response interceptor does not retry non-GET and normalizes', async () => {
    const rejection = mockAxios._resRejected({ config: { method: 'post' }, response: { status: 503 } });
    await expect(rejection).rejects.toEqual({ error: { code: 'network_error', message: 'Network error. Please try again.' } });
  });

  test('response interceptor will not retry if already retried once', async () => {
    mockAxios.request.mockClear();
    const rejection = mockAxios._resRejected({ config: { method: 'get', __retryCount: 1 }, response: { status: 502 } });
    await expect(rejection).rejects.toEqual({ error: { code: 'network_error', message: 'Network error. Please try again.' } });
    expect(mockAxios.request).not.toHaveBeenCalled();
  });

  test('authAPI.getCurrentUser delegates to GET /users/me', async () => {
    mockAxios.get.mockResolvedValue({ data: { profile: { id: 1 } } });

    const payload = await authAPI.getCurrentUser();

    expect(mockAxios.get).toHaveBeenCalledWith('/users/me');
    expect(payload).toEqual({ profile: { id: 1 } });
  });

  test('authAPI.register surfaces normalized errors from interceptor', async () => {
    mockAxios.post.mockRejectedValue({ error: { code: 'registration_failed', message: 'fail' } });

    await expect(authAPI.register({})).rejects.toEqual({ code: 'registration_failed', message: 'fail' });
  });

  test('default export mirrors named authAPI helpers', () => {
    expect(defaultExport.authAPI).toBe(authAPI);
    expect(typeof defaultExport.getBasicProfile).toBe('function');
    expect(typeof defaultExport.authAPI.getBasicProfile).toBe('function');
  });

  describe('profileAPI', () => {
    test('getUserProfile current user and by id', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { you: true } });
      const me = await profileAPI.getUserProfile();
      expect(mockAxios.get).toHaveBeenCalledWith('/users/profile');
      expect(me).toEqual({ you: true });

      mockAxios.get.mockResolvedValueOnce({ data: { id: 42 } });
      const other = await profileAPI.getUserProfile(42);
      expect(mockAxios.get).toHaveBeenLastCalledWith('/users/42/profile');
      expect(other).toEqual({ id: 42 });
    });

    test('updateProfile current user and by id', async () => {
      mockAxios.put.mockResolvedValueOnce({ data: { ok: 1 } });
      const me = await profileAPI.updateProfile(null, { a: 1 });
      expect(mockAxios.put).toHaveBeenCalledWith('/users/profile', { a: 1 });
      expect(me).toEqual({ ok: 1 });

      mockAxios.put.mockResolvedValueOnce({ data: { ok: 2 } });
      const other = await profileAPI.updateProfile(7, { b: 2 });
      expect(mockAxios.put).toHaveBeenLastCalledWith('/users/7/profile', { b: 2 });
      expect(other).toEqual({ ok: 2 });
    });

    test('getUserProfile error surfaces response data', async () => {
      const err = { response: { data: { error: 'oops' } } };
      mockAxios.get.mockRejectedValueOnce(err);
      await expect(profileAPI.getUserProfile()).rejects.toEqual({ error: 'oops' });
    });
  });

  describe('authAPI endpoints', () => {
    test('login and updateProfile endpoints', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { token: 't' } });
      const login = await authAPI.login({ email: 'a', password: 'p' });
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/login', { email: 'a', password: 'p' });
      expect(login).toEqual({ token: 't' });

      mockAxios.patch.mockResolvedValueOnce({ data: { name: 'x' } });
      const up = await authAPI.updateProfile({ name: 'x' });
      expect(mockAxios.patch).toHaveBeenCalledWith('/users/me', { name: 'x' });
      expect(up).toEqual({ name: 'x' });
    });

    test('getBasicProfile and updateBasicProfile', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { a: 1 } });
      const basic = await authAPI.getBasicProfile();
      expect(mockAxios.get).toHaveBeenCalledWith('/profile/basic');
      expect(basic).toEqual({ a: 1 });

      mockAxios.patch.mockResolvedValueOnce({ data: { ok: true } });
      const upd = await authAPI.updateBasicProfile({ x: 1 });
      expect(mockAxios.patch).toHaveBeenCalledWith('/profile/basic', { x: 1 });
      expect(upd).toEqual({ ok: true });
    });

    test('linkProviderToken posts provider + access_token', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { custom_token: 'ct', email: 'e' } });
      const res = await authAPI.linkProviderToken('github', 'token123');
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/oauth/link', { provider: 'github', access_token: 'token123' });
      expect(res).toEqual({ custom_token: 'ct', email: 'e' });
    });

    test('profile picture endpoints', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { has_profile_picture: true } });
      const pic = await authAPI.getProfilePicture();
      expect(mockAxios.get).toHaveBeenCalledWith('/profile/picture');
      expect(pic).toEqual({ has_profile_picture: true });

      // mock FormData and ensure header is set
      const OldFormData = global.FormData;
      global.FormData = class { constructor(){ this._a=[];} append(...args){ this._a.push(args);} };
      mockAxios.post.mockResolvedValueOnce({ data: { uploaded: true } });
      const file = new Blob(['x']);
      const upload = await authAPI.uploadProfilePicture(file);
      expect(mockAxios.post).toHaveBeenCalled();
      const postArgs = mockAxios.post.mock.calls[mockAxios.post.mock.calls.length - 1];
      expect(postArgs[0]).toBe('/profile/picture/upload');
      expect(postArgs[2]).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } });
      expect(upload).toEqual({ uploaded: true });
      global.FormData = OldFormData;

      mockAxios.delete.mockResolvedValueOnce({ data: { deleted: true } });
      const del = await authAPI.deleteProfilePicture();
      expect(mockAxios.delete).toHaveBeenCalledWith('/profile/picture/delete');
      expect(del).toEqual({ deleted: true });
    });

    test('account deletion endpoints', async () => {
      mockAxios.delete.mockResolvedValueOnce({ data: { ok: 1 } });
      const del = await authAPI.deleteAccount();
      expect(mockAxios.delete).toHaveBeenCalledWith('/users/me');
      expect(del).toEqual({ ok: 1 });

      mockAxios.post.mockResolvedValueOnce({ data: { ok: 2 } });
      const req = await authAPI.requestAccountDeletion();
      expect(mockAxios.post).toHaveBeenCalledWith('/users/me/delete-request');
      expect(req).toEqual({ ok: 2 });
    });

    test('employment history endpoints', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [1] });
      const hist = await authAPI.getEmploymentHistory();
      expect(mockAxios.get).toHaveBeenCalledWith('/employment');
      expect(hist).toEqual([1]);

      mockAxios.get.mockResolvedValueOnce({ data: [2] });
      const timeline = await authAPI.getEmploymentTimeline();
      expect(mockAxios.get).toHaveBeenCalledWith('/employment/timeline');
      expect(timeline).toEqual([2]);

      mockAxios.get.mockResolvedValueOnce({ data: { id: 9 } });
      const one = await authAPI.getEmployment(9);
      expect(mockAxios.get).toHaveBeenCalledWith('/employment/9');
      expect(one).toEqual({ id: 9 });

      mockAxios.post.mockResolvedValueOnce({ data: { created: 1 } });
      const created = await authAPI.createEmployment({ role: 'dev' });
      expect(mockAxios.post).toHaveBeenCalledWith('/employment', { role: 'dev' });
      expect(created).toEqual({ created: 1 });

      mockAxios.patch.mockResolvedValueOnce({ data: { updated: 1 } });
      const updated = await authAPI.updateEmployment(3, { role: 'pm' });
      expect(mockAxios.patch).toHaveBeenCalledWith('/employment/3', { role: 'pm' });
      expect(updated).toEqual({ updated: 1 });

      mockAxios.delete.mockResolvedValueOnce({ data: { removed: 1 } });
      const removed = await authAPI.deleteEmployment(5);
      expect(mockAxios.delete).toHaveBeenCalledWith('/employment/5');
      expect(removed).toEqual({ removed: 1 });
    });
  });

  describe('authAPI error fallbacks', () => {
    test('login error falls back to default normalized object', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('nope'));
      await expect(authAPI.login({})).rejects.toEqual({ code: 'login_failed', message: 'Login failed' });
    });

    test('getCurrentUser error falls back to default normalized object', async () => {
      mockAxios.get.mockRejectedValueOnce({});
      await expect(authAPI.getCurrentUser()).rejects.toEqual({ code: 'fetch_user_failed', message: 'Failed to fetch user' });
    });

    test('updateProfile error falls back to default normalized object', async () => {
      mockAxios.patch.mockRejectedValueOnce({});
      await expect(authAPI.updateProfile({})).rejects.toEqual({ code: 'update_profile_failed', message: 'Failed to update profile' });
    });

    test('getBasicProfile and updateBasicProfile pass through errors', async () => {
      const err1 = new Error('gbp');
      mockAxios.get.mockRejectedValueOnce(err1);
      await expect(authAPI.getBasicProfile()).rejects.toBe(err1);

      const err2 = new Error('ubp');
      mockAxios.patch.mockRejectedValueOnce(err2);
      await expect(authAPI.updateBasicProfile({})).rejects.toBe(err2);
    });

    test('linkProviderToken error uses response.data when available', async () => {
      const err = { response: { data: { code: 'link_failed', message: 'bad' } } };
      mockAxios.post.mockRejectedValueOnce(err);
      await expect(authAPI.linkProviderToken('github','t')).rejects.toEqual({ code: 'link_failed', message: 'bad' });
    });

    test('linkProviderToken error falls back to error.message', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('msg'));
      await expect(authAPI.linkProviderToken('github','t')).rejects.toEqual('msg');
    });

    test('requestAccountDeletion passes through raw errors', async () => {
      const err = new Error('rad');
      mockAxios.post.mockRejectedValueOnce(err);
      await expect(authAPI.requestAccountDeletion()).rejects.toBe(err);
    });
  });

  describe('skillsAPI', () => {
    test('CRUD operations', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [] });
      const list = await skillsAPI.getSkills();
      expect(mockAxios.get).toHaveBeenCalledWith('/skills');
      expect(list).toEqual([]);

      mockAxios.post.mockResolvedValueOnce({ data: { id: 1 } });
      const add = await skillsAPI.addSkill({ name: 'JS' });
      expect(mockAxios.post).toHaveBeenCalledWith('/skills', { name: 'JS' });
      expect(add).toEqual({ id: 1 });

      mockAxios.patch.mockResolvedValueOnce({ data: { id: 1, level: 5 } });
      const upd = await skillsAPI.updateSkill(1, { level: 5 });
      expect(mockAxios.patch).toHaveBeenCalledWith('/skills/1', { level: 5 });
      expect(upd).toEqual({ id: 1, level: 5 });

      mockAxios.delete.mockResolvedValueOnce({ data: { ok: true } });
      const del = await skillsAPI.deleteSkill(1);
      expect(mockAxios.delete).toHaveBeenCalledWith('/skills/1');
      expect(del).toEqual({ ok: true });
    });

    test('autocomplete with and without category', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: ['a'] });
      const plain = await skillsAPI.autocompleteSkills('re');
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringMatching(/^\/skills\/autocomplete\?q=re&limit=10$/));
      expect(plain).toEqual(['a']);

      mockAxios.get.mockResolvedValueOnce({ data: ['b'] });
      const withCat = await skillsAPI.autocompleteSkills('py', 'language', 5);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringMatching(/^\/skills\/autocomplete\?q=py&limit=5&category=language$/));
      expect(withCat).toEqual(['b']);
    });

    test('categories and by-category', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: ['lang'] });
      const cats = await skillsAPI.getCategories();
      expect(mockAxios.get).toHaveBeenCalledWith('/skills/categories');
      expect(cats).toEqual(['lang']);

      mockAxios.get.mockResolvedValueOnce({ data: { language: [] } });
      const grouped = await skillsAPI.getSkillsByCategory();
      expect(mockAxios.get).toHaveBeenCalledWith('/skills/by-category');
      expect(grouped).toEqual({ language: [] });
    });

    test('reordering single and bulk', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { ok: 1 } });
      const r1 = await skillsAPI.reorderSkill(10, 2);
      expect(mockAxios.post).toHaveBeenCalledWith('/skills/reorder', { skill_id: 10, new_order: 2 });
      expect(r1).toEqual({ ok: 1 });

      mockAxios.post.mockResolvedValueOnce({ data: { ok: 2 } });
      const r2 = await skillsAPI.reorderSkill(11, 3, 'language');
      expect(mockAxios.post).toHaveBeenCalledWith('/skills/reorder', { skill_id: 11, new_order: 3, new_category: 'language' });
      expect(r2).toEqual({ ok: 2 });

      mockAxios.post.mockResolvedValueOnce({ data: { ok: 3 } });
      const bulk = await skillsAPI.bulkReorderSkills([{ id: 1, order: 1 }]);
      expect(mockAxios.post).toHaveBeenCalledWith('/skills/bulk-reorder', { skills: [{ id: 1, order: 1 }] });
      expect(bulk).toEqual({ ok: 3 });
    });

    test('export skills json and csv', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
      const json = await skillsAPI.exportSkills('json');
      expect(mockAxios.get).toHaveBeenCalledWith('/skills/export?format=json', { responseType: 'json' });
      expect(json).toEqual([{ id: 1 }]);

      mockAxios.get.mockResolvedValueOnce({ data: 'csvdata' });
      const csv = await skillsAPI.exportSkills('csv');
      expect(mockAxios.get).toHaveBeenCalledWith('/skills/export?format=csv', { responseType: 'blob' });
      expect(csv).toEqual('csvdata');
    });

    test('getSkills error returns server error object or default', async () => {
      const err = { response: { data: { error: { message: 'fail' } } } };
      mockAxios.get.mockRejectedValueOnce(err);
      await expect(skillsAPI.getSkills()).rejects.toEqual({ message: 'fail' });

      // default fallback when no response
      mockAxios.get.mockRejectedValueOnce(new Error('net'));
      await expect(skillsAPI.getSkills()).rejects.toEqual({ message: 'Failed to fetch skills' });
    });

    test('autocompleteSkills error uses default when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('nope'));
      await expect(skillsAPI.autocompleteSkills('x')).rejects.toEqual({ message: 'Failed to fetch suggestions' });
    });

    test('getCategories error uses default when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('nope'));
      await expect(skillsAPI.getCategories()).rejects.toEqual({ message: 'Failed to fetch categories' });
    });
  });

  describe('educationAPI', () => {
    test('levels, CRUD', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: ['BSc'] });
      const levels = await educationAPI.getLevels();
      expect(mockAxios.get).toHaveBeenCalledWith('/education/levels');
      expect(levels).toEqual(['BSc']);

      mockAxios.get.mockResolvedValueOnce({ data: [] });
      const list = await educationAPI.getEducations();
      expect(mockAxios.get).toHaveBeenCalledWith('/education');
      expect(list).toEqual([]);

      mockAxios.post.mockResolvedValueOnce({ data: { id: 1 } });
      const add = await educationAPI.addEducation({ school: 'X' });
      expect(mockAxios.post).toHaveBeenCalledWith('/education', { school: 'X' });
      expect(add).toEqual({ id: 1 });

      mockAxios.patch.mockResolvedValueOnce({ data: { id: 1, school: 'Y' } });
      const upd = await educationAPI.updateEducation(1, { school: 'Y' });
      expect(mockAxios.patch).toHaveBeenCalledWith('/education/1', { school: 'Y' });
      expect(upd).toEqual({ id: 1, school: 'Y' });

      mockAxios.delete.mockResolvedValueOnce({ data: { ok: true } });
      const del = await educationAPI.deleteEducation(1);
      expect(mockAxios.delete).toHaveBeenCalledWith('/education/1');
      expect(del).toEqual({ ok: true });
    });

    test('updateEducation error returns server error object', async () => {
      const err = { response: { data: { error: { message: 'bad' } } } };
      mockAxios.patch.mockRejectedValueOnce(err);
      await expect(educationAPI.updateEducation(1, { a: 1 })).rejects.toEqual({ message: 'bad' });
    });

    test('getLevels error uses default when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('nope'));
      await expect(educationAPI.getLevels()).rejects.toEqual({ message: 'Failed to fetch education levels' });
    });

    test('addEducation error uses default when no response', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('nope'));
      await expect(educationAPI.addEducation({})).rejects.toEqual({ message: 'Failed to add education' });
    });

    test('deleteEducation error uses default when no response', async () => {
      mockAxios.delete.mockRejectedValueOnce(new Error('nope'));
      await expect(educationAPI.deleteEducation(1)).rejects.toEqual({ message: 'Failed to delete education' });
    });
  });

  describe('certificationsAPI', () => {
    beforeAll(() => {
      // mock File and FormData
      class FileMock {}
      global.File = FileMock;
      const OldFormData = global.FormData;
      global.__OldFormData = OldFormData; // stash for afterAll
      global.FormData = class {
        constructor(){ this.map = []; }
        append(k, v){ this.map.push([k, v]); }
      };
    });
    afterAll(() => {
      global.FormData = global.__OldFormData;
      delete global.__OldFormData;
      delete global.File;
    });

    test('getCategories, searchOrganizations, list and delete', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: ['cat'] });
      const cats = await certificationsAPI.getCategories();
      expect(mockAxios.get).toHaveBeenCalledWith('/certifications/categories');
      expect(cats).toEqual(['cat']);

      mockAxios.get.mockResolvedValueOnce({ data: ['Org A'] });
      const orgs = await certificationsAPI.searchOrganizations('AWS', 5);
      expect(mockAxios.get).toHaveBeenCalledWith('/certifications/orgs?q=AWS&limit=5');
      expect(orgs).toEqual(['Org A']);

      mockAxios.get.mockResolvedValueOnce({ data: [] });
      const list = await certificationsAPI.getCertifications();
      expect(mockAxios.get).toHaveBeenCalledWith('/certifications');
      expect(list).toEqual([]);

      mockAxios.delete.mockResolvedValueOnce({ data: { ok: 1 } });
      const del = await certificationsAPI.deleteCertification(9);
      expect(mockAxios.delete).toHaveBeenCalledWith('/certifications/9');
      expect(del).toEqual({ ok: 1 });
    });

    test('addCertification with File uses multipart; without uses JSON', async () => {
      // with File
      mockAxios.post.mockResolvedValueOnce({ data: { id: 1 } });
      const res1 = await certificationsAPI.addCertification({ name: 'X', document: new File() });
      expect(mockAxios.post).toHaveBeenCalledWith('/certifications', expect.any(Object), { headers: { 'Content-Type': 'multipart/form-data' } });
      expect(res1).toEqual({ id: 1 });

      // without File
      mockAxios.post.mockResolvedValueOnce({ data: { id: 2 } });
      const res2 = await certificationsAPI.addCertification({ name: 'Y' });
      expect(mockAxios.post).toHaveBeenLastCalledWith('/certifications', { name: 'Y' });
      expect(res2).toEqual({ id: 2 });
    });

    test('updateCertification: file/null branches and JSON', async () => {
      // with File
      mockAxios.patch.mockResolvedValueOnce({ data: { ok: 'file' } });
      const r1 = await certificationsAPI.updateCertification(3, { document: new File(), name: 'A' });
      expect(mockAxios.patch).toHaveBeenCalledWith('/certifications/3', expect.any(Object), { headers: { 'Content-Type': 'multipart/form-data' } });
      expect(r1).toEqual({ ok: 'file' });

      // document null
      mockAxios.patch.mockResolvedValueOnce({ data: { ok: 'null' } });
      const r2 = await certificationsAPI.updateCertification(4, { document: null, name: 'B' });
      expect(mockAxios.patch).toHaveBeenCalledWith('/certifications/4', expect.any(Object), { headers: { 'Content-Type': 'multipart/form-data' } });
      expect(r2).toEqual({ ok: 'null' });

      // JSON branch
      mockAxios.patch.mockResolvedValueOnce({ data: { ok: 'json' } });
      const r3 = await certificationsAPI.updateCertification(5, { name: 'C' });
      expect(mockAxios.patch).toHaveBeenLastCalledWith('/certifications/5', { name: 'C' });
      expect(r3).toEqual({ ok: 'json' });
    });

    test('addCertification error returns server error object', async () => {
      const err = { response: { data: { error: { message: 'oops' } } } };
      mockAxios.post.mockRejectedValueOnce(err);
      await expect(certificationsAPI.addCertification({ name: 'Z' })).rejects.toEqual({ message: 'oops' });
    });

    test('searchOrganizations error uses default when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('nope'));
      await expect(certificationsAPI.searchOrganizations('A')).rejects.toEqual({ message: 'Failed to search organizations' });
    });

    test('getCertifications error uses default when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('nope'));
      await expect(certificationsAPI.getCertifications()).rejects.toEqual({ message: 'Failed to fetch certifications' });
    });

    test('updateCertification JSON-branch error uses default when no response', async () => {
      mockAxios.patch.mockRejectedValueOnce(new Error('nope'));
      await expect(certificationsAPI.updateCertification(1, { name: 'X' })).rejects.toEqual({ message: 'Failed to update certification' });
    });

    test('deleteCertification error uses default when no response', async () => {
      mockAxios.delete.mockRejectedValueOnce(new Error('nope'));
      await expect(certificationsAPI.deleteCertification(1)).rejects.toEqual({ message: 'Failed to delete certification' });
    });
  });

  describe('projectsAPI', () => {
    beforeAll(() => {
      // ensure FormData exists
      const OldFormData = global.FormData;
      global.__OldFormData2 = OldFormData;
      if (!OldFormData) {
        global.FormData = class { constructor(){ this._a=[];} append(...args){ this._a.push(args);} };
      }
    });
    afterAll(() => {
      if (global.__OldFormData2) {
        global.FormData = global.__OldFormData2;
        delete global.__OldFormData2;
      } else {
        delete global.FormData;
      }
    });

    test('getProjects builds query string and handles arrays', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
      const res = await projectsAPI.getProjects({ q: 'test', tags: ['a', 'b'], empty: '', none: null });
      // URLSearchParams encodes commas by default when appended as a single value
      expect(mockAxios.get).toHaveBeenCalledWith('/projects?q=test&tags=a%2Cb');
      expect(res).toEqual([{ id: 1 }]);
    });

    test('getProjects with no params uses base path', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [] });
      const res = await projectsAPI.getProjects();
      expect(mockAxios.get).toHaveBeenCalledWith('/projects');
      expect(res).toEqual([]);
    });

    test('getProject, deleteProject and deleteProjectMedia', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { id: 2 } });
      const one = await projectsAPI.getProject(2);
      expect(mockAxios.get).toHaveBeenCalledWith('/projects/2');
      expect(one).toEqual({ id: 2 });

      mockAxios.delete.mockResolvedValueOnce({ data: { ok: 1 } });
      const del = await projectsAPI.deleteProject(3);
      expect(mockAxios.delete).toHaveBeenCalledWith('/projects/3');
      expect(del).toEqual({ ok: 1 });

      mockAxios.delete.mockResolvedValueOnce({ data: { ok: 2 } });
      const delMedia = await projectsAPI.deleteProjectMedia(4, 5);
      expect(mockAxios.delete).toHaveBeenCalledWith('/projects/4/media/5');
      expect(delMedia).toEqual({ ok: 2 });
    });

    test('addProject uses multipart when media present, otherwise JSON', async () => {
      // multipart path
      mockAxios.post.mockResolvedValueOnce({ data: { id: 10 } });
      const f = new Blob(['file']);
      const res1 = await projectsAPI.addProject({ title: 'A', technologies: ['x','y'], media: [f] });
      expect(mockAxios.post).toHaveBeenCalledWith('/projects', expect.any(Object), { headers: { 'Content-Type': 'multipart/form-data' } });
      expect(res1).toEqual({ id: 10 });

      // JSON path
      mockAxios.post.mockResolvedValueOnce({ data: { id: 11 } });
      const res2 = await projectsAPI.addProject({ title: 'B', technologies: ['k'] });
      expect(mockAxios.post).toHaveBeenLastCalledWith('/projects', { title: 'B', technologies: ['k'] });
      expect(res2).toEqual({ id: 11 });
    });

    test('updateProject uses multipart when media present, otherwise JSON', async () => {
      // multipart
      mockAxios.patch.mockResolvedValueOnce({ data: { ok: 1 } });
      const f = new Blob(['file']);
      const r1 = await projectsAPI.updateProject(9, { title: 'A', media: [f], technologies: ['t'] });
      expect(mockAxios.patch).toHaveBeenCalledWith('/projects/9', expect.any(Object), { headers: { 'Content-Type': 'multipart/form-data' } });
      expect(r1).toEqual({ ok: 1 });

      // JSON
      mockAxios.patch.mockResolvedValueOnce({ data: { ok: 2 } });
      const r2 = await projectsAPI.updateProject(8, { title: 'B' });
      expect(mockAxios.patch).toHaveBeenLastCalledWith('/projects/8', { title: 'B' });
      expect(r2).toEqual({ ok: 2 });
    });

    test('getProject error falls back to default message when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('down'));
      await expect(projectsAPI.getProject(123)).rejects.toEqual({ message: 'Failed to fetch project' });
    });

    test('getProjects error falls back to default message when no response', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('down'));
      await expect(projectsAPI.getProjects({ q: 'test' })).rejects.toEqual({ message: 'Failed to fetch projects' });
    });

    test('addProject JSON error uses default when no response', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('down'));
      await expect(projectsAPI.addProject({ title: 'T' })).rejects.toEqual({ message: 'Failed to add project' });
    });

    test('updateProject JSON error uses default when no response', async () => {
      mockAxios.patch.mockRejectedValueOnce(new Error('down'));
      await expect(projectsAPI.updateProject(1, { title: 'T' })).rejects.toEqual({ message: 'Failed to update project' });
    });

    test('deleteProject error uses default when no response', async () => {
      mockAxios.delete.mockRejectedValueOnce(new Error('down'));
      await expect(projectsAPI.deleteProject(1)).rejects.toEqual({ message: 'Failed to delete project' });
    });

    test('deleteProjectMedia error uses default when no response', async () => {
      mockAxios.delete.mockRejectedValueOnce(new Error('down'));
      await expect(projectsAPI.deleteProjectMedia(1, 2)).rejects.toEqual({ message: 'Failed to delete media' });
    });
  });

  describe('authAPI error paths', () => {
    test('deleteAccount throws through raw error', async () => {
      const err = new Error('nope');
      mockAxios.delete.mockRejectedValueOnce(err);
      await expect(authAPI.deleteAccount()).rejects.toBe(err);
    });
  });
});
