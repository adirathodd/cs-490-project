/**
 * Tests for src/index.js
 * - Verifies createRoot/render is called
 * - Verifies reportWebVitals is invoked
 * - Verifies dev-only DOMContentLoaded listener is registered when NODE_ENV=development
 */

describe('src/index.js bootstrapping', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('creates a React root and renders the app and calls reportWebVitals', () => {
    // mock react-dom/client and reportWebVitals and App
    const renderMock = jest.fn();
    const createRootMock = jest.fn(() => ({ render: renderMock }));
    let reportWebVitalsMock;
    jest.doMock('react-dom/client', () => ({
      __esModule: true,
      default: { createRoot: createRootMock },
      createRoot: createRootMock,
    }));
    jest.doMock('./reportWebVitals', () => ({ __esModule: true, default: (reportWebVitalsMock = jest.fn()) }));
    jest.doMock('./App', () => ({ __esModule: true, default: () => null }));

    // load index
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      require('./index');
    });

    expect(createRootMock).toHaveBeenCalledTimes(1);
    const rootEl = document.getElementById('root');
    expect(createRootMock).toHaveBeenCalledWith(rootEl);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(reportWebVitalsMock).toHaveBeenCalledTimes(1);
    expect(reportWebVitalsMock).toHaveBeenCalledWith();
  });

  it('registers dev-only DOMContentLoaded listener when NODE_ENV=development', () => {
    process.env.NODE_ENV = 'development';
    const addEventSpy = jest.spyOn(window, 'addEventListener');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mock getComputedStyle to return CSS variables
    const getProp = jest.fn((name) => {
      switch (name) {
        case '--primary-color':
          return ' #123456 ';
        case '--surface':
          return ' #ffffff ';
        case '--on-primary':
          return ' #000000 ';
        default:
          return ' value ';
      }
    });
    const fakeStyle = { getPropertyValue: getProp };
    const getComputedSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(() => fakeStyle);

    const renderMock = jest.fn();
    jest.doMock('react-dom/client', () => ({
      __esModule: true,
      default: { createRoot: jest.fn(() => ({ render: renderMock })) },
    }));
    jest.doMock('./reportWebVitals', () => ({ __esModule: true, default: jest.fn() }));
    jest.doMock('./App', () => ({ __esModule: true, default: () => null }));

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      require('./index');
    });

    expect(addEventSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));

    // Fire DOMContentLoaded to execute the listener and cover the block
    const handler = addEventSpy.mock.calls.find(([evt]) => evt === 'DOMContentLoaded')[1];
    handler();
    expect(getComputedSpy).toHaveBeenCalled();
    expect(getProp).toHaveBeenCalledWith('--primary-color');
    expect(getProp).toHaveBeenCalledWith('--surface');
    expect(getProp).toHaveBeenCalledWith('--on-primary');
    expect(logSpy).toHaveBeenCalledWith('Theme variables:', expect.objectContaining({
      '--primary-color': '#123456',
      '--surface': '#ffffff',
      '--on-primary': '#000000',
    }));

    // Now simulate an error path: make getComputedStyle throw
    getComputedSpy.mockImplementation(() => { throw new Error('boom'); });
    handler();
    expect(logSpy).toHaveBeenCalledWith('Theme debug: failed to read CSS variables', expect.any(Error));

    // restore
    getComputedSpy.mockRestore();
    logSpy.mockRestore();
  });
});
